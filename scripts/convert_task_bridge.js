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

// Set up logging
const LOG_FILE = path.join(__dirname, 'convert_task_bridge.log');
function log(message) {
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
}

log('Convert Task MCP bridge started');

// Run python command
async function runPythonCommand(args) {
  return new Promise((resolve, reject) => {
    // Get Python path from virtual environment
    const pythonPath = path.join(__dirname, '.venv', 'bin', 'python');
    
    log(`Running Python command: ${pythonPath} ${args.join(' ')}`);
    
    // Run the command
    const childProcess = spawn(pythonPath, args, {
      cwd: __dirname,
      env: { ...process.env, PYTHONPATH: __dirname }
    });
    
    let stdout = '';
    let stderr = '';
    
    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    childProcess.on('close', (code) => {
      log(`Command exited with code ${code}`);
      log(`Stdout: ${stdout}`);
      log(`Stderr: ${stderr}`);
      
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
    
    childProcess.on('error', (err) => {
      log(`Command error: ${err.message}`);
      reject(err);
    });
  });
}

// Handle MCP requests
rl.on('line', async (line) => {
  try {
    log(`Received request: ${line}`);
    
    // Parse the JSON-RPC request
    const request = JSON.parse(line);
    const { method, id, params } = request;
    
    // Check which method was requested
    if (method === 'list_tools') {
      // Return tool descriptions
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
    }
    else if (method === 'call_tool') {
      // Check which tool was called
      const { name, input } = params;
      
      if (name === 'convert_task_markdown') {
        try {
          // Get input parameters
          const { markdownPath, outputPath } = input;
          log(`Converting task: ${markdownPath} to ${outputPath || 'direct output'}`);
          
          // Build command arguments
          const args = ['-m', 'claude_code_mcp.cli', 'convert-task-markdown', markdownPath];
          if (outputPath) {
            args.push('--output-path', outputPath);
          }
          
          // Run the Python command
          const result = await runPythonCommand(args);
          
          // Prepare the response
          let response;
          
          if (outputPath) {
            // If output was written to a file, try to read it
            try {
              const taskData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
              
              response = {
                jsonrpc: '2.0',
                id,
                result: {
                  success: true,
                  message: `Task converted successfully. JSON written to ${outputPath}`,
                  task: taskData
                }
              };
            } catch (err) {
              response = {
                jsonrpc: '2.0',
                id,
                result: {
                  success: true,
                  message: `Task conversion successful, but couldn't read the output file: ${err.message}`,
                  output: result.stdout
                }
              };
            }
          } else {
            // If no output path was specified, return the stdout which should contain the JSON
            response = {
              jsonrpc: '2.0',
              id,
              result: {
                success: true,
                message: 'Task converted successfully.',
                output: result.stdout
              }
            };
          }
          
          process.stdout.write(JSON.stringify(response) + '\n');
        } catch (error) {
          // Handle errors from the Python command
          const errorMessage = error.message || 'Unknown error';
          log(`Error executing tool: ${errorMessage}`);
          
          const response = {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32603,
              message: `Error converting task: ${errorMessage}`
            }
          };
          
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } else {
        // Handle unknown tool
        const response = {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Tool not found: ${name}`
          }
        };
        
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } else {
      // Handle unknown method
      const response = {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      };
      
      process.stdout.write(JSON.stringify(response) + '\n');
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

// Log startup
log(`Bridge startup complete. __dirname: ${__dirname}`);