import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
const pdfParse = require('pdf-parse');
import { CreateProjectInput } from './linearService';

export interface Subtask {
  name: string;
  description?: string;
}

export interface Milestone {
  name: string;
  description: string;
  targetDate?: string;
  subtasks: Subtask[];
}

export interface ProjectData {
  projectName: string;
  description: string;
  startDate?: string;
  endDate?: string;
  milestones: Milestone[];
}

// Interface for extracted project data from SoW PDF
export interface SoWProjectData {
  name: string;
  description: string;
  startDate?: string;
  endDate?: string;
  milestones: {
    name: string;
    description: string;
    targetDate?: string;
    subtasks: {
      name: string;
      description: string;
    }[];
  }[];
}

export async function extractProjectData(filePath: string): Promise<ProjectData> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const text = data.text;

  // Extract project name
  const projectNameMatch = text.match(/Project Name:\s*([^\n]+)/i);
  const projectName = projectNameMatch ? projectNameMatch[1].trim() : '';

  // Extract project description
  const descriptionMatch = text.match(/Project Description:\s*([^\n]+(?:\n(?!\s*Project Dates:)[^\n]+)*)/i);
  const description = descriptionMatch ? descriptionMatch[1].trim() : '';

  // Extract project dates
  const startDateMatch = text.match(/Start:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const endDateMatch = text.match(/End:\s*(\d{2}\/\d{2}\/\d{4})/i);

  const startDate = startDateMatch ? formatDate(startDateMatch[1]) : undefined;
  const endDate = endDateMatch ? formatDate(endDateMatch[1]) : undefined;

  // Extract milestones with their subtasks
  const milestones: Milestone[] = [];
  // Simplified milestone regex to capture everything between milestones
  const milestoneRegex = /Milestone \d+:\s*([^\n]+)(?:\s*Due Date:\s*(\d{2}\/\d{2}\/\d{4}))?([\s\S]*?)(?=Milestone \d+:|$)/gi;
  
  let milestoneMatch;
  while ((milestoneMatch = milestoneRegex.exec(text)) !== null) {
    const milestoneName = milestoneMatch[1].trim();
    const targetDate = milestoneMatch[2] ? formatDate(milestoneMatch[2]) : undefined;
    const milestoneContent = milestoneMatch[3] || '';

    console.log('=== Milestone Processing Debug ===');
    console.log(`Milestone: ${milestoneName}`);
    console.log('Full milestone content:', milestoneContent);

    // Find the subtasks section within the milestone content
    const subtasksSectionMatch = milestoneContent.match(/(?:Sub-tasks:|Sub-tasks|Subtasks|Tasks):([\s\S]*)/i);
    const subtasksText = subtasksSectionMatch ? subtasksSectionMatch[1].trim() : '';
    
    console.log('Extracted subtasks section:', subtasksText);
    console.log('=================================');

    // Extract subtasks
    const subtasks = extractSubtasks(subtasksText);

    milestones.push({
      name: milestoneName,
      description: '', // Description is not present in the PDF format
      targetDate,
      subtasks
    });
  }

  return {
    projectName,
    description,
    startDate,
    endDate,
    milestones
  };
}

function extractSubtasks(text: string): Subtask[] {
  const subtasks: Subtask[] = [];
  // Updated regex to match any kind of list marker
  const subtaskRegex = /(?:[-•*]\s*|\d+\.\s*)([^:\n]+)(?::\s*([^\n]+))?/g;
  
  console.log('=== Subtask Extraction Debug ===');
  console.log('Input text:', text);
  
  let match;
  while ((match = subtaskRegex.exec(text)) !== null) {
    const name = match[1]?.trim();
    const description = match[2]?.trim();
    
    console.log('Found subtask match:', { 
      full: match[0],
      name,
      description 
    });
    
    if (name) {
      subtasks.push({
        name,
        ...(description ? { description } : {})
      });
    }
  }
  
  console.log('Extracted subtasks:', subtasks);
  console.log('==============================');
  return subtasks;
}

function formatDate(dateStr: string): string {
  try {
    const [month, day, year] = dateStr.split('/').map(num => num.padStart(2, '0'));
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

const PdfService = {
  parseSoWPdf: extractProjectData,
  convertToLinearProjectInput(sowData: ProjectData) {
    console.log('Converting PDF data to Linear format. Input:', JSON.stringify(sowData, null, 2));
    const result = {
      name: sowData.projectName,
      description: sowData.description,
      startDate: sowData.startDate,
      endDate: sowData.endDate,
      milestones: sowData.milestones.map(milestone => {
        console.log(`Processing milestone ${milestone.name}, subtasks:`, milestone.subtasks);
        return {
          name: milestone.name,
          description: milestone.description,
          targetDate: milestone.targetDate,
          subtasks: milestone.subtasks.map(subtask => ({
            name: subtask.name,
            description: subtask.description
          }))
        };
      })
    };
    console.log('Converted data:', JSON.stringify(result, null, 2));
    return result;
  }
};

export default PdfService; 