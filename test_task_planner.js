#!/usr/bin/env node

import { convertTaskMarkdown, executeTask, taskStatus } from './dist/task_command.js';
import path from 'path';

// Execute a task from docs/tasks/ and follow its progress
async function runTest() {
  console.log('Testing task planner execution with real tasks...');
  
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
  
  // Step 2: Execute the task with a real Claude instance in the background
  // This will cause Claude to work on the first task in the list (Geography Question)
  const executionMode = 'sequential';
  console.log(`\nExecuting task ${taskId} in ${executionMode} mode...`);
  
  const executionResult = await executeTask({ 
    taskId,
    executionMode 
  });
  
  console.log('Task execution result:', JSON.stringify(executionResult, null, 2));
  
  // Extract the task ID for status monitoring
  const runningTaskId = executionResult.taskData?.task_id || executionResult.taskId;
  if (!runningTaskId) {
    console.error('No task ID returned from task execution');
    return;
  }
  
  console.log(`\nWaiting for task ${runningTaskId} to complete...`);
  
  // Step 3: Monitor task status until completion
  let completed = false;
  let attempts = 0;
  
  while (!completed && attempts < 120) {
    attempts++;
    
    // Wait 5 seconds between checks
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check status
    const status = await taskStatus({ taskId: runningTaskId });
    
    // Log status if something changed
    if (attempts === 1 || attempts % 5 === 0 || 
        (status.details?.progress % 25 === 0 && status.details?.progress > 0)) {
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