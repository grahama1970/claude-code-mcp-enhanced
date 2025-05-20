#!/usr/bin/env node
/**
 * Simple Test for Claude Code MCP
 * 
 * This script tests the basic functionality of the Claude Code MCP server
 * by executing a simple task and monitoring its progress.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execPromise = promisify(exec);

// Simple fetch implementation for Node.js
async function fetchWithNode(url, options) {
  const http = url.startsWith('https') ? await import('https') : await import('http');
  
  return new Promise((resolve, reject) => {
    const { method = 'GET', headers = {}, body } = options || {};
    
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers
    };
    
    const req = http.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            ok: true,
            status: res.statusCode,
            json: () => JSON.parse(data),
            text: () => data
          });
        } else {
          reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

// Configuration
const config = {
  mcpServer: 'http://localhost:3000/api/v1/tools',
  reportsDir: path.join(__dirname, 'docs', 'reports'),
  pollIntervalMs: 3000,
  maxAttempts: 30
};

/**
 * Make an HTTP request to the MCP server
 */
async function mcpRequest(endpoint, data) {
  try {
    const response = await fetchWithNode(`${config.mcpServer}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    console.error(`MCP request error: ${error.message}`);
    throw error;
  }
}

/**
 * Execute a simple task
 */
async function executeSimpleTask() {
  try {
    const taskId = `simple_task_${Date.now()}`;
    
    console.log(`\nExecuting simple task: ${taskId}`);
    
    // Create the task
    const taskData = {
      tool: 'claude_code',
      arguments: {
        prompt: 'What is the capital of France? Please provide a brief answer.'
      }
    };
    
    console.log('Sending request to MCP server...');
    const result = await mcpRequest('/execute', taskData);
    
    console.log('\nTask completed!');
    console.log('Result:');
    console.log(result);
    
    return result;
  } catch (error) {
    console.error(`Error executing simple task: ${error.message}`);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting simple test for Claude Code MCP...');
    
    // Run a simple task to test the system
    const result = await executeSimpleTask();
    
    console.log('\nSimple test completed successfully!');
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});