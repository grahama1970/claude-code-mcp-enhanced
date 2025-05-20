#!/usr/bin/env node
/**
 * Display task results for Claude Code MCP
 * 
 * This script reads task results from files and displays them in a formatted way.
 */

const fs = require('fs').promises;
const path = require('path');

// Set up configuration
const config = {
  resultsDir: path.join(__dirname, 'task_results')
};

/**
 * Print a separator line
 */
function printSeparator(char = '-', length = 80) {
  console.log(char.repeat(length));
}

/**
 * Format and display parent task results
 */
async function displayParentTaskResults(resultsPath) {
  try {
    const data = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(data);
    
    printSeparator('=');
    console.log(`PARENT TASK RESULTS: ${results.parentTaskId}`);
    printSeparator('=');
    
    console.log(`Description: ${results.description || 'No description'}`);
    console.log(`Total Child Tasks: ${results.totalChildTasks || 0}`);
    console.log(`Completed Child Tasks: ${results.completedChildTasks || 0}`);
    console.log(`Pending Child Tasks: ${results.pendingChildTasks || 0}`);
    console.log(`All Complete: ${results.allComplete ? 'Yes' : 'No'}`);
    
    printSeparator();
    console.log('CHILD TASK RESULTS:');
    printSeparator();
    
    if (results.childResults && results.childResults.length > 0) {
      for (let i = 0; i < results.childResults.length; i++) {
        const child = results.childResults[i];
        
        console.log(`Child Task #${i + 1}: ${child.taskId}`);
        console.log(`Description: ${child.description}`);
        console.log(`Status: ${child.status}`);
        
        if (child.result) {
          console.log('\nResult:');
          printSeparator('-', 40);
          console.log(child.result);
          printSeparator('-', 40);
        } else {
          console.log('\nNo result available');
        }
        
        printSeparator();
      }
    } else {
      console.log('No child task results available');
    }
  } catch (err) {
    console.error(`Error reading results file ${resultsPath}:`, err.message);
  }
}

/**
 * Format and display child task results
 */
async function displayChildTaskResults(resultsPath) {
  try {
    const data = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(data);
    
    printSeparator('=');
    console.log(`CHILD TASK RESULTS: ${results.taskId}`);
    printSeparator('=');
    
    console.log(`Status: ${results.status || 'unknown'}`);
    console.log(`Progress: ${results.progress || 0}%`);
    console.log(`Start Time: ${results.startTime || 'unknown'}`);
    console.log(`End Time: ${results.endTime || 'not completed'}`);
    
    if (results.details && results.details.output) {
      printSeparator();
      console.log('TASK OUTPUT:');
      printSeparator();
      console.log(results.details.output);
    } else {
      printSeparator();
      console.log('No task output available');
    }
  } catch (err) {
    console.error(`Error reading results file ${resultsPath}:`, err.message);
  }
}

/**
 * List all available result files
 */
async function listResultFiles() {
  try {
    const files = await fs.readdir(config.resultsDir);
    const resultFiles = files.filter(file => file.endsWith('_results.json'));
    
    if (resultFiles.length === 0) {
      console.log('No result files found');
      return [];
    }
    
    console.log('Available result files:');
    resultFiles.forEach((file, index) => {
      // Extract task ID from filename
      const taskId = file.replace('_results.json', '');
      console.log(`${index + 1}. ${taskId}`);
    });
    
    return resultFiles;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`Results directory ${config.resultsDir} does not exist`);
    } else {
      console.error('Error listing result files:', err.message);
    }
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check if results directory exists
    try {
      await fs.access(config.resultsDir);
    } catch (err) {
      console.log(`Creating results directory ${config.resultsDir}`);
      await fs.mkdir(config.resultsDir, { recursive: true });
    }
    
    // Check if task ID was provided
    if (process.argv.length < 3) {
      console.log('No task ID provided. Listing available result files...');
      
      const resultFiles = await listResultFiles();
      
      if (resultFiles.length === 0) {
        console.log('No result files found. Run task scripts first to generate results.');
        process.exit(0);
      }
      
      console.log('\nUsage: node display_results.js <taskId> [--parent]');
      console.log('  --parent: Display parent task results (default is to display child task results)');
      process.exit(0);
    }
    
    const taskId = process.argv[2];
    const isParentTask = process.argv.includes('--parent');
    
    // Check if result file exists
    const resultsPath = path.join(config.resultsDir, `${taskId}_results.json`);
    
    try {
      await fs.access(resultsPath);
    } catch (err) {
      console.error(`Result file for task ${taskId} not found: ${resultsPath}`);
      console.log('Run monitor_tasks.js first to generate results.');
      process.exit(1);
    }
    
    // Display results
    if (isParentTask) {
      await displayParentTaskResults(resultsPath);
    } else {
      await displayChildTaskResults(resultsPath);
    }
  } catch (err) {
    console.error('Error in main function:', err.message);
    process.exit(1);
  }
}

// Run the main function
main();