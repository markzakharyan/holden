import { AuthState } from "../types";

/**
 * Renders the dashboard page for authenticated users
 * @param authState The current authentication state
 * @returns HTML string for the dashboard
 */
export const renderDashboard = (authState: AuthState): string => {
  const { user } = authState;
  
  if (!user) {
    return "";
  }

  return `
    <div class="container" style="max-width: 700px;">
      <h2>GOLD Schedule → Google Calendar</h2>
      
      <div class="form-group">
        <label for="quarter-type">Select Quarter:</label>
        <select 
          id="quarter-type" 
          class="form-control" 
          style="padding: 0.5rem; width: 100%; max-width: 300px; border: 1px solid #444; border-radius: 4px; background-color: #2a2a2a; color: white;"
        >
          <option value="current">Current Quarter</option>
          <option value="next">Next Quarter</option>
        </select>
        <p style="font-size: 0.8rem; margin-top: 0.5rem;">Summer quarters are 6 weeks, others are 10 weeks.</p>
      </div>
      
      <div id="upload-container" class="file-upload">
        <input type="file" id="schedule-upload" accept=".html,.htm,text/html,text/plain" style="display: none;">
        <p>Drop your GOLD schedule HTML file here or click to upload</p>
        <p style="font-size: 0.8rem; margin-top: 0.5rem;">(Save your GOLD schedule page as HTML)</p>
      </div>
      
      <div id="file-info-container" style="display: none; margin-top: 1rem;">
        <h3>File Uploaded:</h3>
        <div id="file-info" style="padding: 10px; border: 1px solid #444; border-radius: 4px;"></div>
      </div>
      
      <button id="submit-btn" class="login-button" style="margin-top: 1rem; display: none;">
        Add to Google Calendar
      </button>
      
      <div id="message-container" style="margin-top: 1rem;"></div>
    </div>
  `;
};

/**
 * Sets up event listeners for the dashboard
 */
export const setupDashboardEvents = (): void => {
  const uploadContainer = document.getElementById('upload-container');
  const fileInput = document.getElementById('schedule-upload') as HTMLInputElement;
  const fileInfoContainer = document.getElementById('file-info-container');
  const fileInfoElement = document.getElementById('file-info');
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
  const quarterTypeSelect = document.getElementById('quarter-type') as HTMLSelectElement;
  const messageContainer = document.getElementById('message-container');
  
  if (!uploadContainer || !fileInput || !fileInfoContainer || !fileInfoElement || !submitBtn || !quarterTypeSelect || !messageContainer) {
    console.error('One or more dashboard elements not found');
    return;
  }

  let selectedFile: File | null = null;
  
  // Handle file upload via click
  uploadContainer.addEventListener('click', () => {
    console.log('Upload container clicked');
    fileInput.click();
  });
  
  // Handle drag and drop
  uploadContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadContainer.style.borderColor = '#666';
  });
  
  uploadContainer.addEventListener('dragleave', () => {
    uploadContainer.style.borderColor = '#444';
  });
  
  uploadContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadContainer.style.borderColor = '#444';
    
    if (e.dataTransfer?.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  
  // Handle file selection
  fileInput.addEventListener('change', () => {
    console.log('File input changed', fileInput.files);
    if (fileInput.files && fileInput.files.length) {
      handleFile(fileInput.files[0]);
    }
  });
  
  // Process selected file
  function handleFile(file: File) {
    console.log('Handling file:', file.name, file.type);
    const isHtmlFile = 
      file.type === 'text/html' || 
      file.type === 'text/plain' || 
      file.name.endsWith('.html') || 
      file.name.endsWith('.htm');
    
    if (!isHtmlFile) {
      showMessage({ type: 'error', text: 'Please select an HTML file from your GOLD schedule.' });
      return;
    }
    
    selectedFile = file;
    if (fileInfoElement && fileInfoContainer && submitBtn) {
      fileInfoElement.textContent = `Filename: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
      fileInfoContainer.style.display = 'block';
      submitBtn.style.display = 'inline-block';
    }
  }
  
  // Handle form submission
  submitBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      showMessage({ type: 'error', text: 'Please upload your GOLD schedule HTML file.' });
      return;
    }
    
    const quarterType = quarterTypeSelect.value;
    if (!quarterType) {
      showMessage({ type: 'error', text: 'Please select the quarter type.' });
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    try {
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('htmlFile', selectedFile);
      formData.append('quarterType', quarterType);
      
      const response = await fetch("/api/upload-schedule", {
        method: "POST",
        body: formData,
      });
    
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload schedule");
      }
      
      const result = await response.json();
      showMessage({ 
        type: 'success', 
        text: result.message || 'Successfully added courses to your Google Calendar.' 
      });
      
      // Clear form after success
      if (fileInfoContainer && submitBtn && fileInput) {
        fileInfoContainer.style.display = 'none';
        submitBtn.style.display = 'none';
        selectedFile = null;
        fileInput.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      showMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to process your schedule. Please try again.' 
      });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add to Google Calendar';
    }
  });
  
  // Display status messages
  function showMessage(message: { type: string; text: string }) {
    if (messageContainer) {
      messageContainer.innerHTML = `
        <div class="message ${message.type}">
          ${message.text}
        </div>
      `;
    }
  }
};