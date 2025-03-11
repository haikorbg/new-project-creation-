export interface Project {
  id: string;
  name: string;
  description?: string;
  state: string;
  startDate?: string;
  endDate?: string;
  milestones: Milestone[];
  members: string[]; // Array of member email addresses
}

export interface Subtask {
  name: string;
  description?: string;
  status?: string;
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  targetDate?: string;
  status: string;
  isOverdue: boolean;
  subtasks: Subtask[];
  estimator?: string;
}

export interface LinearState {
  projects: Project[];
  lastUpdated: Date;
} 