#!/usr/bin/env node
/**
 * Simple MCP bridge for Task Orchestration - Convert Task tool
 *
 * This script provides a CommonJS implementation of the task conversion tool
 * that avoids the __dirname issue.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Set up stdin/stdout for JSON-RPC communication
const rl = readline.createInterface({
  input: process.stdin,
  output: null,
  terminal: false
});

// Project root directory (using CommonJS __dirname)
const PROJECT_ROOT = __dirname;

// Set up logging
const LOG_FILE = path.join(PROJECT_ROOT, 'convert_bridge.log');
function log(message) {
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
}

log('Convert Task MCP bridge started');
log(`Project root: ${PROJECT_ROOT}`);

// Handle list_tools requests
function handleListTools(id) {
  const response = {
    jsonrpc: '2.0',
    id,
    result: {
      tools: [
        {
          name: 'convert_task_markdown',
          description: 'Convert a markdown task description to JSON format',
          inputSchema: {
            type: 'object',
            properties: {
              markdownPath: {
                type: 'string',
                description: 'Path to the markdown task file'
              },
              outputPath: {
                type: 'string',
                description: 'Optional path to save the JSON output'
              }
            },
            required: ['markdownPath']
          }
        }
      ]
    }
  };
  
  process.stdout.write(JSON.stringify(response) + '\n');
  log(`Sent list_tools response for request ${id}`);
}

// Handle convert_task_markdown tool
async function handleConvertTask(id, input) {
  try {
    const { markdownPath, outputPath } = input;
    log(`Converting task: ${markdownPath} to ${outputPath || 'direct output'}`);
    
    // Use the full path to python in the virtual environment
    const pythonPath = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
    
    // Build the command with the proper paths
    const args = [
      '-m', 
      'claude_code_mcp.cli',
      'convert-task-markdown',
      markdownPath
    ];
    
    if (outputPath) {
      args.push('--output-path');
      args.push(outputPath);
    }
    
    // Log the command
    log(`Running: ${pythonPath} ${args.join(' ')}`);
    
    // Execute the command
    const childProcess = spawn(pythonPath, args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PYTHONPATH: PROJECT_ROOT,
        PYTHONUNBUFFERED: '1'
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    childProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      log(`[stdout] ${chunk.trim()}`);
    });
    
    childProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      log(`[stderr] ${chunk.trim()}`);
    });
    
    childProcess.on('close', (code) => {
      log(`Command exited with code ${code}`);
      
      if (code === 0) {
        // Success - prepare the response
        let result;
        
        if (outputPath) {
          try {
            // Try to read the output file
            const taskData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
            result = {
              success: true,
              message: `Task converted successfully. JSON written to ${outputPath}`,
              task: taskData
            };
          } catch (err) {
            log(`Error reading output file: ${err.message}`);
            result = {
              success: true,
              message: `Task conversion successful, but couldn't read the output file.`,
              output: stdout
            };
          }
        } else {
          // Return the stdout directly
          result = {
            success: true,
            message: 'Task converted successfully.',
            output: stdout
          };
        }
        
        // Send the response
        const response = {
          jsonrpc: '2.0',
          id,
          result
        };
        
        process.stdout.write(JSON.stringify(response) + '\n');
        log(`Sent success response for request ${id}`);
      } else {
        // Error - send error response
        const errorMessage = stderr || `Command failed with code ${code}`;
        const response = {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: `Error converting task: ${errorMessage}`
          }
        };
        
        process.stdout.write(JSON.stringify(response) + '\n');
        log(`Sent error response for request ${id}: ${errorMessage}`);
      }
    });
    
    childProcess.on('error', (err) => {
      log(`Command error: ${err.message}`);
      
      const response = {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Error running command: ${err.message}`
        }
      };
      
      process.stdout.write(JSON.stringify(response) + '\n');
      log(`Sent error response for request ${id}: ${err.message}`);
    });
  } catch (error) {
    log(`Error in handleConvertTask: ${error.message}`);
    
    const response = {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: `Error in conversion handler: ${error.message}`
      }
    };
    
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}

// Main message handler
rl.on('line', (line) => {
  try {
    log(`Received request: ${line}`);
    
    // Parse the JSON-RPC request
    const request = JSON.parse(line);
    const { method, id, params } = request;
    
    // Handle different methods
    if (method === 'list_tools') {
      handleListTools(id);
    }
    else if (method === 'call_tool') {
      const { name, input } = params;
      
      if (name === 'convert_task_markdown') {
        handleConvertTask(id, input);
      } else {
        // Unknown tool
        const response = {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Tool not found: ${name}`
          }
        };
        
        process.stdout.write(JSON.stringify(response) + '\n');
        log(`Sent error response for unknown tool: ${name}`);
      }
    } else {
      // Unknown method
      const response = {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      };
      
      process.stdout.write(JSON.stringify(response) + '\n');
      log(`Sent error response for unknown method: ${method}`);
    }
  } catch (error) {
    // Handle parsing errors
    log(`Error processing request: ${error.message}`);
    
    const response = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${error.message}`
      }
    };
    
    process.stdout.write(JSON.stringify(response) + '\n');
  }
});

// Handle process exit
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down');
  process.exit(0);
});

// Log start message and wait for input
log(`Bridge is running in ${__dirname} (CommonJS mode)`);
log('Waiting for requests...');