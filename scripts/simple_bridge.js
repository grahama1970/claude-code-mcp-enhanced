// Simple bridge for Task Orchestration MCP
const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

// Project paths
const PROJECT_ROOT = '/home/graham/workspace/experiments/claude-code-mcp';
const PYTHON_PATH = `${PROJECT_ROOT}/.venv/bin/python`;

// Available tools
const TOOLS = [
  {
    name: 'convert_task',
    description: 'Convert a markdown task to JSON',
    input_schema: {
      type: 'object',
      properties: {
        markdownPath: {
          type: 'string',
          description: 'Path to the markdown task file'
        },
        outputPath: {
          type: 'string',
          description: 'Path to save the output JSON'
        }
      },
      required: ['markdownPath']
    }
  },
  {
    name: 'execute_task',
    description: 'Execute a task with the orchestration system',
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

// Set up JSONRPC interface
const rl = readline.createInterface({
  input: process.stdin,
  output: null,
  terminal: false
});

// Log processing for debugging
function logDebug(message) {
  fs.appendFileSync(`${PROJECT_ROOT}/mcp_bridge.log`, `${new Date().toISOString()} - ${message}\n`);
}

// Process JSONRPC requests
rl.on('line', (line) => {
  try {
    logDebug(`Received request: ${line}`);
    const request = JSON.parse(line);
    const { method, params, id } = request;
    
    // Handle different methods
    if (method === 'list_tools') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    } 
    else if (method === 'call_tool') {
      const { name, input } = params;
      
      try {
        let result;
        
        if (name === 'convert_task') {
          // Handle convert_task
          const outputArg = input.outputPath ? `--output-path ${input.outputPath}` : '';
          const command = `cd ${PROJECT_ROOT} && ${PYTHON_PATH} -m claude_code_mcp.cli convert-task-markdown ${input.markdownPath} ${outputArg}`;
          logDebug(`Executing: ${command}`);
          
          const output = execSync(command, { 
            env: { ...process.env, PYTHONPATH: PROJECT_ROOT },
            encoding: 'utf8'
          });
          
          result = { 
            status: 'success',
            output
          };
        }
        else if (name === 'execute_task') {
          // Handle execute_task
          const command = `cd ${PROJECT_ROOT} && ${PYTHON_PATH} -m claude_code_mcp.cli execute-task ${input.taskId}`;
          logDebug(`Executing: ${command}`);
          
          const output = execSync(command, { 
            env: { ...process.env, PYTHONPATH: PROJECT_ROOT },
            encoding: 'utf8'
          });
          
          result = { 
            status: 'success',
            output
          };
        }
        else if (name === 'task_status') {
          // Handle task_status
          const command = `cd ${PROJECT_ROOT} && ${PYTHON_PATH} -m claude_code_mcp.cli task-status ${input.taskId}`;
          logDebug(`Executing: ${command}`);
          
          const output = execSync(command, { 
            env: { ...process.env, PYTHONPATH: PROJECT_ROOT },
            encoding: 'utf8'
          });
          
          result = { 
            status: 'success',
            output
          };
        }
        else {
          // Unknown tool
          throw new Error(`Unknown tool: ${name}`);
        }
        
        // Send response
        const response = {
          jsonrpc: '2.0',
          id,
          result
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
      catch (error) {
        // Handle tool execution error
        logDebug(`Error executing tool: ${error.message}`);
        const response = {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: `Error executing tool: ${error.message}`
          }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    }
    else {
      // Method not found
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
  }
  catch (error) {
    // Parse error or other exception
    logDebug(`Error processing request: ${error.message}`);
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
logDebug('MCP bridge started');