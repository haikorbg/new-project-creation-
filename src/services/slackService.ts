import { WebClient } from '@slack/web-api';
import { Milestone, Project } from '../types/linear';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Slack client with bot token from environment variables
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const SLACK_CHANNEL = 'C07PWD53552';

// Debug logging for Slack configuration
console.log('Slack configuration check:');
console.log('Slack token exists:', !!process.env.SLACK_BOT_TOKEN);
console.log('Slack token first 10 chars:', process.env.SLACK_BOT_TOKEN?.substring(0, 10));
console.log('Using Slack channel:', SLACK_CHANNEL);

export const SlackService = {
  /**
   * Send a notification about new project creation to Slack
   */
  async notifyProjectCreation(project: Project): Promise<void> {
    try {
      console.log('Attempting to send Slack notification for project:', project.name);
      // Create a list of milestone assignments
      const milestoneAssignments = project.milestones
        .filter(m => m.estimator)
        .map(m => `• ${m.name} - ${m.estimator}`)
        .join('\n');

      const blocks: any[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎉 New Project Created',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Project Name:*\n${project.name}`
            },
            {
              type: 'mrkdwn',
              text: `*State:*\n${project.state}`
            }
          ]
        }
      ];

      // Add description if exists
      if (project.description) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:*\n${project.description}`
          }
        });
      }

      // Add dates if they exist
      if (project.startDate || project.endDate) {
        blocks.push({
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Start Date:*\n${project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}`
            },
            {
              type: 'mrkdwn',
              text: `*End Date:*\n${project.endDate ? new Date(project.endDate).toLocaleDateString() : 'Not set'}`
            }
          ]
        });
      }

      // Add milestone assignments if any exist
      if (milestoneAssignments) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Milestone Assignments:*\n${milestoneAssignments}`
          }
        });

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '👋 Estimators, please review your assigned milestones and provide estimates.'
          }
        });
      }

      blocks.push({
        type: 'divider',
        block_id: 'divider1'
      });

      const message = {
        channel: SLACK_CHANNEL,
        text: `New project created: ${project.name}`,
        blocks
      };

      await slackClient.chat.postMessage(message);
      console.log(`Sent Slack notification for new project: ${project.name}`);

      // Send individual notifications for each milestone with an estimator
      for (const milestone of project.milestones) {
        if (milestone.estimator) {
          await this.notifyEstimator(project, milestone);
        }
      }
    } catch (error) {
      console.error('Error sending project creation notification:', error);
      throw error;
    }
  },

  /**
   * Send a notification to an estimator about their assigned milestone
   */
  async notifyEstimator(project: Project, milestone: Milestone): Promise<void> {
    try {
      const blocks: any[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Hey ${milestone.estimator}! You've been assigned to estimate the following milestone:`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Project:*\n${project.name}`
            },
            {
              type: 'mrkdwn',
              text: `*Milestone:*\n${milestone.name}`
            }
          ]
        }
      ];

      // Add target date if it exists
      if (milestone.targetDate) {
        blocks.push({
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Target Date:*\n${new Date(milestone.targetDate).toLocaleDateString()}`
            }
          ]
        });
      }

      // Add subtasks if they exist
      if (milestone.subtasks && milestone.subtasks.length > 0) {
        const subtasksList = milestone.subtasks
          .map(subtask => `• ${subtask.name}`)
          .join('\n');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Subtasks:*\n${subtasksList}`
          }
        });
      }

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '👉 Please provide your estimation for this milestone.'
        }
      });

      const message = {
        channel: SLACK_CHANNEL,
        text: `Milestone estimation needed: ${milestone.name}`,
        blocks
      };

      await slackClient.chat.postMessage(message);
      console.log(`Sent estimation request to ${milestone.estimator} for milestone: ${milestone.name}`);
    } catch (error) {
      console.error('Error sending estimator notification:', error);
      throw error;
    }
  },

  /**
   * Send a notification about overdue milestones to Slack
   */
  async notifyOverdueMilestones(project: Project, milestone: Milestone): Promise<void> {
    try {
      const message = {
        channel: SLACK_CHANNEL,
        text: `🚨 Overdue Milestone Alert: ${milestone.name} in project ${project.name}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 Overdue Milestone Alert',
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Project:*\n${project.name}`
              },
              {
                type: 'mrkdwn',
                text: `*Milestone:*\n${milestone.name}`
              }
            ]
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Status:*\n${milestone.status}`
              },
              {
                type: 'mrkdwn',
                text: `*Target Date:*\n${new Date(milestone.targetDate || '').toLocaleDateString()}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: milestone.estimator ? 
                `Hey ${milestone.estimator}, please provide an update on this milestone.` :
                '*Please provide an update on this milestone.*'
            }
          },
          {
            type: 'divider'
          }
        ]
      };

      await slackClient.chat.postMessage(message);
      console.log(`Sent Slack notification for overdue milestone: ${milestone.name}`);
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      throw error;
    }
  },

  /**
   * Send a summary of all overdue milestones to Slack
   */
  async sendOverdueSummary(projects: Project[]): Promise<void> {
    try {
      let overdueMilestonesCount = 0;
      const projectSummaries: string[] = [];

      for (const project of projects) {
        const overdueMilestones = project.milestones.filter(m => m.isOverdue);
        if (overdueMilestones.length > 0) {
          overdueMilestonesCount += overdueMilestones.length;
          projectSummaries.push(`*${project.name}*: ${overdueMilestones.length} overdue milestone(s)`);
        }
      }

      if (overdueMilestonesCount > 0) {
        const summaryText = `Found ${overdueMilestonesCount} overdue milestone(s) across ${projectSummaries.length} project(s)`;
        const message = {
          channel: SLACK_CHANNEL,
          text: summaryText,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '📊 Overdue Milestones Summary',
                emoji: true
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Found *${overdueMilestonesCount}* overdue milestone(s) across *${projectSummaries.length}* project(s)`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: projectSummaries.join('\n')
              }
            }
          ]
        };

        await slackClient.chat.postMessage(message);
        console.log('Sent overdue milestones summary to Slack');
      }
    } catch (error) {
      console.error('Error sending Slack summary:', error);
      throw error;
    }
  }
};

export default SlackService; 