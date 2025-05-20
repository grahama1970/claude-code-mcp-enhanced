#!/usr/bin/env node
/**
 * Parent task orchestration script for Claude Code MCP
 * 
 * This script creates a parent task that will orchestrate the execution of
 * child tasks using the boomerang pattern.
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// Set up configuration
const config = {
  mcpServerHost: 'localhost',
  mcpServerPort: 3000,
  taskFile: path.join(__dirname, 'generated_task.json'),
  resultsDir: path.join(__dirname, 'task_results')
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
 * Create a parent task
 */
async function createParentTask() {
  const taskData = {
    tool: 'execute_task',
    arguments: {
      taskId: `parent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      executionMode: 'sequential'
    }
  };
  
  try {
    const result = await mcpRequest('/api/v1/tools/execute', taskData);
    console.log('Parent task created:');
    console.log(JSON.stringify(result, null, 2));
    return result.taskId;
  } catch (err) {
    console.error('Failed to create parent task:', err.message);
    throw err;
  }
}

/**
 * Create child tasks for each subtask
 */
async function createChildTasks(parentTaskId, tasks) {
  const results = [];
  
  for (const task of tasks) {
    for (const subtask of task.subtasks) {
      const childTaskData = {
        tool: 'create_boomerang_task',
        arguments: {
          parentTaskId,
          description: subtask.title,
          prompt: subtask.prompt,
          returnMode: 'full'
        }
      };
      
      try {
        const result = await mcpRequest('/api/v1/tools/execute', childTaskData);
        console.log(`Child task created for ${subtask.title}:`);
        console.log(JSON.stringify(result, null, 2));
        results.push(result);
      } catch (err) {
        console.error(`Failed to create child task for ${subtask.title}:`, err.message);
      }
    }
  }
  
  return results;
}

/**
 * Poll for task status updates
 */
async function pollTaskStatus(parentTaskId, intervalMs = 5000, maxAttempts = 20) {
  console.log(`\nStarting to poll for parent task ${parentTaskId} status...`);
  
  let attempts = 0;
  let allComplete = false;
  
  while (attempts < maxAttempts && !allComplete) {
    try {
      const statusData = {
        tool: 'get_parent_task_results',
        arguments: {
          parentTaskId
        }
      };
      
      const result = await mcpRequest('/api/v1/tools/execute', statusData);
      console.log(`\nStatus update (attempt ${attempts + 1}/${maxAttempts}):`);
      console.log(JSON.stringify(result, null, 2));
      
      if (result.allComplete) {
        allComplete = true;
        console.log('\nAll tasks completed successfully!');
        return result;
      }
      
      // Wait for the next interval
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (err) {
      console.error(`Error polling task status (attempt ${attempts + 1}/${maxAttempts}):`, err.message);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
  }
  
  if (!allComplete) {
    console.log('\nMaximum polling attempts reached without task completion.');
  }
  
  // Try to get final status
  try {
    const statusData = {
      tool: 'get_parent_task_results',
      arguments: {
        parentTaskId
      }
    };
    
    return await mcpRequest('/api/v1/tools/execute', statusData);
  } catch (err) {
    console.error('Failed to get final task status:', err.message);
    return null;
  }
}

/**
 * Save results to file
 */
async function saveResults(parentTaskId, results) {
  if (!results) {
    return;
  }
  
  try {
    // Create results directory if it doesn't exist
    await fs.mkdir(config.resultsDir, { recursive: true });
    
    const resultsPath = path.join(config.resultsDir, `${parentTaskId}_results.json`);
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    
    console.log(`\nResults saved to ${resultsPath}`);
  } catch (err) {
    console.error('Failed to save results:', err.message);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Read task file
    const taskFileContent = await fs.readFile(config.taskFile, 'utf8');
    const tasks = JSON.parse(taskFileContent);
    
    console.log('Starting task orchestration...');
    console.log(`Found ${tasks.length} tasks with a total of ${tasks.reduce((count, task) => count + task.subtasks.length, 0)} subtasks`);
    
    // Create parent task
    const parentTaskId = await createParentTask();
    
    // Create child tasks
    await createChildTasks(parentTaskId, tasks);
    
    // Poll for status updates
    const finalResults = await pollTaskStatus(parentTaskId);
    
    // Save results
    await saveResults(parentTaskId, finalResults);
    
    console.log('\nTask orchestration completed!');
  } catch (err) {
    console.error('Error in main function:', err.message);
    process.exit(1);
  }
}

// Run the main function
main();