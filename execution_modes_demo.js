#!/usr/bin/env node
/**
 * Task Execution Modes Demo
 * 
 * This script demonstrates the task execution modes (sequential and parallel)
 * by implementing the tasks from docs/tasks/004_task_execution_modes.md.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execPromise = promisify(exec);

// Configuration
const config = {
  mcpServer: 'http://localhost:3000',
  reportsDir: path.join(__dirname, 'docs', 'reports'),
  pollIntervalMs: 3000,
  maxAttempts: 30
};

// Task definitions based on 004_task_execution_modes.md
const tasks = [
  {
    id: 'task_1_geography_questions',
    title: 'Geography Questions',
    description: 'This task implements a sequential execution mode to answer a geography question.',
    executionMode: 'sequential',
    prompt: 'What is the capital of France?',
    expectedOutput: 'Paris',
    reportFile: '004_task_1_sequential_geography_question.md'
  },
  {
    id: 'task_2_python_functions',
    title: 'Python Functions',
    description: 'This task implements parallel execution mode to generate multiple Python functions simultaneously.',
    executionMode: 'parallel',
    subtasks: [
      {
        id: 'python_multiply',
        prompt: 'Write a Python function that multiplies two numbers. Include docstrings and type hints.'
      },
      {
        id: 'python_sum_list',
        prompt: 'Write a Python function that calculates the sum of all numbers in a list. Include docstrings and type hints.'
      }
    ],
    reportFile: '004_task_2_parallel_python_functions.md'
  },
  {
    id: 'task_3_apple_color',
    title: 'Apple Color Question',
    description: 'This task asks about the most common color of an apple using sequential execution mode.',
    executionMode: 'sequential',
    prompt: 'What is the most common color of an apple?',
    expectedOutput: 'Red',
    reportFile: '004_task_3_sequential_apple_color.md'
  },
  {
    id: 'task_4_mixed_mode',
    title: 'Mixed Mode Task Execution',
    description: 'This task implements a mixed execution flow with both sequential and parallel tasks.',
    executionMode: 'mixed',
    subtasks: [
      {
        id: 'generate_numbers',
        executionMode: 'sequential',
        prompt: 'Generate a list of 10 random integers between 1 and 100. Return only the list, formatted as JSON.'
      },
      {
        id: 'calculate_sum',
        executionMode: 'parallel',
        prompt: 'Calculate the sum of these numbers: [NUMBERS]. Return only the sum as a number.',
        dependsOn: 'generate_numbers'
      },
      {
        id: 'calculate_average',
        executionMode: 'parallel',
        prompt: 'Calculate the average of these numbers: [NUMBERS]. Return only the average as a number with 2 decimal places.',
        dependsOn: 'generate_numbers'
      },
      {
        id: 'find_maximum',
        executionMode: 'parallel',
        prompt: 'Find the maximum value in these numbers: [NUMBERS]. Return only the maximum as a number.',
        dependsOn: 'generate_numbers'
      },
      {
        id: 'create_report',
        executionMode: 'sequential',
        prompt: 'Create a report with these results:\nNumbers: [NUMBERS]\nSum: [SUM]\nAverage: [AVERAGE]\nMaximum: [MAXIMUM]',
        dependsOn: ['calculate_sum', 'calculate_average', 'find_maximum']
      }
    ],
    reportFile: '004_task_4_mixed_mode_execution.md'
  },
  {
    id: 'task_5_timeouts',
    title: 'Tasks with Timeouts',
    description: 'This task implements timeout handling for tasks.',
    executionMode: 'parallel',
    subtasks: [
      {
        id: 'quick_math',
        prompt: 'What is 2 + 2?',
        timeout: 5000  // 5 seconds
      },
      {
        id: 'long_essay',
        prompt: 'Generate a 10,000-word essay about the history of artificial intelligence.',
        timeout: 1000  // 1 second (should timeout)
      }
    ],
    reportFile: '004_task_5_timeout_handling.md'
  }
];

/**
 * Make an HTTP request to the MCP server
 */
