/**
 * Boomerang handler for task orchestration
 * 
 * This module handles boomerang pattern task orchestration, allowing subtasks
 * to report back results to their parent tasks.
 */

import { promises as fs } from 'node:fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the instance pool
import { instancePool, TaskStatus } from './instance_pool.js';

/**
 * Boomerang task result with marker
 */
interface BoomerangResult {
  parentTaskId: string;
  returnMode: 'summary' | 'full';
  taskDescription: string;
  completed: string; // ISO timestamp
}

/**
 * Child task information
 */
interface ChildTask {
  taskId: string;
  description: string;
  startTime: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  returnMode: 'summary' | 'full';
  result?: string;
}

/**
 * Parent task information
 */
interface ParentTask {
  taskId: string;
  description: string;
  childTasks: Map<string, ChildTask>;
  pendingChildTasks: Set<string>;
  completedChildTasks: Set<string>;
  allChildTasksRequired: boolean; // Whether all child tasks must complete for the parent to complete
}

// Store for active parent tasks and their related child tasks
const parentTasks: Map<string, ParentTask> = new Map();

/**
 * Extract boomerang result from task output
 * Looks for a special marker in the format: <!-- BOOMERANG_RESULT {"parentTaskId":"...","returnMode":"..."} -->
 * 
 * @param output The task output to parse
 * @returns The boomerang result object and clean output (without the marker)
 */
function extractBoomerangResult(output: string): { result?: BoomerangResult; cleanOutput: string } {
  // Look for the boomerang marker
  const markerRegex = /<!-- BOOMERANG_RESULT (.*?) -->/;
  const match = output.match(markerRegex);
  
  if (!match || match.length < 2) {
    return { cleanOutput: output };
  }
  
  try {
    // Parse the JSON data
    const result = JSON.parse(match[1]) as BoomerangResult;
    
    // Remove the marker from the output
    const cleanOutput = output.replace(markerRegex, '').trim();
    
    return { result, cleanOutput };
  } catch (error) {
    console.error('Error parsing boomerang result:', error);
    return { cleanOutput: output };
  }
}

/**
 * Register a child task with its parent
 * 
 * @param parentTaskId The ID of the parent task
 * @param childTaskId The ID of the child task
 * @param description Description of the child task
 * @param returnMode How results should be returned (summary or full)
 */
export async function registerChildTask(
  parentTaskId: string,
  childTaskId: string,
  description: string,
  returnMode: 'summary' | 'full' = 'full'
): Promise<void> {
  console.log(`Registering child task ${childTaskId} with parent ${parentTaskId}`);
  
  // Check if parent task exists
  let parentTask = parentTasks.get(parentTaskId);
  
  // If parent doesn't exist, create it
  if (!parentTask) {
    parentTask = {
      taskId: parentTaskId,
      description: `Parent task for ${childTaskId}`,
      childTasks: new Map(),
      pendingChildTasks: new Set(),
      completedChildTasks: new Set(),
      allChildTasksRequired: true
    };
    
    parentTasks.set(parentTaskId, parentTask);
    console.log(`Created new parent task record for ${parentTaskId}`);
  }
  
  // Register the child task
  const childTask: ChildTask = {
    taskId: childTaskId,
    description,
    startTime: new Date().toISOString(),
    status: 'pending',
    returnMode
  };
  
  parentTask.childTasks.set(childTaskId, childTask);
  parentTask.pendingChildTasks.add(childTaskId);
  
  console.log(`Added child task ${childTaskId} to parent ${parentTaskId}`);
}

/**
 * Process completed child task results
 * 
 * @param childTaskId The ID of the child task
 * @param output The output from the child task
 * @returns Whether the result was successfully processed
 */
export async function processChildTaskResult(childTaskId: string, output: string): Promise<boolean> {
  // Extract boomerang result from the output
  const { result, cleanOutput } = extractBoomerangResult(output);
  
  if (!result || !result.parentTaskId) {
    console.log(`No parent task ID found in output from task ${childTaskId}`);
    return false;
  }
  
  const parentTaskId = result.parentTaskId;
  console.log(`Processing child task ${childTaskId} result for parent ${parentTaskId}`);
  
  // Get the parent task
  const parentTask = parentTasks.get(parentTaskId);
  if (!parentTask) {
    console.error(`Parent task ${parentTaskId} not found for child ${childTaskId}`);
    return false;
  }
  
  // Get the child task
  const childTask = parentTask.childTasks.get(childTaskId);
  if (!childTask) {
    console.error(`Child task ${childTaskId} not found for parent ${parentTaskId}`);
    return false;
  }
  
  // Update child task status
  childTask.status = 'completed';
  childTask.result = cleanOutput;
  
  // Update task sets
  parentTask.pendingChildTasks.delete(childTaskId);
  parentTask.completedChildTasks.add(childTaskId);
  
  console.log(`Updated child task ${childTaskId} with result for parent ${parentTaskId}`);
  
  // Check if all required child tasks are complete
  if (parentTask.allChildTasksRequired && parentTask.pendingChildTasks.size === 0) {
    console.log(`All child tasks complete for parent ${parentTaskId}. Processing parent task completion.`);
    await processParentTaskCompletion(parentTaskId);
  }
  
  return true;
}

