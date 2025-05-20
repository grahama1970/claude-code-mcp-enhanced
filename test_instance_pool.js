#!/usr/bin/env node

import { convertTaskMarkdown, executeTask, taskStatus } from './dist/pooled_task_command.js';
import { instancePool } from './dist/instance_pool.js';
import path from 'path';

// Execute a task from docs/tasks/ and follow its progress using the instance pool
async function runTest() {
  console.log('Testing task execution with instance pooling...');
  console.log('Instance pool stats:', instancePool.getPoolStats());
  
  const taskPath = path.join(process.cwd(), 'docs', 'tasks', '004_task_execution_modes.md');
  console.log(`Converting task file: ${taskPath}`);
  
  // Step 1: Convert the task markdown to JSON
  const conversionResult = await convertTaskMarkdown({ 
    markdownPath: taskPath,
    outputPath: path.join(process.cwd(), 'converted_tasks.json')
  });
  
  console.log('Task conversion result:', JSON.stringify(conversionResult, null, 2));
  
  if (!conversionResult.success) {
    console.error('Failed to convert task.');
    return;
  }
  
  // In a real implementation, this would be the ID from the converted task
  const taskId = '004_task_execution_modes';
  console.log(`\nTask ID from conversion: ${taskId}`);
  
  // Execute the task with a specified mode
  const executionMode = 'sequential';
  console.log(`\nExecuting task ${taskId} in ${executionMode} mode...`);
  
  const executionResult = await executeTask({ 
    taskId,
    executionMode 
  });
  
  console.log('Task execution result:', JSON.stringify(executionResult, null, 2));
  console.log('Instance pool stats after task allocation:', instancePool.getPoolStats());
  
  // Extract the task ID for status monitoring
  const runningTaskId = executionResult.taskData?.task_id || executionResult.taskId;
  if (!runningTaskId) {
    console.error('No task ID returned from task execution');
    return;
  }
  
  console.log(`\nWaiting for task ${runningTaskId} to complete...`);
  
  // Monitor task status until completion
  let completed = false;
  let attempts = 0;
  
  while (!completed && attempts < 10) { // Reduce max attempts for quicker testing
    attempts++;
    
    // Wait 2 seconds between checks to finish faster
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check status
    const status = await taskStatus({ taskId: runningTaskId });
    
    // Log status if something changed
    if (attempts === 1 || attempts % 5 === 0 || 
        (status.details?.progress % 25 === 0 && status.details?.progress > 0)) {
      console.log(`\nStatus check #${attempts} (progress: ${status.details?.progress}%):`, 
        JSON.stringify({
          status: status.details?.status,
          progress: status.details?.progress,
          startTime: status.details?.startTime,
          endTime: status.details?.endTime
        }, null, 2));
    }
    
    // Check if the task has completed
    if (status.status === 'completed' || 
        status.details?.status === 'completed' || 
        (status.details?.progress === 100 && status.details?.endTime)) {
      completed = true;
      console.log('\nTask completed!');
      console.log('Final status:', JSON.stringify(status.details, null, 2));
      console.log('Instance pool stats after task completion:', instancePool.getPoolStats());
      break;
    }
  }
  
  if (!completed) {
    console.log('\nTask is still running after max check attempts. You can continue checking manually.');
    console.log('Instance pool stats:', instancePool.getPoolStats());
  }
}

// Run the test
runTest().catch(err => {
  console.error('Error running test:', err);
});