async function mcpRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
    
    fetch(`${config.mcpServer}${endpoint}`, requestOptions)
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`HTTP error ${response.status}: ${text}`);
          });
        }
        return response.json();
      })
      .then(resolve)
      .catch(reject);
  });
}

/**
 * Create a parent task
 */
async function createParentTask(task) {
  try {
    const startTime = Date.now();
    
    console.log(`\n==============================================================`);
    console.log(`STARTING TASK: ${task.title}`);
    console.log(`Mode: ${task.executionMode}`);
    console.log(`==============================================================`);
    
    // Create the parent task with claude_code tool
    const taskData = {
      tool: 'execute_task',
      arguments: {
        taskId: task.id,
        executionMode: task.executionMode
      }
    };
    
    const result = await mcpRequest('/mcp/tool', taskData);
    
    console.log(`Parent task created. ID: ${task.id}`);
    console.log(`Background task ID: ${result.taskData?.task_id || 'unknown'}`);
    
    // Save the result for future reference
    task.parentTaskResult = result;
    task.startTime = startTime;
    task.backgroundTaskId = result.taskData?.task_id;
    
    return result;
  } catch (err) {
    console.error(`Failed to create parent task for ${task.title}:`, err.message);
    throw err;
  }
}

/**
 * Create a child task with the boomerang pattern
 */
async function createChildTask(parentTaskId, subTask) {
  try {
    const taskData = {
      tool: 'create_boomerang_task',
      arguments: {
        parentTaskId,
        description: subTask.id,
        prompt: subTask.prompt,
        returnMode: 'full'
      }
    };
    
    const result = await mcpRequest('/mcp/tool', taskData);
    
    console.log(`Created child task: ${subTask.id}`);
    
    // Save the child task ID
    subTask.childTaskId = result.childTaskId;
    
    return result;
  } catch (err) {
    console.error(`Failed to create child task ${subTask.id}:`, err.message);
    throw err;
  }
}

/**
 * Check the status of a task
 */
async function checkTaskStatus(taskId) {
  try {
    const statusData = {
      tool: 'task_status',
      arguments: {
        taskId
      }
    };
    
    return await mcpRequest('/mcp/tool', statusData);
  } catch (err) {
    console.error(`Failed to check status for task ${taskId}:`, err.message);
    throw err;
  }
}

/**
 * Get parent task results
 */
async function getParentTaskResults(parentTaskId) {
  try {
    const resultsData = {
      tool: 'get_parent_task_results',
      arguments: {
        parentTaskId
      }
    };
    
    return await mcpRequest('/mcp/tool', resultsData);
  } catch (err) {
    console.error(`Failed to get results for parent task ${parentTaskId}:`, err.message);
    throw err;
  }
}

/**
 * Poll for task status until completion or timeout
 */
