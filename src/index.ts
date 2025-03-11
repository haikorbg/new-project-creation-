import express, { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import LinearService from './services/linearService';
import PdfService, { ProjectData, Milestone, Subtask } from './services/pdfService';
import dotenv from 'dotenv';

dotenv.config();

// Debug log to check environment variables
console.log('Environment check:');
console.log('LINEAR_API_KEY exists:', !!process.env.LINEAR_API_KEY);
console.log('LINEAR_API_KEY length:', process.env.LINEAR_API_KEY?.length);

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept only PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoint to get all projects
app.get('/api/projects', async (req: Request, res: Response) => {
  try {
    const projects = await LinearService.getProjects();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// API endpoint to check for overdue milestones
app.get('/api/overdue-milestones', async (req: Request, res: Response) => {
  try {
    const overdueMilestones = await LinearService.checkOverdueMilestones();
    res.json(overdueMilestones);
  } catch (error) {
    console.error('Error checking overdue milestones:', error);
    res.status(500).json({ error: 'Failed to check overdue milestones' });
  }
});

// API endpoint to refresh data from Linear
app.post('/api/refresh', async (req: Request, res: Response) => {
  try {
    const projects = await LinearService.fetchProjects();
    res.json({ 
      success: true, 
      message: 'Data refreshed successfully', 
      lastUpdated: LinearService.getLastUpdated() 
    });
  } catch (error) {
    console.error('Error refreshing data:', error);
    res.status(500).json({ error: 'Failed to refresh data' });
  }
});

// API endpoint to create a new project
app.post('/api/projects', async (req: Request, res: Response) => {
  try {
    const projectInput = req.body;
    
    if (!projectInput.name) {
      return res.status(400).json({ 
        success: false,
        error: 'Project name is required' 
      });
    }

    console.log('Creating project with input:', JSON.stringify(projectInput, null, 2));
    
    const project = await LinearService.createProject(projectInput);
    
    if (!project) {
      throw new Error('Failed to create project in Linear');
    }
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project'
    });
  }
});

// API endpoint to upload and parse SoW PDF
app.post('/api/upload-sow', upload.single('sow'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    const projectData = await PdfService.parseSoWPdf(req.file.path);

    // Clean up the uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error('Error deleting uploaded file:', err);
      }
    });

    if (!projectData.projectName) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract project data from PDF'
      });
    }

    res.json({
      success: true,
      projectName: projectData.projectName,
      description: projectData.description,
      startDate: projectData.startDate,
      endDate: projectData.endDate,
      milestones: projectData.milestones.map((milestone) => ({
        name: milestone.name,
        description: milestone.description,
        targetDate: milestone.targetDate,
        subtasks: milestone.subtasks.map((subtask) => ({
          name: subtask.name,
          description: subtask.description
        }))
      }))
    });
  } catch (error) {
    // Clean up the uploaded file in case of error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error('Error deleting uploaded file:', err);
        }
      });
    }

    console.error('Error processing PDF:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process PDF file' 
    });
  }
});

// Serve the main HTML file for any other route
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the application`);
});

// Schedule weekly check for overdue milestones
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
setInterval(async () => {
  try {
    console.log('Running scheduled check for overdue milestones...');
    await LinearService.fetchProjects();
    await LinearService.checkAndNotifyOverdueMilestones();
  } catch (error) {
    console.error('Error in scheduled check:', error);
  }
}, WEEK_IN_MS);

// For testing purposes, also run an immediate check
(async () => {
  try {
    console.log('Running initial check for overdue milestones...');
    await LinearService.fetchProjects();
    await LinearService.checkAndNotifyOverdueMilestones();
  } catch (error) {
    console.error('Error in initial check:', error);
  }
})(); 