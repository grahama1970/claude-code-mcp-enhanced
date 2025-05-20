#!/usr/bin/env node

import { executeTask, taskStatus } from './dist/task_command.js';

// Execute a new task
async function runTest() {
  console.log('Testing task execution and status...');
  
  // Start a new task
  console.log('Starting a new task...');
  const taskResult = await executeTask({ taskId: 'test_task_' + Date.now(), executionMode: 'sequential' });
  console.log('Task execution result:', JSON.stringify(taskResult, null, 2));
  
  // Extract the correct task ID from the response
  const taskId = taskResult.taskData?.task_id || taskResult.taskId;
  if (!taskId) {
    console.error('No task ID returned from task execution');
    return;
  }
  
  console.log(`\nChecking status for task ${taskId}`);
  
  // Check the status periodically
  let completed = false;
  let attempts = 0;
  
  while (!completed && attempts < 15) {
    attempts++;
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check status
    const status = await taskStatus({ taskId });
    console.log(`\nStatus check #${attempts}:`, JSON.stringify(status, null, 2));
    
    // Check if the task has completed
    if (status.status === 'completed' || 
        status.details?.status === 'completed' || 
        (status.details?.progress === 100 && status.details?.end_time)) {
      completed = true;
      console.log('\nTask completed!');
    }
  }
  
  if (!completed) {
    console.log('\nTask is still running after max check attempts. You can continue checking manually.');
  }
}

// Run the test
runTest().catch(err => {
  console.error('Error running test:', err);
});