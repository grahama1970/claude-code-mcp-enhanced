// Test script for the MCP server task conversion functionality
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the test markdown file
const testMarkdownPath = path.resolve(__dirname, 'docs/tasks/001_test_task_conversion.md');
// Path to save the output (optional for the API test)
const outputJsonPath = path.resolve(__dirname, 'test_api_output.json');

// Start the MCP server
console.log('Starting the MCP server...');
const server = spawn('node', ['dist/server.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: __dirname
});

// Track if we've received the server ready message
let serverReady = false;

// Handle server output
server.stderr.on('data', (data) => {
  const output = data.toString();
  console.log(`[Server] ${output.trim()}`);
  
  // Check if the server is ready
  if (output.includes('MCP server running')) {
    serverReady = true;
    console.log('\nServer is ready. Sending task conversion request...');
    
    // Send the MCP request for task conversion
    sendMcpRequest();
  }
});

// Handle server stdout
server.stdout.on('data', (data) => {
  // This would be the MCP response
  try {
    const response = JSON.parse(data.toString());
    console.log('\nReceived MCP response:');
    // Process and validate the response
    validateResponse(response);
  } catch (error) {
    console.error('Error parsing server response:', error);
    console.log('Raw response:', data.toString());
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server process error:', error);
  cleanup();
});

// Handle server exit
server.on('exit', (code) => {
  console.log(`Server process exited with code ${code}`);
  cleanup();
});

// Send the MCP request
function sendMcpRequest() {
  // First let's request the available tools to confirm
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: '1',
    method: 'mcp.ListTools'
  };
  
  console.log('Sending request to list available tools:');
  console.log(JSON.stringify(listToolsRequest, null, 2));
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // After a small delay, send the task conversion request
  setTimeout(() => {
    // Create the MCP request to convert the task
    const request = {
      jsonrpc: '2.0',
      id: '2',
      method: 'mcp.CallTool',
      params: {
        name: 'convert_task_markdown',
        arguments: {
          markdownPath: testMarkdownPath
        }
      }
    };
    
    console.log('\nSending request to convert task markdown:');
    console.log(JSON.stringify(request, null, 2));
    
    // Send the request to the server
    server.stdin.write(JSON.stringify(request) + '\n');
  }, 1000);
}

// Validate the MCP response
async function validateResponse(response) {
  console.log(JSON.stringify(response, null, 2));
  
  // If this is the tools list response
  if (response.id === '1') {
    console.log('\nAvailable tools:');
    const tools = response.result?.tools || [];
    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description.split('\n')[0]}`);
    }
    return; // Wait for the next response
  }
  
  // Check if the response contains the expected structure
  if (response.result && response.result.content && response.result.content[0] && response.result.content[0].type === 'text') {
    try {
      // Parse the text content as JSON to check if it's valid
      const taskData = JSON.parse(response.result.content[0].text);
      
      // Check if the task data has the expected structure
      if (taskData.status === 'success' && taskData.tasks && Array.isArray(taskData.tasks)) {
        console.log('\n✅ SUCCESS: Task conversion was successful!');
        console.log(`Tasks converted: ${taskData.tasksCount}`);
        
        // Save the task data to a file for inspection
        if (outputJsonPath) {
          await fs.writeFile(outputJsonPath, JSON.stringify(taskData, null, 2));
          console.log(`Tasks saved to: ${outputJsonPath}`);
        }
      } else {
        console.log('\n❌ ERROR: Task data does not have the expected structure.');
      }
    } catch (error) {
      console.error('\n❌ ERROR: Failed to parse task data:', error);
      console.log('Raw content:', response.result.content[0].text);
    }
  } else if (response.error) {
    console.log(`\n❌ ERROR: ${response.error.message} (Code: ${response.error.code})`);
  } else {
    console.log('\n❌ ERROR: Response does not have the expected structure.');
  }
  
  // Clean up after validation
  cleanup();
}

// Clean up function
function cleanup() {
  console.log('\nCleaning up...');
  // Kill the server process
  if (!server.killed) {
    server.kill();
  }
}

// Set a timeout in case the server doesn't start or respond
const timeout = setTimeout(() => {
  if (!serverReady) {
    console.error('Timeout waiting for server to start.');
  } else {
    console.error('Timeout waiting for server response.');
  }
  cleanup();
}, 15000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nTest interrupted.');
  clearTimeout(timeout);
  cleanup();
  process.exit();
});