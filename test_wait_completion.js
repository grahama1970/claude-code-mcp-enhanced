#!/usr/bin/env node

import { executeTask, taskStatus } from './dist/task_command.js';

// Execute a task and wait for completion
async function runTest() {
  console.log('Testing task execution with wait for completion...');
  
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
  
  console.log(`\nWaiting for task ${taskId} to complete...`);
  
  // Check the status with longer pauses to allow more progress
  let completed = false;
  let attempts = 0;
  
  while (!completed && attempts < 120) {
    attempts++;
    
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check status
    const status = await taskStatus({ taskId });
    
    // Log status if something changed
    if (attempts === 1 || attempts % 10 === 0 || status.details?.progress % 25 === 0) {
      console.log(`\nStatus check #${attempts} (progress: ${status.details?.progress}%):`, 
        JSON.stringify({
          status: status.details?.status,
          progress: status.details?.progress,
          startTime: status.details?.start_time,
          endTime: status.details?.end_time
        }, null, 2));
    }
    
    // Check if the task has completed
    if (status.status === 'completed' || 
        status.details?.status === 'completed' || 
        (status.details?.progress === 100 && status.details?.end_time)) {
      completed = true;
      console.log('\nTask completed!');
      console.log('Final status:', JSON.stringify(status.details, null, 2));
      break;
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