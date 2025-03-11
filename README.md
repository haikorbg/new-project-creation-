# Linear Milestone Tracker

A platform that integrates with Linear to display projects and check for overdue milestones. This application allows you to:

- View all your Linear projects in one place
- Track milestones for each project
- Create new projects directly from the platform
- Upload Statement of Work (SoW) PDFs to auto-fill project details
- Automatically detect overdue milestones
- Receive alerts when milestones are overdue
- Filter to show only projects with overdue milestones
- Send Slack notifications for overdue milestones

## Features

- **Project Dashboard**: View all your Linear projects in a clean, organized interface
- **Project Creation**: Create new projects with milestones directly from the platform
- **SoW PDF Upload**: Extract project details from Statement of Work PDFs to auto-fill project creation forms
- **Milestone Tracking**: See all milestones for each project with their status and target dates
- **Overdue Detection**: Automatic detection and highlighting of overdue milestones
- **Weekly Checks**: Scheduled weekly checks for overdue milestones
- **In-Memory Storage**: All data is stored in memory for testing purposes (can be extended to use a database)
- **Slack Integration**: Automated Slack notifications for overdue milestones

## Testing Note

For testing purposes, this application generates mock milestone data for each project fetched from Linear. Approximately 30% of these milestones are marked as overdue to demonstrate the overdue detection functionality. In a production environment, you would replace this with actual milestone data from Linear.

### Milestone Implementation

Currently, the application creates mock milestones for projects. This is because Linear's API for creating milestones is not well-documented and requires specific permissions. In a production environment, you would need to:

1. Implement the actual milestone creation using Linear's GraphQL API
2. Ensure your API key has the necessary permissions to create milestones
3. Handle the appropriate error cases and edge conditions

The current implementation focuses on demonstrating the UI and workflow rather than the actual API integration for milestones.

## Project Creation

The application allows you to create new projects directly from the platform:

1. Click the "Create Project" button in the header
2. Fill in the project details:
   - Name (required)
   - Description
   - Start Date
   - End Date
   - State (Planned, Started, Paused, Completed, Canceled)
3. Add milestones to the project (optional):
   - Name
   - Description
   - Target Date
4. Click "Create Project" to submit

The new project will be created in Linear and will appear in the dashboard with mock milestones.

## Statement of Work (SoW) PDF Upload

The application allows you to upload a Statement of Work PDF to automatically extract project details:

1. Click the "Create Project" button in the header
2. In the "Upload Statement of Work (SoW)" section, click "Choose File" and select a PDF file
3. Click "Upload & Extract Data"
4. The application will parse the PDF and auto-fill the project creation form with:
   - Project name
   - Project description
   - Start and end dates
   - Milestones with names, descriptions, and target dates
5. Review the extracted information and make any necessary adjustments
6. Click "Create Project" to submit

The PDF parser is designed to extract information from a standard SoW format that includes:
- Project Name
- Project Description
- Project Dates (Start and End)
- Milestones with descriptions and due dates

## Slack Integration

The application sends two types of Slack notifications:

1. **Individual Milestone Alerts**: For each overdue milestone, a detailed message is sent containing:
   - Project name
   - Milestone name
   - Current status
   - Target date
   - Request for an update

2. **Daily Summary**: A daily summary of all overdue milestones across projects, including:
   - Total number of overdue milestones
   - Number of affected projects
   - Breakdown by project

Notifications are sent at most once every 24 hours to prevent notification fatigue.

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. The Linear API key and Slack credentials are already configured in the code for testing purposes
4. Start the application:
   ```
   npm start
   ```
5. Open your browser and navigate to `http://localhost:3000`

## Development

- Run in development mode with auto-reload:
  ```
  npm run dev
  ```
- Build the application:
  ```
  npm run build
  ```

## Technical Details

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js with Express
- **Linear Integration**: Using the Linear SDK
- **Slack Integration**: Using the Slack Web API
- **PDF Processing**: Using pdf-parse for text extraction
- **Data Storage**: In-memory (for testing purposes)

## Future Improvements

- Add database integration for persistent storage
- Implement user authentication
- Add email notifications for overdue milestones
- Create a more detailed milestone view
- Add project filtering and sorting options
- Add configurable notification schedules
- Support for multiple Slack channels
- Custom notification templates
- Implement actual milestone creation using Linear's GraphQL API
- Improve PDF parsing accuracy with machine learning 