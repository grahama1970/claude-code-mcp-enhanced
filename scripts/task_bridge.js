#!/usr/bin/env node
// Simple bridge between Model Context Protocol and Python task orchestration tools

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

// Configure tools - handle both ESM and CommonJS
const SCRIPT_DIR = typeof __dirname !== 'undefined' ? __dirname : path.dirname(new URL(import.meta.url).pathname);
const PYTHON_PATH = path.join(SCRIPT_DIR, '.venv', 'bin', 'python');
const MODULE_PATH = 'claude_code_mcp.cli';
const PROJECT_PATH = SCRIPT_DIR;

// Tool definitions
const TOOLS = {
  'convert_task': {
    name: 'convert_task',
    description: 'Convert a markdown task description to JSON format',
    command: [PYTHON_PATH, '-m', MODULE_PATH, 'convert-task-markdown'],
    schema: {
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
  'execute_task': {
    name: 'execute_task',
    description: 'Execute a task with the task orchestration system',
    command: [PYTHON_PATH, '-m', MODULE_PATH, 'execute-task'],
    schema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to execute'
        },
        taskPath: {
          type: 'string',
          description: 'Optional path to the task JSON file'
        }
      },
      required: ['taskId']
    }
  },
  'task_status': {
    name: 'task_status',
    description: 'Check the status of a task',
    command: [PYTHON_PATH, '-m', MODULE_PATH, 'task-status'],
    schema: {
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
};

// Helper function to execute a command
async function executeCommand(command, args) {
  return new Promise((resolve, reject) => {
    // Use the full Python path from the virtual environment
    const process = spawn(command[0], [...command.slice(1), ...args], {
      cwd: PROJECT_PATH,
      env: {
        ...process.env,
        PYTHONPATH: PROJECT_PATH,
      }
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Handle list_tools requests
function handleListTools(request) {
  const tools = Object.values(TOOLS).map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.schema
  }));

  return {
    jsonrpc: '2.0',
    id: request.id,
    result: { tools }
  };
}

// Handle call_tool requests
async function handleCallTool(request) {
  const { name, input } = request.params;
  
  // Find the tool
  const tool = TOOLS[name];
  if (!tool) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32601,
        message: `Tool not found: ${name}`
      }
    };
  }

  try {
    // Convert parameters to CLI arguments
    const args = [];
    
    // Handle different tools
    if (name === 'convert_task') {
      args.push(input.markdownPath);
      if (input.outputPath) {
        args.push('--output-path', input.outputPath);
      }
    } else if (name === 'execute_task') {
      args.push(input.taskId);
      if (input.taskPath) {
        args.push('--task-path', input.taskPath);
      }
    } else if (name === 'task_status') {
      args.push(input.taskId);
    }

    // Execute the command
    const result = await executeCommand(tool.command, args);
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        stdout: result.stdout,
        stderr: result.stderr
      }
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: `Error executing tool: ${error.message}`
      }
    };
  }
}

// Process JSON-RPC requests
rl.on('line', async (line) => {
  let response;
  
  try {
    const request = JSON.parse(line);
    
    if (request.method === 'list_tools') {
      response = handleListTools(request);
    } else if (request.method === 'call_tool') {
      response = await handleCallTool(request);
    } else {
      response = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`
        }
      };
    }
  } catch (error) {
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
  process.stdout.write(JSON.stringify(response) + '\n');
});

// Log startup information
console.error('Task Orchestration MCP bridge started');
console.error(`Python path: ${PYTHON_PATH}`);
console.error(`Project path: ${PROJECT_PATH}`);
console.error(`Available tools: ${Object.keys(TOOLS).join(', ')}`);