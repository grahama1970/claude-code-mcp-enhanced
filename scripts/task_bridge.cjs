#!/usr/bin/env node
// Task Orchestration Bridge for Claude Code MCP (.cjs CommonJS format)
"use strict";

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

// Configure paths and logging
const PROJECT_ROOT = path.resolve(__dirname);
const PYTHON_PATH = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
const LOG_FILE = path.join(PROJECT_ROOT, 'mcp_bridge.log');

// Set up logging
function log(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `${timestamp} - ${message}\n`);
}

// Tool definitions
const TOOLS = [
  {
    name: 'convert_task',
    description: 'Convert a markdown task description to JSON format',
    input_schema: {
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
  },
  {
    name: 'execute_task',
    description: 'Execute a task with the task orchestration system',
    input_schema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to execute'
        }
      },
      required: ['taskId']
    }
  },
  {
    name: 'task_status',
    description: 'Check the status of a task',
    input_schema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to check'
        }
      },
      required: ['taskId']
    }
  }
];

// Helper function to execute a CLI command
async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const cmd = spawn(command, args, {
      ...options,
      env: { ...process.env, PYTHONPATH: PROJECT_ROOT, ...options.env }
    });

    let stdout = '';
    let stderr = '';

    cmd.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    cmd.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    cmd.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    cmd.on('error', (err) => {
      reject(err);
    });
  });
}

// Handle JSONRPC requests
rl.on('line', async (line) => {
  let response;
  
  try {
    log(`Received request: ${line}`);
    const request = JSON.parse(line);
    
    if (request.method === 'list_tools') {
      // Handle list_tools request
      response = {
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: TOOLS }
      };
    } 
    else if (request.method === 'call_tool') {
      // Handle call_tool request
      const { name, input } = request.params;
      
      try {
        if (name === 'convert_task') {
          // Handle convert_task
          const args = ['-m', 'claude_code_mcp.cli', 'convert-task-markdown', input.markdownPath];
          if (input.outputPath) {
            args.push('--output-path', input.outputPath);
          }
          
          log(`Executing convert_task with args: ${JSON.stringify(args)}`);
          const result = await runCommand(PYTHON_PATH, args);
          
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              status: 'success',
              output: result.stdout,
              task: JSON.parse(fs.readFileSync(input.outputPath || 'task_output.json', 'utf8'))
            }
          };
        }
        else if (name === 'execute_task') {
          // Handle execute_task
          const args = ['-m', 'claude_code_mcp.cli', 'execute-task', input.taskId];
          
          log(`Executing execute_task with args: ${JSON.stringify(args)}`);
          const result = await runCommand(PYTHON_PATH, args);
          
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              status: 'success',
              output: result.stdout
            }
          };
        }
        else if (name === 'task_status') {
          // Handle task_status
          const args = ['-m', 'claude_code_mcp.cli', 'task-status', input.taskId];
          
          log(`Executing task_status with args: ${JSON.stringify(args)}`);
          const result = await runCommand(PYTHON_PATH, args);
          
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              status: 'success',
              output: result.stdout
            }
          };
        }
        else {
          log(`Unknown tool: ${name}`);
          response = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`
            }
          };
        }
      }
      catch (error) {
        log(`Error executing tool: ${error.message}`);
        response = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: `Error executing tool: ${error.message}`
          }
        };
      }
    }
    else {
      log(`Unknown method: ${request.method}`);
      response = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`
        }
      };
    }
  }
  catch (error) {
    log(`Error processing request: ${error.message}`);
    response = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${error.message}`
      }
    };
  }
  
  // Send the response
  log(`Sending response: ${JSON.stringify(response)}`);
  process.stdout.write(JSON.stringify(response) + '\n');
});

// Log startup
log('Task Orchestration MCP bridge started');
log(`Project root: ${PROJECT_ROOT}`);
log(`Python path: ${PYTHON_PATH}`);