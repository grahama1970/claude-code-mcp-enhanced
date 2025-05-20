#!/usr/bin/env node
/**
 * Task monitoring script for Claude Code MCP
 * 
 * This script monitors the execution of tasks by polling for updates
 * and displaying the results.
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

// Set up configuration
const config = {
  mcpServerHost: 'localhost',
  mcpServerPort: 3000,
  resultsDir: path.join(__dirname, 'task_results'),
  pollIntervalMs: 5000,
  maxAttempts: 20
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
 * Poll for parent task status updates
 */
async function pollParentTaskStatus(parentTaskId) {
  console.log(`\nStarting to poll for parent task ${parentTaskId} status...`);
  
  let attempts = 0;
  let allComplete = false;
  
  while (attempts < config.maxAttempts && !allComplete) {
    try {
      const statusData = {
        tool: 'get_parent_task_results',
        arguments: {
          parentTaskId
        }
      };
      
      const result = await mcpRequest('/api/v1/tools/execute', statusData);
      
      console.log(`\nStatus update (attempt ${attempts + 1}/${config.maxAttempts}):`);
      console.log(`Parent Task: ${parentTaskId}`);
      console.log(`Total child tasks: ${result.totalChildTasks || 0}`);
      console.log(`Completed child tasks: ${result.completedChildTasks || 0}`);
      console.log(`Pending child tasks: ${result.pendingChildTasks || 0}`);
      
      // Print child task status
      if (result.childResults && result.childResults.length > 0) {
        console.log('\nChild Task Status:');
        result.childResults.forEach((child, index) => {
          console.log(`  [${index + 1}] ${child.taskId} (${child.status}): ${child.description}`);
        });
      }
      
      // Check if all tasks are complete
      if (result.allComplete) {
        allComplete = true;
        console.log('\nAll tasks completed successfully!');
        
        // Save the results
        await saveResults(parentTaskId, result);
        
        return result;
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
    
    const finalResult = await mcpRequest('/api/v1/tools/execute', statusData);
    await saveResults(parentTaskId, finalResult);
    return finalResult;
  } catch (err) {
    console.error('Failed to get final task status:', err.message);
    return null;
  }
}

/**
 * Poll for child task status updates
 */
async function pollChildTaskStatus(taskId) {
  console.log(`\nStarting to poll for child task ${taskId} status...`);
  
  let attempts = 0;
  let isComplete = false;
  
  while (attempts < config.maxAttempts && !isComplete) {
    try {
      const statusData = {
        tool: 'task_status',
        arguments: {
          taskId
        }
      };
      
      const result = await mcpRequest('/api/v1/tools/execute', statusData);
      
      console.log(`\nStatus update (attempt ${attempts + 1}/${config.maxAttempts}):`);
      console.log(`Task: ${taskId}`);
      console.log(`Status: ${result.status || 'unknown'}`);
      console.log(`Progress: ${result.progress || 0}%`);
      
      // Check if task is complete
      if (result.status === 'completed') {
        isComplete = true;
        console.log('\nTask completed successfully!');
        
        // Save the results
        await saveResults(taskId, result);
        
        return result;
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
  
  if (!isComplete) {
    console.log('\nMaximum polling attempts reached without task completion.');
  }
  
  // Try to get final status
  try {
    const statusData = {
      tool: 'task_status',
      arguments: {
        taskId
      }
    };
    
    const finalResult = await mcpRequest('/api/v1/tools/execute', statusData);
    await saveResults(taskId, finalResult);
    return finalResult;
  } catch (err) {
    console.error('Failed to get final task status:', err.message);
    return null;
  }
}

/**
 * Save results to file
 */
async function saveResults(taskId, results) {
  if (!results) {
    return;
  }
  
  try {
    // Create results directory if it doesn't exist
    await fs.mkdir(config.resultsDir, { recursive: true });
    
    const resultsPath = path.join(config.resultsDir, `${taskId}_results.json`);
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
  // Check if task ID was provided
  if (process.argv.length < 3) {
    console.log('Usage: node monitor_tasks.js <taskId> [--parent]');
    console.log('  --parent: Monitor a parent task (default is to monitor a child task)');
    process.exit(1);
  }
  
  const taskId = process.argv[2];
  const isParentTask = process.argv.includes('--parent');
  
  try {
    console.log(`Starting to monitor ${isParentTask ? 'parent' : 'child'} task: ${taskId}`);
    
    if (isParentTask) {
      await pollParentTaskStatus(taskId);
    } else {
      await pollChildTaskStatus(taskId);
    }
    
    console.log('\nTask monitoring completed!');
  } catch (err) {
    console.error('Error in main function:', err.message);
    process.exit(1);
  }
}

// Run the main function
main();