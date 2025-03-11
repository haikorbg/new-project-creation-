import { LinearClient } from '@linear/sdk';
import { Project, Milestone } from '../types/linear';
import SlackService from './slackService';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Linear client with API key from environment variables
const linearClient = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

// In-memory storage for projects and milestones
let projectsCache: Project[] = [];
let lastUpdated: Date = new Date(0); // Initialize with epoch time
let lastNotificationSent: Date = new Date(0); // Track when we last sent notifications

// Helper function to create a mock milestone
const createMockMilestone = (id: string, name: string, projectId: string, isOverdue: boolean): Milestone => {
  const today = new Date();
  const targetDate = isOverdue 
    ? new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
    : new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days in future
  
  return {
    id,
    name,
    description: `Mock milestone for project ${projectId}`,
    targetDate,
    status: isOverdue ? 'Overdue' : 'Active',
    isOverdue,
    subtasks: []
  };
};

// Interface for creating a new project
export interface CreateProjectInput {
  name: string;
  description?: string;
  teamId?: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  milestones?: {
    name: string;
    description?: string;
    targetDate?: string;
    subtasks?: {
      name: string;
      description?: string;
    }[];
  }[];
}

// Interface for milestone creation response
interface MilestoneCreateResponse {
  projectMilestoneCreate: {
    success: boolean;
    projectMilestone: {
      id: string;
      name: string;
      description?: string;
      targetDate?: string;
    };
  };
}