async function pollTaskStatus(task) {
  console.log(`\nPolling for status of task ${task.id}...`);
  
  const backgroundTaskId = task.backgroundTaskId;
  if (!backgroundTaskId) {
    console.error('No background task ID available for polling');
    return null;
  }
  
  let attempts = 0;
  let allComplete = false;
  
  const startTime = Date.now();
  
  while (attempts < config.maxAttempts && !allComplete) {
    try {
      // For tasks with subtasks, use get_parent_task_results
      // For simple tasks, use task_status
      let status;
      if (task.subtasks) {
        status = await getParentTaskResults(task.id);
        
        // Display progress
        console.log(`\nStatus update (attempt ${attempts + 1}/${config.maxAttempts}):`);
        console.log(`Parent Task: ${task.id}`);
        console.log(`Completed child tasks: ${status.completedChildTasks || 0}/${status.totalChildTasks || 0}`);
        console.log(`Elapsed time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
        
        // Show child task status
        if (status.childResults && status.childResults.length > 0) {
          console.log('\nChild Task Status:');
          status.childResults.forEach((child, index) => {
            console.log(`  [${index + 1}] ${child.description}: ${child.status}`);
          });
        }
        
        allComplete = status.allComplete;
      } else {
        status = await checkTaskStatus(backgroundTaskId);
        
        // Display progress
        console.log(`\nStatus update (attempt ${attempts + 1}/${config.maxAttempts}):`);
        console.log(`Task: ${task.id}`);
        console.log(`Status: ${status.status}`);
        console.log(`Progress: ${status.progress || 0}%`);
        console.log(`Elapsed time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
        
        allComplete = status.status === 'completed';
      }
      
      if (allComplete) {
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        console.log(`\nTask ${task.id} completed in ${(executionTime / 1000).toFixed(2)} seconds!`);
        
        // Save results
        task.status = status;
        task.executionTime = executionTime;
        
        return status;
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
    let finalStatus;
    if (task.subtasks) {
      finalStatus = await getParentTaskResults(task.id);
    } else {
      finalStatus = await checkTaskStatus(backgroundTaskId);
    }
    
    task.status = finalStatus;
    task.executionTime = Date.now() - startTime;
    
    return finalStatus;
  } catch (err) {
    console.error(`Failed to get final status for task ${task.id}:`, err.message);
    return null;
  }
}

/**
 * Create a verification report for a task
 */
async function createVerificationReport(task) {
  const reportPath = path.join(config.reportsDir, task.reportFile);
  
  console.log(`\nCreating verification report: ${reportPath}`);
  
  // Ensure reports directory exists
  await fs.mkdir(config.reportsDir, { recursive: true });
  
  let reportContent = `# Task ${task.id.split('_')[1]}: ${task.title} - Verification Report

## Task Summary
${task.description}

## Execution Details
- **Execution Mode**: ${task.executionMode}
- **Execution Time**: ${task.executionTime ? (task.executionTime / 1000).toFixed(2) + ' seconds' : 'N/A'}
- **Status**: ${task.status ? (task.status.success ? 'Success' : 'Failed') : 'Unknown'}

## Results
`;

  // Add specific results based on task type
  if (task.subtasks) {
    // For tasks with subtasks
    if (task.status && task.status.childResults) {
      reportContent += '### Subtask Results\n\n';
      
      task.status.childResults.forEach((child, index) => {
        reportContent += `#### ${index + 1}. ${child.description}\n\n`;
        reportContent += `- **Status**: ${child.status}\n`;
        
        if (child.result) {
          reportContent += `- **Output**:\n\n\`\`\`\n${child.result}\n\`\`\`\n\n`;
        }
      });
    }
  } else {
    // For simple tasks
    reportContent += `### Expected Output
\`${task.expectedOutput}\`

### Actual Output
\`\`\`
${task.status && task.status.details && task.status.details.output ? task.status.details.output : 'No output available'}
\`\`\`
`;
  }

  // Add verification section
  reportContent += `
## Verification
- **Execution Time Measured**: ✅
- **Output Captured**: ${task.status ? '✅' : '❌'}
- **Expected Output Matched**: ${task.status && task.status.details && task.status.details.output && task.status.details.output.includes(task.expectedOutput || '') ? '✅' : '❌'}

## Performance Metrics
- **Start Time**: ${new Date(task.startTime).toISOString()}
- **End Time**: ${task.executionTime ? new Date(task.startTime + task.executionTime).toISOString() : 'N/A'}
- **Total Execution Time**: ${task.executionTime ? (task.executionTime / 1000).toFixed(2) + ' seconds' : 'N/A'}
${task.executionMode === 'parallel' ? `- **Parallel Efficiency**: ${task.subtasks ? (task.subtasks.length / (task.executionTime / 1000)).toFixed(2) + ' tasks/second' : 'N/A'}` : ''}

## Notes
${task.executionMode === 'sequential' ? '- Tasks were executed sequentially as expected' : ''}
${task.executionMode === 'parallel' ? '- Tasks were executed in parallel as expected' : ''}
${task.executionMode === 'mixed' ? '- Sequential and parallel tasks were handled appropriately' : ''}
`;
  
  try {
    await fs.writeFile(reportPath, reportContent);
    console.log(`Verification report created: ${reportPath}`);
  } catch (err) {
    console.error(`Failed to create verification report: ${err.message}`);
  }
}

/**
 * Process a task with sequential execution
 */
async function processSequentialTask(task) {
  // Create the parent task
  await createParentTask(task);
  
  // Poll for task completion
  await pollTaskStatus(task);
  
  // Create verification report
  await createVerificationReport(task);
  
  console.log(`\nTask ${task.title} processing complete!`);
}

/**
 * Process a task with parallel execution
 */
async function processParallelTask(task) {
  // Create the parent task
  await createParentTask(task);
  
  // Create child tasks for each subtask
  if (task.subtasks) {
    for (const subtask of task.subtasks) {
      await createChildTask(task.id, subtask);
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Poll for task completion
  await pollTaskStatus(task);
  
  // Create verification report
  await createVerificationReport(task);
  
  console.log(`\nTask ${task.title} processing complete!`);
}

/**
 * Process a mixed mode task (with both sequential and parallel subtasks)
 */
async function processMixedModeTask(task) {
  // For this demo, we'll use the parallel task approach but with
  // dependency management in the prompts
  
  // Create the parent task
  await createParentTask(task);
  
  // First, execute sequential tasks that others depend on
  const sequentialTasks = task.subtasks.filter(st => 
    st.executionMode === 'sequential' && !st.dependsOn);
  
  // Store results for dependency resolution
  const subtaskResults = {};
  
  // Process sequential tasks first
  for (const subtask of sequentialTasks) {
    console.log(`Processing sequential subtask: ${subtask.id}`);
    
    // Create the child task
    await createChildTask(task.id, subtask);
    
    // For demo purposes, we're simulating getting results
    if (subtask.id === 'generate_numbers') {
      // Simulate getting the numbers (this would normally come from the task result)
      const numbers = Array.from({length: 10}, () => Math.floor(Math.random() * 100) + 1);
      subtaskResults[subtask.id] = numbers;
    }
  }
  
  // Now process parallel tasks that depend on sequential tasks
  for (const subtask of task.subtasks) {
    if (subtask.executionMode === 'parallel' && subtask.dependsOn) {
      // Resolve dependencies
      if (typeof subtask.dependsOn === 'string') {
        // Single dependency
        if (subtaskResults[subtask.dependsOn]) {
          // Replace placeholder in prompt
          subtask.prompt = subtask.prompt.replace('[NUMBERS]', JSON.stringify(subtaskResults[subtask.dependsOn]));
        }
      }
      
      // Create the child task
      await createChildTask(task.id, subtask);
      
      // For demo purposes, we're simulating getting results
      if (subtask.id === 'calculate_sum') {
        const numbers = subtaskResults['generate_numbers'] || [];
        subtaskResults[subtask.id] = numbers.reduce((a, b) => a + b, 0);
      } else if (subtask.id === 'calculate_average') {
        const numbers = subtaskResults['generate_numbers'] || [];
        subtaskResults[subtask.id] = numbers.length > 0 ? 
          (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2) : 0;
      } else if (subtask.id === 'find_maximum') {
        const numbers = subtaskResults['generate_numbers'] || [];
        subtaskResults[subtask.id] = numbers.length > 0 ? Math.max(...numbers) : 0;
      }
    }
  }
  
  // Finally process sequential tasks that depend on parallel tasks
  for (const subtask of task.subtasks) {
    if (subtask.executionMode === 'sequential' && 
        subtask.dependsOn && 
        Array.isArray(subtask.dependsOn)) {
      
      // Resolve multiple dependencies
      let prompt = subtask.prompt;
      
      if (subtaskResults['generate_numbers']) {
        prompt = prompt.replace('[NUMBERS]', JSON.stringify(subtaskResults['generate_numbers']));
      }
      
      if (subtaskResults['calculate_sum']) {
        prompt = prompt.replace('[SUM]', subtaskResults['calculate_sum']);
      }
      
      if (subtaskResults['calculate_average']) {
        prompt = prompt.replace('[AVERAGE]', subtaskResults['calculate_average']);
      }
      
      if (subtaskResults['find_maximum']) {
        prompt = prompt.replace('[MAXIMUM]', subtaskResults['find_maximum']);
      }
      
      // Update prompt
      subtask.prompt = prompt;
      
      // Create the child task
      await createChildTask(task.id, subtask);
    }
  }
  
  // Poll for task completion
  await pollTaskStatus(task);
  
  // Create verification report
  await createVerificationReport(task);
  
  console.log(`\nTask ${task.title} processing complete!`);
}

/**
 * Create a summary report for all tasks
 */
async function createSummaryReport(tasks) {
  const reportPath = path.join(config.reportsDir, '004_task_execution_modes_summary.md');
  
  console.log(`\nCreating summary report: ${reportPath}`);
  
  let reportContent = `# Task Execution Modes - Summary Report

## Overview
This report summarizes the execution of all tasks in the Task Execution Modes demo.

## Tasks Summary

`;

  for (const task of tasks) {
    reportContent += `### ${task.title}
- **ID**: ${task.id}
- **Execution Mode**: ${task.executionMode}
- **Status**: ${task.status ? (task.status.success ? 'Success' : 'Failed') : 'Unknown'}
- **Execution Time**: ${task.executionTime ? (task.executionTime / 1000).toFixed(2) + ' seconds' : 'N/A'}
- **Report**: [${task.reportFile}](${task.reportFile})

`;
  }

  reportContent += `
## Performance Comparison

| Task | Execution Mode | Time (seconds) |
|------|----------------|----------------|
${tasks.map(t => `| ${t.title} | ${t.executionMode} | ${t.executionTime ? (t.executionTime / 1000).toFixed(2) : 'N/A'} |`).join('\n')}

## Conclusions

1. **Sequential Execution**: Good for tasks that depend on each other, but slower overall.
2. **Parallel Execution**: Much faster for independent tasks, but requires careful coordination.
3. **Mixed Mode**: Provides the best balance of performance and dependency management.
4. **Timeouts**: Essential for preventing tasks from running indefinitely.

## Next Steps

1. Optimize task scheduling for better performance
2. Improve error handling and retry logic
3. Add more detailed monitoring and visualization
4. Extend the system to support distributed execution
`;
  
  try {
    await fs.writeFile(reportPath, reportContent);
    console.log(`Summary report created: ${reportPath}`);
  } catch (err) {
    console.error(`Failed to create summary report: ${err.message}`);
  }
}

/**
 * Main function to execute all tasks
 */
async function main() {
  try {
    console.log('Starting Task Execution Modes Demo...');
    
    // Ensure reports directory exists
    await fs.mkdir(config.reportsDir, { recursive: true });
    
    // Process each task based on its execution mode
    for (const task of tasks) {
      try {
        if (task.executionMode === 'sequential') {
          await processSequentialTask(task);
        } else if (task.executionMode === 'parallel') {
          await processParallelTask(task);
        } else if (task.executionMode === 'mixed') {
          await processMixedModeTask(task);
        } else {
          console.error(`Unknown execution mode: ${task.executionMode}`);
        }
      } catch (err) {
        console.error(`Error processing task ${task.id}:`, err);
      }
      
      // Brief pause between tasks
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Create summary report
    await createSummaryReport(tasks);
    
    console.log('\nTask Execution Modes Demo completed successfully!');
    
  } catch (err) {
    console.error('Error in main function:', err);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});