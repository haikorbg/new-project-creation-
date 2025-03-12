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
  const projectMembersInput = document.getElementById('projectMembers');
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
  let autoRefreshInterval = null;
  const AUTO_REFRESH_INTERVAL = 1 * 60 * 1000; // 1 minute in milliseconds for testing

  // Project date tracking
  const PROJECT_DATES_KEY = 'projectDatesTracking';
  
  // Add auto-refresh toggle functionality
  const autoRefreshCheckbox = document.createElement('div');
  autoRefreshCheckbox.className = 'form-check mb-3';
  autoRefreshCheckbox.innerHTML = `
    <input class="form-check-input" type="checkbox" id="autoRefreshToggle">
    <label class="form-check-label" for="autoRefreshToggle">
      Auto-refresh every minute
    </label>
  `;
  refreshBtn.parentNode.insertBefore(autoRefreshCheckbox, refreshBtn.nextSibling);

  document.getElementById('autoRefreshToggle').addEventListener('change', function(e) {
    if (e.target.checked) {
      startAutoRefresh();
      showSuccess('Auto-refresh enabled - refreshing every minute');
    } else {
      stopAutoRefresh();
      showSuccess('Auto-refresh disabled');
    }
  });

  function startAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(refreshData, AUTO_REFRESH_INTERVAL);
    console.log('Auto-refresh started');
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
      console.log('Auto-refresh stopped');
    }
  }

  function getProjectTracking() {
    const tracking = localStorage.getItem(PROJECT_DATES_KEY);
    if (!tracking) {
      const initialTracking = {};
      localStorage.setItem(PROJECT_DATES_KEY, JSON.stringify(initialTracking));
      return initialTracking;
    }
    try {
      return JSON.parse(tracking) || {};
    } catch (e) {
      console.error('Error parsing project tracking data:', e);
      return {};
    }
  }

  function saveProjectTracking(projectId, projectName, milestones) {
    const tracking = getProjectTracking();
    tracking[projectId] = {
      projectName,
      milestones: milestones.map(m => ({
        id: m.id,
        name: m.name,
        initialTargetDate: normalizeDate(m.targetDate)
      })),
      dateSetAt: new Date().toISOString(),
      reminderSent: false,
      dateChangeNotified: false
    };
    localStorage.setItem(PROJECT_DATES_KEY, JSON.stringify(tracking));
  }

  function checkProjectDates() {
    const tracking = getProjectTracking();
    const now = new Date();
    
    console.log('=== Starting Date Reminder Check ===');
    console.log('Current tracking data:', JSON.stringify(tracking, null, 2));
    console.log('Current projects:', JSON.stringify(projects, null, 2));
    
    projects.forEach(project => {
      console.log(`\nChecking project: ${project.name} (ID: ${project.id})`);
      const tracked = tracking[project.id];
      
      if (!tracked) {
        console.log('No tracking data found for this project');
        // Save tracking data if it doesn't exist
        saveProjectTracking(
          project.id,
          project.name,
          project.milestones.map(m => ({
            id: m.id,
            name: m.name,
            targetDate: m.targetDate
          }))
        );
        console.log('Created new tracking data for project');
        return;
      }
      
      console.log('Tracked data:', JSON.stringify(tracked, null, 2));
      
      const dateSetAt = new Date(tracked.dateSetAt);
      const minutesSinceCreation = (now - dateSetAt) / (1000 * 60);
      
      console.log('Time since creation:', {
        dateSetAt: dateSetAt.toISOString(),
        minutesSinceCreation,
        hasBeenTwoMinutes: minutesSinceCreation >= 2
      });
      
      // First, check if any milestone dates have changed from their initial values
      let hasChangedDates = false;
      const changedMilestones = [];

      project.milestones.forEach(currentMilestone => {
        const trackedMilestone = tracked.milestones.find(m => m.id === currentMilestone.id);
        
        console.log('Checking milestone:', {
          name: currentMilestone.name,
          currentDate: currentMilestone.targetDate,
          trackedDate: trackedMilestone?.initialTargetDate,
          hasChanged: trackedMilestone && normalizeDate(currentMilestone.targetDate) !== normalizeDate(trackedMilestone.initialTargetDate)
        });
        
        if (trackedMilestone && normalizeDate(currentMilestone.targetDate) !== normalizeDate(trackedMilestone.initialTargetDate)) {
          hasChangedDates = true;
          changedMilestones.push({
            name: currentMilestone.name,
            targetDate: currentMilestone.targetDate,
            previousDate: trackedMilestone.initialTargetDate
          });
        }
      });

      // If any dates have changed and we haven't notified about changes yet
      if (hasChangedDates && !tracked.dateChangeNotified) {
        console.log('Milestone dates changed, sending notification:', {
          projectName: project.name,
          changedMilestones: changedMilestones,
          notifyingUser: 'bbudinov@appolica.com'
        });
        
        (async () => {
          try {
            const notificationData = {
              projectId: project.id,
              projectName: project.name,
              members: ['bbudinov@appolica.com'],
              milestones: changedMilestones,
              isChangeNotification: true,
              slackTag: true,
              slackEmail: 'bbudinov@appolica.com',
              message: `Milestone dates have been changed in project "${project.name}". Please review the changes.`,
              changes: changedMilestones.map(m => `${m.name}: ${formatDate(m.previousDate)} → ${formatDate(m.targetDate)}`).join('\n')
            };

            console.log('Sending notification with data:', notificationData);

            const response = await fetch('/api/notify/dates-reminder', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(notificationData)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
            }

            const result = await response.text();
            console.log('Change notification sent successfully:', result);

            // Update tracking data with new dates and mark as notified
            const updatedTracking = getProjectTracking();
            if (updatedTracking[project.id]) {
              changedMilestones.forEach(changed => {
                const milestoneToUpdate = updatedTracking[project.id].milestones.find(m => m.name === changed.name);
                if (milestoneToUpdate) {
                  milestoneToUpdate.initialTargetDate = changed.targetDate;
                }
              });
              updatedTracking[project.id].dateChangeNotified = true;
              localStorage.setItem(PROJECT_DATES_KEY, JSON.stringify(updatedTracking));
            }
          } catch (error) {
            console.error('Error sending change notification:', {
              error: error.message,
              stack: error.stack,
              projectName: project.name,
              milestones: changedMilestones
            });
          }
        })();
      }
      // If no dates have changed and enough time has passed, send initial reminder
      else if (!hasChangedDates && minutesSinceCreation >= 2 && !tracked.reminderSent) {
        console.log('No date changes detected, sending reminder for unchanged dates');
        fetch('/api/notify/dates-reminder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            projectId: project.id,
            projectName: project.name,
            members: project.members || [],
            milestones: project.milestones.map(m => ({
              name: m.name,
              targetDate: m.targetDate
            })),
            isChangeNotification: false
          })
        }).then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.text();
        }).then(result => {
          console.log('Reminder sent successfully for unchanged dates');
          const updatedTracking = getProjectTracking();
          if (updatedTracking[project.id]) {
            updatedTracking[project.id].reminderSent = true;
            localStorage.setItem(PROJECT_DATES_KEY, JSON.stringify(updatedTracking));
          }
        }).catch(error => {
          console.error('Error sending reminder:', error);
        });
      } else {
        console.log('No action needed:', {
          projectName: project.name,
          hasChangedDates,
          minutesSinceCreation,
          reminderAlreadySent: tracked.reminderSent,
          dateChangeNotified: tracked.dateChangeNotified
        });
      }
    });
    
    console.log('=== Date Reminder Check Complete ===');
  }

  // Add these helper functions before checkProjectDates
  function calculateMilestoneProgress(milestone) {
    if (!milestone.subtasks || milestone.subtasks.length === 0) {
      return 0;
    }
    
    const completedTasks = milestone.subtasks.filter(task => task.status === 'Done').length;
    return (completedTasks / milestone.subtasks.length) * 100;
  }

  function isMilestoneDueSoon(targetDate) {
    if (!targetDate) return false;
    
    const dueDate = new Date(normalizeDate(targetDate));
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    return daysUntilDue <= 10 && daysUntilDue >= 0;
  }

  function checkMilestoneProgress() {
    console.log('=== Starting Milestone Progress Check ===');
    
    projects.forEach(project => {
      project.milestones.forEach(milestone => {
        if (isMilestoneDueSoon(milestone.targetDate)) {
          const progress = calculateMilestoneProgress(milestone);
          const isAtRisk = progress < 70;
          
          console.log('Milestone progress check:', {
            projectName: project.name,
            milestoneName: milestone.name,
            targetDate: milestone.targetDate,
            progress: progress.toFixed(1) + '%',
            isAtRisk
          });

          // Send notification about milestone progress
          (async () => {
            try {
              const notificationData = {
                projectId: project.id,
                projectName: project.name,
                milestone: {
                  name: milestone.name,
                  targetDate: milestone.targetDate,
                  progress: progress.toFixed(1),
                  isAtRisk
                },
                isProgressNotification: true,
                message: `🎯 Milestone Progress Update for "${project.name}"\n\n` +
                        `📌 Milestone: ${milestone.name}\n` +
                        `📅 Due Date: ${formatDate(milestone.targetDate)}\n` +
                        `📊 Current Progress: ${progress.toFixed(1)}%\n` +
                        `${isAtRisk ? '⚠️ Status: AT RISK - Progress below 70%' : '✅ Status: On Track'}`
              };

              console.log('Sending progress notification:', notificationData);

              const response = await fetch('/api/notify/milestone-progress', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(notificationData)
              });

              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
              }

              const result = await response.text();
              console.log('Progress notification sent successfully:', result);
            } catch (error) {
              console.error('Error sending progress notification:', error);
            }
          })();
        }
      });
    });
    
    console.log('=== Milestone Progress Check Complete ===');
  }

  // Event listeners
  refreshBtn.addEventListener('click', refreshData);
  showOverdueOnlyCheckbox.addEventListener('change', (e) => {
    showOverdueOnly = e.target.checked;
    renderProjects();
  });
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
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
      console.log('Loading projects...');
      const response = await fetch('/api/projects');
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      projects = await response.json();
      console.log('Projects loaded:', projects);
      
      updateLastUpdated();
      renderProjects();
      checkForOverdueMilestones();
      checkProjectDates();
      
      // Add progress check after loading projects
      console.log('Checking milestone progress...');
      checkMilestoneProgress();
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
      console.log('Refreshing data...');
      const response = await fetch('/api/refresh', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      console.log('Data refreshed, loading updated projects...');
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
            
            // Add progress information
            const progress = calculateMilestoneProgress(milestone);
            const progressInfo = document.createElement('div');
            progressInfo.className = 'milestone-progress';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress';
            progressBar.innerHTML = `
              <div class="progress-bar ${progress < 70 ? 'bg-warning' : 'bg-success'}" 
                   role="progressbar" 
                   style="width: ${progress}%" 
                   aria-valuenow="${progress}" 
                   aria-valuemin="0" 
                   aria-valuemax="100">
                ${progress.toFixed(1)}%
              </div>
            `;
            
            if (isMilestoneDueSoon(milestone.targetDate) && progress < 70) {
              const riskBadge = document.createElement('span');
              riskBadge.className = 'badge bg-danger ms-2';
              riskBadge.textContent = 'AT RISK';
              progressInfo.appendChild(riskBadge);
            }
            
            progressInfo.appendChild(progressBar);
            milestoneItem.appendChild(milestoneDate);
            milestoneItem.appendChild(progressInfo);
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
    if (!dateString) return '';
    // First normalize the date to ensure consistent format
    const normalizedDate = normalizeDate(dateString);
    const date = new Date(normalizedDate);
    return date.toLocaleDateString();
  }

  function formatDateTime(date) {
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }

  function normalizeDate(dateString) {
    if (!dateString) return '';
    try {
      // Handle European format (DD/MM/YYYY)
      if (dateString.includes('/')) {
        const [day, month, year] = dateString.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      // Handle ISO format (YYYY-MM-DD)
      return dateString;
    } catch (error) {
      console.error('Error normalizing date:', error);
      return dateString;
    }
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
    projectMembersInput.value = '';
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
    
    // Parse members
    const members = projectMembersInput.value
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
    
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
      members,
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
      
      // Track the new project's milestone dates
      saveProjectTracking(
        result.id,
        result.name || projectData.name,
        projectData.milestones.map(m => ({
          id: m.id || `temp-${Date.now()}`,
          name: m.name,
          targetDate: m.targetDate
        }))
      );
      
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