export const LinearService = {
  /**
   * Fetch all projects from Linear
   */
  async fetchProjects(): Promise<Project[]> {
    try {
      const projects = await linearClient.projects();
      
      // Transform Linear projects to our Project type
      const transformedProjects: Project[] = [];
      
      for (const project of projects.nodes) {
        // Get real issues (milestones) for this project
        const issues = await linearClient.issues({
          filter: {
            project: { id: { eq: project.id } }
          }
        });

        const milestones: Milestone[] = [];
        
        // Process each issue as a milestone
        for (const issue of issues.nodes) {
          if (!issue.parent) { // Only process top-level issues as milestones
            // Get subtasks for this milestone
            const subtasks = await linearClient.issues({
              filter: {
                parent: { id: { eq: issue.id } }
              }
            });

            // Determine milestone status and overdue state
            const state = await issue.state;
            const isDone = state && ['Done', 'Completed', 'Canceled'].includes(state.name);
            const isOverdue = !isDone && issue.dueDate ? new Date(issue.dueDate) < new Date() : false;

            const milestone: Milestone = {
              id: issue.id,
              name: issue.title,
              description: issue.description || '',
              targetDate: issue.dueDate,
              status: isDone ? 'Done' : (isOverdue ? 'Overdue' : 'Active'),
              isOverdue,
              subtasks: await Promise.all(subtasks.nodes.map(async subtask => {
                const subtaskState = await subtask.state;
                const isSubtaskDone = subtaskState && ['Done', 'Completed', 'Canceled'].includes(subtaskState.name);
                return {
                  name: subtask.title,
                  description: subtask.description || undefined,
                  status: isSubtaskDone ? 'Done' : 'Active'
                };
              }))
            };
            
            milestones.push(milestone);
          }
        }
        
        // Extract start and end dates from the project
        const startDate = project.startedAt?.toString();
        const endDate = project.targetDate?.toString();
        
        transformedProjects.push({
          id: project.id,
          name: project.name,
          description: project.description || undefined,
          state: project.state,
          startDate,
          endDate,
          milestones
        });
      }
      
      // Update cache
      projectsCache = transformedProjects;
      lastUpdated = new Date();
      
      return transformedProjects;
    } catch (error) {
      console.error('Error fetching projects from Linear:', error);
      throw error;
    }
  },
  
  /**
   * Get all projects from cache or fetch if cache is empty
   */
  async getProjects(): Promise<Project[]> {
    if (projectsCache.length === 0) {
      return this.fetchProjects();
    }
    return projectsCache;
  },
  
  /**
   * Check for overdue milestones across all projects
   */
  async checkOverdueMilestones(): Promise<Milestone[]> {
    const projects = await this.getProjects();
    const overdueMilestones: Milestone[] = [];
    
    for (const project of projects) {
      for (const milestone of project.milestones) {
        if (milestone.isOverdue) {
          overdueMilestones.push(milestone);
        }
      }
    }
    
    return overdueMilestones;
  },

  /**
   * Check for overdue milestones and send notifications if needed
   */
  async checkAndNotifyOverdueMilestones(): Promise<void> {
    try {
      const projects = await this.getProjects();
      const now = new Date();
      const hoursSinceLastNotification = (now.getTime() - lastNotificationSent.getTime()) / (1000 * 60 * 60);

      // Only send notifications if it's been at least 24 hours since the last notification
      if (hoursSinceLastNotification >= 24) {
        // First, send individual notifications for each overdue milestone
        for (const project of projects) {
          const overdueMilestones = project.milestones.filter(m => m.isOverdue);
          for (const milestone of overdueMilestones) {
            await SlackService.notifyOverdueMilestones(project, milestone);
          }
        }

        // Then, send a summary notification
        await SlackService.sendOverdueSummary(projects);
        
        // Update the last notification timestamp
        lastNotificationSent = now;
      }
    } catch (error) {
      console.error('Error checking and notifying overdue milestones:', error);
      throw error;
    }
  },
  
  /**
   * Create a new project in Linear
   */
  async createProject(input: CreateProjectInput): Promise<Project> {
    try {
      // First, get a team ID if not provided
      let teamId = input.teamId;
      if (!teamId) {
        const teams = await linearClient.teams();
        if (teams.nodes.length === 0) {
          throw new Error('No teams found in Linear. Cannot create project without a team.');
        }
        teamId = teams.nodes[0].id;
      }

      console.log('Creating project with team ID:', teamId);
      console.log('Project input:', JSON.stringify(input, null, 2));

      // Create the project in Linear using the SDK
      const projectResponse = await linearClient.createProject({
        teamIds: [teamId],
        name: input.name,
        description: (input.description || '').substring(0, 255),
        state: input.state || 'planned',
        startDate: input.startDate ? new Date(input.startDate).toISOString() : undefined,
        targetDate: input.endDate ? new Date(input.endDate).toISOString() : undefined
      });

      if (!projectResponse.success) {
        throw new Error('Failed to create project in Linear');
      }

      const project = await projectResponse.project;
      if (!project) {
        throw new Error('Project creation succeeded but no project data returned');
      }

      console.log('Project created successfully:', JSON.stringify(project, null, 2));

      // Create milestones for the project
      const createdMilestones: Milestone[] = [];
      if (input.milestones && input.milestones.length > 0) {
        for (const milestone of input.milestones) {
          try {
            const milestoneResponse = await linearClient.createIssue({
              teamId: teamId,
              title: milestone.name,
              description: (milestone.description || '').substring(0, 255),
              dueDate: milestone.targetDate ? new Date(milestone.targetDate).toISOString() : undefined,
              projectId: project.id
            });

            const issue = await milestoneResponse.issue;
            if (!issue) {
              throw new Error('Failed to create milestone issue');
            }

            const createdMilestone: Milestone = {
              id: issue.id,
              name: milestone.name,
              description: milestone.description || '',
              targetDate: milestone.targetDate,
              status: 'Active',
              isOverdue: milestone.targetDate ? new Date(milestone.targetDate) < new Date() : false,
              subtasks: []
            };

            // Create subtasks for the milestone
            if (milestone.subtasks && milestone.subtasks.length > 0) {
              for (const subtask of milestone.subtasks) {
                const subtaskResponse = await linearClient.createIssue({
                  teamId: teamId,
                  title: subtask.name.substring(0, 255),
                  parentId: issue.id,
                  projectId: project.id
                });

                const subtaskIssue = await subtaskResponse.issue;
                if (subtaskIssue) {
                  createdMilestone.subtasks.push({
                    name: subtask.name
                  });
                }
              }
            }

            createdMilestones.push(createdMilestone);
          } catch (error) {
            console.error('Error creating milestone:', error);
            throw new Error(`Failed to create milestone: ${milestone.name}`);
          }
        }
      }

      // Return the created project
      return {
        id: project.id,
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        state: input.state || 'planned',
        startDate: input.startDate,
        endDate: input.endDate,
        milestones: createdMilestones
      } as Project;
    } catch (error) {
      console.error('Error in createProject:', error);
      throw error;
    }
  },
  
  /**
   * Get the last time the data was updated
   */
  getLastUpdated(): Date {
    return lastUpdated;
  }
};

export default LinearService; 