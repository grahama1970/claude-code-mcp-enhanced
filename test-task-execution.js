#!/usr/bin/env node
/**
 * Test script for Claude Code MCP task execution
 * 
 * This script reads the tasks from docs/tasks/004_task_execution_modes.md
 * and executes them using the Claude Code MCP server.
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// Set up configuration
const config = {
  mcpServerHost: 'localhost',
  mcpServerPort: 3000,
  taskFile: path.join(__dirname, 'docs', 'tasks', '004_task_execution_modes.md'),
  pollIntervalMs: 5000,
  maxAttempts: 30
};

/**
 * Make a POST request to the MCP server
 */
async function mcpRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: config.mcpServerHost,
      port: config.mcpServerPort,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(responseData);
            resolve(result);
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`));
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Convert markdown task file to JSON format
 */
async function convertTaskMarkdown(markdownPath) {
  const taskData = {
    tool: 'convert_task_markdown',
    arguments: {
      markdownPath
    }
  };
  
  try {
    console.log(`Converting task markdown file: ${markdownPath}`);
    const result = await mcpRequest('/mcp/tool', taskData);
    console.log('Conversion successful!');
    return result;
  } catch (err) {
    console.error('Failed to convert task markdown:', err.message);
    throw err;
  }
}

/**
 * Execute a task with the specified execution mode
 */
async function executeTask(taskId, executionMode = 'sequential') {
  const taskData = {
    tool: 'execute_task',
    arguments: {
      taskId,
      executionMode
    }
  };
  
  try {
    console.log(`Executing task ${taskId} in ${executionMode} mode...`);
    const result = await mcpRequest('/mcp/tool', taskData);
    console.log(`Task execution started. Background task ID: ${result.taskData?.task_id || 'unknown'}`);
    return result;
  } catch (err) {
    console.error(`Failed to execute task ${taskId}:`, err.message);
    throw err;
  }
}

/**
 * Check the status of a task
 */
async function checkTaskStatus(taskId) {
  const statusData = {
    tool: 'task_status',
    arguments: {
      taskId
    }
  };
  
  try {
    const result = await mcpRequest('/mcp/tool', statusData);
    return result;
  } catch (err) {
    console.error(`Failed to check status for task ${taskId}:`, err.message);
    throw err;
  }
}

/**
 * Poll for task status until completion or timeout
 */
async function pollTaskStatus(taskId, expectedStatus = 'completed') {
  console.log(`\nPolling for status of task ${taskId}...`);
  
  let attempts = 0;
  let currentStatus = 'unknown';
  
  while (attempts < config.maxAttempts && currentStatus !== expectedStatus) {
    try {
      const statusResult = await checkTaskStatus(taskId);
      currentStatus = statusResult.status;
      const progress = statusResult.progress || 0;
      
      console.log(`\nStatus update (attempt ${attempts + 1}/${config.maxAttempts}):`);
      console.log(`Task: ${taskId}`);
      console.log(`Status: ${currentStatus}`);
      console.log(`Progress: ${progress}%`);
      
      if (currentStatus === expectedStatus) {
        console.log(`\nTask ${taskId} ${currentStatus}!`);
        return statusResult;
      }
      
      // Wait for the next interval
      await new Promise(resolve => setTimeout(resolve, config.pollIntervalMs));
      attempts++;
    } catch (err) {
      console.error(`Error polling task status (attempt ${attempts + 1}/${config.maxAttempts}):`, err.message);
      await new Promise(resolve => setTimeout(resolve, config.pollIntervalMs));
      attempts++;
    }
  }
  
  if (currentStatus !== expectedStatus) {
    console.log(`\nMaximum polling attempts reached. Task ${taskId} status: ${currentStatus}`);
  }
  
  // Try to get final status
  try {
    return await checkTaskStatus(taskId);
  } catch (err) {
    console.error(`Failed to get final status for task ${taskId}:`, err.message);
    return { status: currentStatus, progress: 0 };
  }
}

/**
 * Extract tasks from the markdown content
 */
function extractTasksFromMarkdown(markdownContent) {
  const tasks = [];
  
  // Match task headings
  const taskPattern = /### Task (\d+): (.+) ⏳ Not Started/g;
  let match;
  
  while ((match = taskPattern.exec(markdownContent)) !== null) {
    const taskNumber = match[1];
    const taskTitle = match[2];
    
    // Find the description and steps
    const taskSectionStart = match.index;
    const nextTaskStart = markdownContent.indexOf('### Task', taskSectionStart + 1);
    const taskSectionEnd = nextTaskStart !== -1 ? nextTaskStart : markdownContent.length;
    const taskSection = markdownContent.substring(taskSectionStart, taskSectionEnd);
    
    // Extract execution mode
    let executionMode = 'sequential'; // Default
    if (taskTitle.includes('Parallel')) {
      executionMode = 'parallel';
    } else if (taskTitle.includes('Mixed Mode')) {
      executionMode = 'mixed';
    }
    
    // Extract description
    const descriptionMatch = /\*\*Description\*\*: (.+)/i.exec(taskSection);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    
    // Extract steps
    const steps = [];
    const stepPattern = /- \[ \] (.*?)$/gm;
    let stepMatch;
    
    while ((stepMatch = stepPattern.exec(taskSection)) !== null) {
      steps.push(stepMatch[1].trim());
    }
    
    tasks.push({
      id: `task_${taskNumber}_${taskTitle.toLowerCase().replace(/\s+/g, '_')}`,
      number: taskNumber,
      title: taskTitle,
      description,
      executionMode,
      steps
    });
  }
  
  return tasks;
}

/**
 * Main function
 */
async function main() {
  try {
    // Read the task markdown file
    console.log(`Reading task file: ${config.taskFile}`);
    const markdownContent = await fs.readFile(config.taskFile, 'utf8');
    
    // Extract tasks from markdown
    const tasks = extractTasksFromMarkdown(markdownContent);
    console.log(`\nFound ${tasks.length} tasks:`);
    tasks.forEach(task => {
      console.log(`- Task ${task.number}: ${task.title} (${task.executionMode} mode, ${task.steps.length} steps)`);
    });
    
    // Try to convert the task file using the MCP convert_task_markdown tool
    try {
      await convertTaskMarkdown(config.taskFile);
    } catch (err) {
      console.log('Using extracted tasks instead of conversion tool due to error.');
    }
    
    // Execute each task
    for (const task of tasks) {
      console.log(`\n========================================================`);
      console.log(`Starting Task ${task.number}: ${task.title}`);
      console.log(`Execution Mode: ${task.executionMode}`);
      console.log(`Steps: ${task.steps.length}`);
      console.log(`========================================================\n`);
      
      // Execute the task
      const executionResult = await executeTask(task.id, task.executionMode);
      
      // Get the background task ID
      const backgroundTaskId = executionResult.taskData?.task_id;
      
      if (backgroundTaskId) {
        // Poll for status updates
        await pollTaskStatus(backgroundTaskId);
      } else {
        console.log('No background task ID returned. Cannot poll for status.');
      }
      
      console.log(`\nTask ${task.number} processing complete!\n`);
      
      // Wait a bit before starting the next task
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\nAll tasks processed successfully!');
  } catch (err) {
    console.error('Error in main function:', err);
    process.exit(1);
  }
}

// Run the main function
main();