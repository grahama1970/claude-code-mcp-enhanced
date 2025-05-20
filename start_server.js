#!/usr/bin/env node
/**
 * Start the Claude Code MCP server
 * 
 * This script starts the MCP server as a child process and provides
 * utilities for checking if the server is running.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Set up configuration
const config = {
  serverCommand: 'node',
  serverScript: path.join(__dirname, 'src', 'server.js'),
  port: 3000,
  host: 'localhost'
};

/**
 * Check if the MCP server is already running
 */
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      method: 'GET',
      host: config.host,
      port: config.port,
      path: '/',
      timeout: 1000
    }, (res) => {
      resolve(true); // Server is running
    });
    
    req.on('error', () => {
      resolve(false); // Server is not running
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false); // Server is not running or not responding
    });
    
    req.end();
  });
}

/**
 * Start the MCP server
 */
async function startServer() {
  // Check if server is already running
  const isRunning = await checkServerRunning();
  
  if (isRunning) {
    console.log(`MCP server is already running at ${config.host}:${config.port}`);
    return;
  }
  
  console.log('Starting MCP server...');
  
  // Start the server process
  const server = spawn(config.serverCommand, [config.serverScript], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Log server output
  server.stdout.on('data', (data) => {
    console.log(`Server stdout: ${data}`);
  });
  
  server.stderr.on('data', (data) => {
    console.log(`Server stderr: ${data}`);
  });
  
  // Handle server errors
  server.on('error', (err) => {
    console.error(`Failed to start MCP server: ${err.message}`);
    process.exit(1);
  });
  
  // Handle server exit
  server.on('exit', (code, signal) => {
    if (code !== null) {
      console.error(`MCP server exited with code ${code}`);
    } else if (signal !== null) {
      console.error(`MCP server was killed with signal ${signal}`);
    }
  });
  
  // Detach the server process
  server.unref();
  
  // Wait for the server to start
  let retries = 0;
  const maxRetries = 10;
  
  while (retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const isServerRunning = await checkServerRunning();
    
    if (isServerRunning) {
      console.log(`MCP server started successfully at ${config.host}:${config.port}`);
      return;
    }
    
    retries++;
    console.log(`Waiting for MCP server to start (${retries}/${maxRetries})...`);
  }
  
  console.error('MCP server did not start in the expected time');
  process.exit(1);
}

// Run the main function
startServer().catch((err) => {
  console.error(`Error starting MCP server: ${err.message}`);
  process.exit(1);
});