/**
 * Process parent task completion when all child tasks are complete
 * 
 * @param parentTaskId The ID of the parent task to process
 */
async function processParentTaskCompletion(parentTaskId: string): Promise<void> {
  const parentTask = parentTasks.get(parentTaskId);
  if (!parentTask) {
    console.error(`Parent task ${parentTaskId} not found`);
    return;
  }
  
  console.log(`Processing completion of parent task ${parentTaskId}`);
  
  // Prepare summary of child task results
  const childResults = Array.from(parentTask.childTasks.values())
    .filter(task => task.status === 'completed')
    .map(task => {
      return {
        taskId: task.taskId,
        description: task.description,
        result: task.returnMode === 'summary' ? task.result : `Full result available (${task.result?.length || 0} chars)`
      };
    });
  
  // Create a parent task result
  const resultSummary = {
    parentTaskId,
    description: parentTask.description,
    totalChildTasks: parentTask.childTasks.size,
    completedChildTasks: parentTask.completedChildTasks.size,
    pendingChildTasks: parentTask.pendingChildTasks.size,
    childResults
  };
  
  // Store the result somewhere for later retrieval
  const resultPath = path.join('/tmp', `parent_task_${parentTaskId}_result.json`);
  await fs.writeFile(resultPath, JSON.stringify(resultSummary, null, 2));
  
  console.log(`Parent task ${parentTaskId} completion processed. Results saved to ${resultPath}`);
}

/**
 * Get the results of a parent task and its child tasks
 * 
 * @param parentTaskId The ID of the parent task
 * @returns The parent task results, or undefined if not found
 */
export async function getParentTaskResults(parentTaskId: string): Promise<any> {
  // Check in-memory store first
  const parentTask = parentTasks.get(parentTaskId);
  
  // If not found, check for saved results
  if (!parentTask) {
    try {
      const resultPath = path.join('/tmp', `parent_task_${parentTaskId}_result.json`);
      const resultContent = await fs.readFile(resultPath, 'utf8');
      return JSON.parse(resultContent);
    } catch (error) {
      return undefined;
    }
  }
  
  // Prepare a results object from in-memory data
  const childResults = Array.from(parentTask.childTasks.values())
    .map(task => {
      return {
        taskId: task.taskId,
        description: task.description,
        status: task.status,
        result: task.status === 'completed' ? 
          (task.returnMode === 'summary' ? task.result : `Full result available (${task.result?.length || 0} chars)`)
          : undefined
      };
    });
  
  return {
    parentTaskId,
    description: parentTask.description,
    totalChildTasks: parentTask.childTasks.size,
    completedChildTasks: parentTask.completedChildTasks.size,
    pendingChildTasks: parentTask.pendingChildTasks.size,
    allComplete: parentTask.pendingChildTasks.size === 0,
    childResults
  };
}

/**
 * Create a boomerang task (child task with parent reference)
 * 
 * @param parentTaskId The ID of the parent task
 * @param description Description of the child task
 * @param prompt The prompt for the child task
 * @param options Additional options for the child task
 * @returns The result of the task creation
 */
export async function createBoomerangTask(
  parentTaskId: string,
  description: string,
  prompt: string,
  options: {
    workFolder?: string;
    returnMode?: 'summary' | 'full';
    mode?: string;
  } = {}
): Promise<any> {
  try {
    // Create a unique child task ID
    const childTaskId = `child_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    // Register the child task with the parent
    await registerChildTask(
      parentTaskId,
      childTaskId,
      description,
      options.returnMode || 'full'
    );
    
    // Execute the task through the instance pool
    const task = instancePool.executeTask(
      childTaskId,
      prompt,
      {
        workFolder: options.workFolder,
        parentTaskId,
        taskDescription: description,
        returnMode: options.returnMode,
        mode: options.mode
      }
    ).then(result => {
      // Process the result when the task completes
      if (result.success) {
        processChildTaskResult(childTaskId, result.output).catch(error => {
          console.error(`Error processing child task ${childTaskId} result:`, error);
        });
      }
    }).catch(error => {
      console.error(`Error executing child task ${childTaskId}:`, error);
    });
    
    // Return information about the created task
    return {
      success: true,
      message: `Boomerang task created successfully`,
      parentTaskId,
      childTaskId,
      description,
      status: 'running'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to create boomerang task: ${message}`
    };
  }
}