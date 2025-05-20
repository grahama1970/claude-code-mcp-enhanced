#!/usr/bin/env node
/**
 * Execution Modes Demo for Claude Code MCP
 * 
 * This script demonstrates task execution modes by running tasks
 * from the execution_modes_tasks.json file.
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// Set up configuration
const config = {
  mcpServerHost: 'localhost',
  mcpServerPort: 3000,
  taskFile: path.join(__dirname, 'execution_modes_tasks.json'),
  resultsDir: path.join(__dirname, 'task_results'),
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
 * Create a parent task
 */
async function createParentTask(taskId, executionMode = 'sequential') {
  const taskData = {
    tool: 'execute_task',
    arguments: {
      taskId,
      executionMode
    }
  };
  
  try {
    const result = await mcpRequest('/mcp/tool', taskData);
    console.log('Parent task created:');
    console.log(JSON.stringify(result, null, 2));
    return taskId;
  } catch (err) {
    console.error('Failed to create parent task:', err.message);
    throw err;
  }
}

/**
 * Create child tasks for each subtask
 */
async function createChildTasks(parentTaskId, task) {
  const results = [];
  
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
      const result = await mcpRequest('/mcp/tool', childTaskData);
      console.log(`Child task created for ${subtask.title}:`);
      console.log(JSON.stringify(result, null, 2));
      results.push(result);
      
      // Brief pause between task creations to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`Failed to create child task for ${subtask.title}:`, err.message);
    }
  }
  
  return results;
}

/**
 * Poll for parent task status updates
 */
async function pollTaskStatus(parentTaskId) {
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
      
      const result = await mcpRequest('/mcp/tool', statusData);
      
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
    
    const finalResult = await mcpRequest('/mcp/tool', statusData);
    await saveResults(parentTaskId, finalResult);
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
  try {
    // Read task file
    console.log(`Reading task file: ${config.taskFile}`);
    const taskFileContent = await fs.readFile(config.taskFile, 'utf8');
    const tasks = JSON.parse(taskFileContent);
    
    console.log(`Found ${tasks.length} tasks with execution modes:`);
    tasks.forEach(task => {
      console.log(`- ${task.title} (Mode: ${task.executionMode})`);
    });
    
    // Create results directory if it doesn't exist
    await fs.mkdir(config.resultsDir, { recursive: true });
    
    // Process each task
    for (const task of tasks) {
      console.log(`\n========================================================`);
      console.log(`Starting task: ${task.title} (${task.id})`);
      console.log(`Execution Mode: ${task.executionMode}`);
      console.log(`Number of subtasks: ${task.subtasks.length}`);
      console.log(`========================================================\n`);
      
      // Create parent task
      const parentTaskId = await createParentTask(task.id, task.executionMode);
      
      // Create child tasks
      await createChildTasks(parentTaskId, task);
      
      // Poll for status updates
      const finalResults = await pollTaskStatus(parentTaskId);
      
      console.log(`\nTask ${task.title} completed!\n`);
      
      // Wait a bit before starting the next task
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\nAll tasks processed successfully!');
  } catch (err) {
    console.error('Error in main function:', err.message);
    process.exit(1);
  }
}

// Run the main function
main();