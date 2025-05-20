#!/usr/bin/env node
/**
 * Create a geography question task using the boomerang pattern
 * 
 * This script creates a child task that will report its results back to a parent task.
 */

const http = require('http');

// Set up configuration
const config = {
  mcpServerHost: 'localhost',
  mcpServerPort: 3000
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
 * Create a child task for the geography question
 */
async function createGeographyTask(parentTaskId) {
  const childTaskData = {
    tool: 'create_boomerang_task',
    arguments: {
      parentTaskId,
      description: 'Capital of France Task',
      prompt: 'What is the capital of France? Please provide a detailed answer with population, major landmarks, and historical significance.',
      returnMode: 'full'
    }
  };
  
  try {
    const result = await mcpRequest('/api/v1/tools/execute', childTaskData);
    console.log('Geography task created:');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('Failed to create geography task:', err.message);
    throw err;
  }
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
        console.log('\nTask completed successfully!');
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
 * Main function
 */
async function main() {
  try {
    console.log('Starting geography task test...');
    
    // Create parent task
    const parentTaskId = await createParentTask();
    
    // Create geography task
    await createGeographyTask(parentTaskId);
    
    // Poll for status updates
    await pollTaskStatus(parentTaskId);
    
    console.log('\nGeography task test completed!');
  } catch (err) {
    console.error('Error in main function:', err.message);
    process.exit(1);
  }
}

// Run the main function
main();