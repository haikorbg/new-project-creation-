document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const projectsContainer = document.getElementById('projectsContainer');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const overdueAlert = document.getElementById('overdueAlert');
  const refreshBtn = document.getElementById('refreshBtn');
  const lastUpdatedSpan = document.getElementById('lastUpdated');
  const showOverdueOnlyCheckbox = document.getElementById('showOverdueOnly');
  
  // Project creation elements
  const createProjectForm = document.getElementById('createProjectForm');
  const projectNameInput = document.getElementById('projectName');
  const projectDescriptionInput = document.getElementById('projectDescription');
  const projectStartDateInput = document.getElementById('projectStartDate');
  const projectEndDateInput = document.getElementById('projectEndDate');
  const projectStateSelect = document.getElementById('projectState');
  const milestonesContainer = document.getElementById('milestonesContainer');
  const addMilestoneBtn = document.getElementById('addMilestoneBtn');
  const submitProjectBtn = document.getElementById('submitProjectBtn');
  const createProjectModal = document.getElementById('createProjectModal');
  const milestoneTemplate = document.getElementById('milestoneTemplate');
  
  // SoW upload elements
  const sowUploadForm = document.getElementById('sowUploadForm');
  const sowFileInput = document.getElementById('sowFileInput');
  const uploadSowBtn = document.getElementById('uploadSowBtn');
  const sowUploadStatus = document.getElementById('sowUploadStatus');
  
  // Bootstrap modal instance
  let projectModal;
  if (typeof bootstrap !== 'undefined') {
    projectModal = new bootstrap.Modal(createProjectModal);
  }

  // State
  let projects = [];
  let showOverdueOnly = false;

  // Event listeners
  refreshBtn.addEventListener('click', refreshData);
  showOverdueOnlyCheckbox.addEventListener('change', (e) => {
    showOverdueOnly = e.target.checked;
    renderProjects();
  });
  
  // Project creation event listeners
  createProjectForm.addEventListener('submit', (e) => e.preventDefault());
  submitProjectBtn.addEventListener('click', submitProject);
  
  // SoW upload event listener
  uploadSowBtn.addEventListener('click', handleFileUpload);
  
  // Add event delegation for removing milestones
  milestonesContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-milestone')) {
      e.target.closest('.milestone-input').remove();
    }
  });
  
  // Add validation for date inputs
  projectStartDateInput.addEventListener('change', validateDates);
  projectEndDateInput.addEventListener('change', validateDates);

  // Initial data load
  loadProjects();

  // Functions
  async function loadProjects() {
    showLoading(true);
    hideError();
    hideSuccess();

    try {
      const response = await fetch('/api/projects');
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      projects = await response.json();
      updateLastUpdated();
      renderProjects();
      checkForOverdueMilestones();
    } catch (error) {
      console.error('Error loading projects:', error);
      showError('Error loading projects from Linear');
    } finally {
      showLoading(false);
    }
  }

  async function refreshData() {
    showLoading(true);
    hideError();
    hideSuccess();

    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      await loadProjects();
      showSuccess('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      showError('Error refreshing data from Linear');
    } finally {
      showLoading(false);
    }
  }

  function renderProjects() {
    projectsContainer.innerHTML = '';
    
    if (projects.length === 0) {
      projectsContainer.innerHTML = '<div class="alert alert-info">No projects found.</div>';
      return;
    }

    projects.forEach(project => {
      // Skip projects with no milestones if showing overdue only
      if (showOverdueOnly && !project.milestones.some(m => m.isOverdue)) {
        return;
      }

      const projectCard = document.createElement('div');
      projectCard.className = 'card project-card mb-4';
      
      const projectHeader = document.createElement('div');
      projectHeader.className = 'card-header project-header';
      
      const projectTitle = document.createElement('h5');
      projectTitle.className = 'mb-0';
      projectTitle.textContent = project.name;
      
      const projectState = document.createElement('span');
      projectState.className = `project-state state-${project.state.toLowerCase()}`;
      projectState.textContent = project.state;
      
      projectHeader.appendChild(projectTitle);
      projectHeader.appendChild(projectState);
      
      const projectBody = document.createElement('div');
      projectBody.className = 'card-body';
      
      if (project.description) {
        const projectDescription = document.createElement('p');
        projectDescription.className = 'card-text';
        projectDescription.textContent = project.description;
        projectBody.appendChild(projectDescription);
      }
      
      // Display project dates if available
      if (project.startDate || project.endDate) {
        const projectDates = document.createElement('div');
        projectDates.className = 'project-dates mb-3';
        
        if (project.startDate) {
          const startDate = document.createElement('span');
          startDate.className = 'me-3';
          startDate.innerHTML = `<strong>Start:</strong> ${formatDate(project.startDate)}`;
          projectDates.appendChild(startDate);
        }
        
        if (project.endDate) {
          const endDate = document.createElement('span');
          endDate.innerHTML = `<strong>End:</strong> ${formatDate(project.endDate)}`;
          projectDates.appendChild(endDate);
        }
        
        projectBody.appendChild(projectDates);
      }
      
      const milestonesTitle = document.createElement('h6');
      milestonesTitle.className = 'mt-3 mb-3';
      milestonesTitle.textContent = 'Milestones';
      projectBody.appendChild(milestonesTitle);
      
      if (project.milestones.length === 0) {
        const noMilestones = document.createElement('p');
        noMilestones.className = 'text-muted';
        noMilestones.textContent = 'No milestones found for this project.';
        projectBody.appendChild(noMilestones);
      } else {
        const milestonesList = document.createElement('div');
        milestonesList.className = 'milestones-list';
        
        project.milestones.forEach(milestone => {
          // Skip non-overdue milestones if showing overdue only
          if (showOverdueOnly && !milestone.isOverdue) {
            return;
          }

          const milestoneItem = document.createElement('div');
          milestoneItem.className = `milestone-item p-2 mb-2 ${milestone.isOverdue ? 'overdue' : ''}`;
          
          const milestoneName = document.createElement('div');
          milestoneName.className = 'd-flex justify-content-between align-items-center';
          
          const nameSpan = document.createElement('span');
          nameSpan.className = 'fw-bold';
          nameSpan.textContent = milestone.name;
          
          const statusBadge = document.createElement('span');
          statusBadge.className = `badge ${milestone.isOverdue ? 'badge-overdue' : 'bg-secondary'}`;
          statusBadge.textContent = milestone.isOverdue ? 'OVERDUE' : milestone.status;
          
          milestoneName.appendChild(nameSpan);
          milestoneName.appendChild(statusBadge);
          
          milestoneItem.appendChild(milestoneName);
          
          if (milestone.description) {
            const milestoneDesc = document.createElement('p');
            milestoneDesc.className = 'mb-1 mt-1';
            milestoneDesc.textContent = milestone.description;
            milestoneItem.appendChild(milestoneDesc);
          }
          
          if (milestone.targetDate) {
            const milestoneDate = document.createElement('div');
            milestoneDate.className = `milestone-date ${milestone.isOverdue ? 'overdue' : ''}`;
            milestoneDate.textContent = `Due Date: ${formatDate(milestone.targetDate)}`;
            milestoneItem.appendChild(milestoneDate);
          }

          // Create subtasks list
          if (milestone.subtasks && milestone.subtasks.length > 0) {
            const subtasksList = document.createElement('div');
            subtasksList.classList.add('subtasks-section');
            
            milestone.subtasks.forEach(subtask => {
              const subtaskItem = document.createElement('div');
              subtaskItem.classList.add('subtask-item');
              if (subtask.status === 'Done') {
                subtaskItem.classList.add('done');
              }
              
              const subtaskContent = document.createElement('div');
              subtaskContent.classList.add('subtask-content');
              
              const subtaskName = document.createElement('span');
              subtaskName.classList.add('subtask-name');
              subtaskName.textContent = subtask.name;
              subtaskContent.appendChild(subtaskName);
              
              const subtaskStatus = document.createElement('span');
              subtaskStatus.classList.add('subtask-status');
              // Use the exact Linear status
              const status = subtask.status || 'Backlog';
              const statusClass = status.toLowerCase().replace(/\s+/g, '-');
              subtaskStatus.classList.add(statusClass);
              subtaskStatus.textContent = status;
              subtaskContent.appendChild(subtaskStatus);
              
              subtaskItem.appendChild(subtaskContent);
              subtasksList.appendChild(subtaskItem);
            });
            
            milestoneItem.appendChild(subtasksList);
          }
          
          milestonesList.appendChild(milestoneItem);
        });
        
        projectBody.appendChild(milestonesList);
      }
      
      projectCard.appendChild(projectHeader);
      projectCard.appendChild(projectBody);
      projectsContainer.appendChild(projectCard);
    });
  }

  function checkForOverdueMilestones() {
    const hasOverdueMilestones = projects.some(project => 
      project.milestones.some(milestone => milestone.isOverdue)
    );
    
    if (hasOverdueMilestones) {
      overdueAlert.classList.remove('d-none');
    } else {
      overdueAlert.classList.add('d-none');
    }
  }

  function updateLastUpdated() {
    // Find the most recent project's lastUpdated date
    if (projects.length > 0 && projects[0].lastUpdated) {
      const date = new Date(projects[0].lastUpdated);
      lastUpdatedSpan.textContent = `Last updated: ${formatDateTime(date)}`;
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  function formatDateTime(date) {
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }

  function showLoading(show) {
    if (show) {
      loadingIndicator.classList.remove('d-none');
    } else {
      loadingIndicator.classList.add('d-none');
    }
  }

  function showError(message = 'An error occurred.') {
    errorMessage.textContent = message;
    errorMessage.classList.remove('d-none');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      hideError();
    }, 5000);
  }

  function hideError() {
    errorMessage.classList.add('d-none');
  }
  
  function showSuccess(message = 'Operation completed successfully.') {
    successMessage.textContent = message;
    successMessage.classList.remove('d-none');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      hideSuccess();
    }, 5000);
  }
  
  function hideSuccess() {
    successMessage.classList.add('d-none');
  }
  
  // Project creation functions
  function addMilestone() {
    const milestoneClone = document.importNode(milestoneTemplate.content, true);
    
    // Add event listener for the Add Subtask button
    const addSubtaskBtn = milestoneClone.querySelector('.add-subtask');
    if (addSubtaskBtn) {
        addSubtaskBtn.addEventListener('click', function() {
            const subtasksContainer = this.closest('.subtasks-section').querySelector('.subtasks-container');
            addSubtask(subtasksContainer);
        });
    }
    
    milestonesContainer.appendChild(milestoneClone);
  }
  
  function resetProjectForm() {
    projectNameInput.value = '';
    projectDescriptionInput.value = '';
    projectStartDateInput.value = '';
    projectEndDateInput.value = '';
    projectStateSelect.value = 'planned';
    milestonesContainer.innerHTML = '';
  }
  
  function validateDates() {
    const startDate = projectStartDateInput.value;
    const endDate = projectEndDateInput.value;
    
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      showError('End date cannot be earlier than start date');
      projectEndDateInput.value = '';
      return false;
    }
    
    return true;
  }
  
  // SoW upload functions
  async function handleFileUpload(event) {
    event.preventDefault();
    const fileInput = document.getElementById('sowFileInput');
    const file = fileInput.files[0];
    const statusElement = document.getElementById('sowUploadStatus');
    
    if (!file) {
      showSowUploadStatus('Please select a file first.', 'danger');
      return;
    }
    
    if (file.type !== 'application/pdf') {
      showSowUploadStatus('Please upload a PDF file.', 'danger');
      return;
    }
    
    const formData = new FormData();
    formData.append('sow', file);
    
    try {
      showSowUploadStatus('Uploading and processing file...', 'info');
      
      const response = await fetch('/api/upload-sow', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to process file');
      }
      
      // Clear existing milestones
      document.getElementById('milestonesContainer').innerHTML = '';
      
      // Populate form with extracted data
      document.getElementById('projectName').value = data.projectName || '';
      document.getElementById('projectDescription').value = data.description || '';
      document.getElementById('projectStartDate').value = data.startDate || '';
      document.getElementById('projectEndDate').value = data.endDate || '';
      
      // Add milestones with their subtasks
      if (data.milestones && Array.isArray(data.milestones)) {
        data.milestones.forEach(milestone => {
          addMilestone();
          const lastMilestone = document.querySelector('.milestone-input:last-child');
          
          if (lastMilestone) {
            lastMilestone.querySelector('.milestone-name').value = milestone.name || '';
            lastMilestone.querySelector('.milestone-target-date').value = milestone.targetDate || '';
            
            // Add subtasks
            if (milestone.subtasks && Array.isArray(milestone.subtasks)) {
                const subtasksContainer = lastMilestone.querySelector('.subtasks-container');
                
                milestone.subtasks.forEach(subtask => {
                    if (subtasksContainer) {
                        addSubtask(subtasksContainer);
                        const lastSubtask = subtasksContainer.querySelector('.subtask-input:last-child');
                        if (lastSubtask) {
                            const nameInput = lastSubtask.querySelector('.subtask-name');
                            if (nameInput) nameInput.value = subtask.name || '';
                        }
                    }
                });
            }
          }
        });
      }
      
      showSowUploadStatus('File processed successfully!', 'success');
    } catch (error) {
      console.error('Error:', error);
      showSowUploadStatus(error.message || 'Failed to process file. Please try again.', 'danger');
    }
  }
  
  function showSowUploadStatus(message, type) {
    sowUploadStatus.textContent = message;
    sowUploadStatus.className = `mt-2 alert alert-${type} small`;
    
    // Auto-hide after 10 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        sowUploadStatus.classList.add('d-none');
      }, 10000);
    }
  }
  
  function addSubtask(subtasksContainer) {
    const subtaskTemplate = document.getElementById('subtaskTemplate');
    const subtaskElement = subtaskTemplate.content.cloneNode(true);
    
    // Add event listener to remove button
    subtaskElement.querySelector('.remove-subtask').addEventListener('click', function() {
      this.closest('.subtask-input').remove();
    });
    
    subtasksContainer.appendChild(subtaskElement);
  }
  
  async function submitProject() {
    // Validate form
    if (!projectNameInput.value.trim()) {
      showError('Project name is required');
      return;
    }
    
    // Validate dates
    if (!validateDates()) {
      return;
    }
    
    // Collect milestone data
    const milestones = [];
    const milestoneInputs = milestonesContainer.querySelectorAll('.milestone-input');
    
    milestoneInputs.forEach(milestoneInput => {
      const nameInput = milestoneInput.querySelector('.milestone-name');
      const targetDateInput = milestoneInput.querySelector('.milestone-target-date');
      
      if (nameInput.value.trim()) {
        // Collect subtasks for this milestone
        const subtasks = [];
        const subtaskInputs = milestoneInput.querySelectorAll('.subtask-input');
        
        subtaskInputs.forEach(subtaskInput => {
          const subtaskName = subtaskInput.querySelector('.subtask-name').value.trim();
          
          if (subtaskName) {
            subtasks.push({
              name: subtaskName
            });
          }
        });
        
        milestones.push({
          name: nameInput.value.trim(),
          targetDate: targetDateInput.value || undefined,
          estimator: milestoneInput.querySelector('.milestone-estimator').value.trim() || undefined,
          subtasks
        });
      }
    });
    
    // Create project data
    const projectData = {
      name: projectNameInput.value.trim(),
      description: projectDescriptionInput.value.trim() || undefined,
      startDate: projectStartDateInput.value || undefined,
      endDate: projectEndDateInput.value || undefined,
      state: projectStateSelect.value,
      milestones
    };
    
    // Submit to API
    showLoading(true);
    hideError();
    hideSuccess();
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(projectData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Close modal and reset form
      if (projectModal) {
        projectModal.hide();
      }
      resetProjectForm();
      
      // Reset SoW upload form
      sowFileInput.value = '';
      sowUploadStatus.classList.add('d-none');
      
      // Refresh projects
      await loadProjects();
      
      showSuccess('Project created successfully');
    } catch (error) {
      console.error('Error creating project:', error);
      showError(error.message || 'Error creating project');
    } finally {
      showLoading(false);
    }
  }
}); 