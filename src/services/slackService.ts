import { WebClient } from '@slack/web-api';
import { Milestone, Project } from '../types/linear';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Slack client with bot token from environment variables
export const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || '';
export const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const SLACK_CHANNEL = 'C07PWD53552';

// Debug logging for Slack configuration
console.log('Slack configuration check:');
console.log('Slack token exists:', !!process.env.SLACK_BOT_TOKEN);
console.log('Slack token first 10 chars:', process.env.SLACK_BOT_TOKEN?.substring(0, 10));
console.log('Using Slack channel:', SLACK_CHANNEL);

export const SlackService = {
  /**
   * Invite a member to a Slack channel using their email
   */
  async inviteMemberToChannel(channelId: string, email: string): Promise<void> {
    try {
      // Clean up email
      const cleanEmail = email.trim().toLowerCase();
      console.log(`Looking up Slack user for email: ${cleanEmail}`);

      // Look up the user by email
      const userLookup = await slackClient.users.lookupByEmail({
        email: cleanEmail
      });

      if (!userLookup.ok || !userLookup.user || !userLookup.user.id) {
        console.error(`Could not find Slack user for email: ${cleanEmail}`);
        return;
      }

      const userId = userLookup.user.id;
      console.log(`Found Slack user ID ${userId} for email ${cleanEmail}`);

      // Invite user to channel
      try {
        await slackClient.conversations.invite({
          channel: channelId,
          users: userId
        });
        console.log(`Successfully invited ${cleanEmail} to channel ${channelId}`);
      } catch (inviteError: any) {
        // If user is already in channel, that's fine
        if (inviteError.data?.error === 'already_in_channel') {
          console.log(`User ${cleanEmail} is already in channel ${channelId}`);
        } else {
          console.error(`Error inviting ${cleanEmail} to channel:`, inviteError);
        }
      }
    } catch (error) {
      console.error(`Error processing invite for ${email}:`, error);
    }
  },

  /**
   * Create a new Slack channel for a project and add members
   */
  async createProjectChannel(projectName: string, memberEmails: string[] = []): Promise<string> {
    try {
      // Format project name to valid Slack channel name
      const channelName = `proj-${projectName
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 75)}`;

      console.log('Creating Slack channel:', channelName);

      // Create the channel
      try {
        const result = await slackClient.conversations.create({
          name: channelName,
          is_private: false
        });

        if (!result.ok || !result.channel || !result.channel.id) {
          console.error('Channel creation failed:', result);
          throw new Error(`Failed to create channel: ${result.error || 'Unknown error'}`);
        }

        const channelId = result.channel.id;
        console.log(`Successfully created channel with ID: ${channelId}`);

        // Set channel topic
        try {
          await slackClient.conversations.setTopic({
            channel: channelId,
            topic: `Project: ${projectName} - Project coordination and updates`
          });
        } catch (topicError) {
          console.warn('Failed to set channel topic:', topicError);
        }

        // Invite all members to the channel
        if (memberEmails.length > 0) {
          console.log(`Attempting to invite ${memberEmails.length} members to channel ${channelId}`);
          for (const email of memberEmails) {
            await this.inviteMemberToChannel(channelId, email);
          }
        }

        return channelId;
      } catch (createError: any) {
        // If channel already exists, try to find and use it
        if (createError.data?.error === 'name_taken') {
          console.log('Channel already exists, trying to find it...');
          const existingChannels = await slackClient.conversations.list({
            types: 'public_channel'
          });

          const existingChannel = existingChannels.channels?.find(
            channel => channel.name === channelName
          );

          if (existingChannel && existingChannel.id) {
            console.log(`Found existing channel with ID: ${existingChannel.id}`);
            
            // Invite members to the existing channel
            if (memberEmails.length > 0) {
              console.log(`Attempting to invite ${memberEmails.length} members to existing channel ${existingChannel.id}`);
              for (const email of memberEmails) {
                await this.inviteMemberToChannel(existingChannel.id, email);
              }
            }

            return existingChannel.id;
          }
        }
        
        console.error('Channel creation error:', {
          error: createError.message,
          data: createError.data,
          stack: createError.stack
        });
        return SLACK_CHANNEL;
      }
    } catch (error) {
      console.error('Unexpected error in createProjectChannel:', error);
      return SLACK_CHANNEL;
    }
  },

  /**
   * Send a notification about new project creation to Slack
   */
  async notifyProjectCreation(project: Project): Promise<void> {
    try {
      console.log('Project creation notification for:', project.name);
      console.log('Project data:', JSON.stringify(project, null, 2));
      
      // Get project members (assuming project.members is an array of email addresses)
      const memberEmails = project.members || [];
      
      if (memberEmails.length > 0) {
        console.log('Found project members:', memberEmails);
      } else {
        console.log('No members specified for the project');
      }

      // Create channel and invite members
      const channelId = await this.createProjectChannel(project.name, memberEmails);
      console.log('Channel creation completed with ID:', channelId);

      // Create a list of milestone assignments
      const milestoneList = project.milestones
        ?.map(m => `• ${m.name}`)
        .join('\n') || '';

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

      // Add project members if any exist
      if (memberEmails.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Project Members:*\n${memberEmails.map(email => `• ${email}`).join('\n')}`
          }
        });
      }

      // Add milestones if any exist
      if (milestoneList) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Project Milestones:*\n${milestoneList}`
          }
        });
      }

      // Add project checklist
      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Project Setup Checklist:*\n' +
                  '☐ Regular meeting with the client\n' +
                  '☐ Do we have all access\n' +
                  '☐ Demo planning\n' +
                  '☐ MoM - Regular updates to the client\n' +
                  '☐ DoD (Definition of Done)\n' +
                  '☐ Risk assessment'
          }
        }
      );

      blocks.push({
        type: 'divider'
      });

      const message = {
        channel: channelId,
        text: `New project created: ${project.name}`,
        blocks
      };

      await slackClient.chat.postMessage(message);
      console.log('Project creation notification sent successfully');

      // Also send a notification to the default channel about the new project and its dedicated channel
      const channelInfo = await slackClient.conversations.info({ channel: channelId });
      const channelName = channelInfo.channel?.name || channelId;
      
      await slackClient.chat.postMessage({
        channel: SLACK_CHANNEL,
        text: `New project "${project.name}" has been created. Follow updates in <#${channelId}|${channelName}>`
      });
    } catch (error) {
      console.error('Error in project creation notification:', error);
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