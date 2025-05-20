#!/usr/bin/env node
/**
 * Interact with Vertex AI Studio via MacOS Automator MCP
 * 
 * This script uses the MacOS Automator MCP through our MCP server
 * to interact with a Chrome tab showing Vertex AI Studio.
 */

const http = require('http');
const { promisify } = require('util');

// Configuration
const config = {
  mcpServerHost: 'localhost',
  mcpServerPort: 3000,
  vertexAiUrl: 'https://console.cloud.google.com/vertex-ai/studio/multimodal',
  queryText: 'What is the capital of France?'
};

/**
 * Make a request to the MCP server
 */
async function mcpRequest(tool, args) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      tool,
      arguments: args
    });
    
    const options = {
      hostname: config.mcpServerHost,
      port: config.mcpServerPort,
      path: '/mcp/tool',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(responseData);
            resolve(result);
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`));
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Perform MacOS automation action
 */
async function performMacOSAction(action, parameters = {}) {
  try {
    const result = await mcpRequest('macos_automator', {
      action,
      parameters
    });
    
    return result.content || result;
  } catch (err) {
    console.error(`Error performing MacOS action '${action}':`, err.message);
    throw err;
  }
}

/**
 * Run AppleScript
 */
async function runAppleScript(script) {
  return performMacOSAction('runAppleScript', { script });
}

/**
 * Main function to interact with Vertex AI
 */
async function interactWithVertexAI() {
  console.log('Starting interaction with Vertex AI Studio...');
  
  try {
    // Check if Chrome is running
    console.log('Checking if Chrome is running...');
    const isRunning = await runAppleScript(`
      tell application "System Events" to (name of processes) contains "Google Chrome"
    `);
    
    if (!isRunning) {
      console.log('Chrome is not running. Starting Chrome...');
      await performMacOSAction('openApplication', { name: 'Google Chrome' });
      // Wait for Chrome to start
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Open or focus the Vertex AI tab
    console.log('Opening or focusing Vertex AI Studio tab...');
    const findTabScript = `
      tell application "Google Chrome"
        set foundTab to false
        set foundTabIndex to -1
        set foundWindowIndex to -1
        
        repeat with w from 1 to count windows
          set tabCount to count tabs of window w
          repeat with t from 1 to tabCount
            set tabUrl to URL of tab t of window w
            if tabUrl contains "console.cloud.google.com/vertex-ai/studio" then
              set foundTab to true
              set foundTabIndex to t
              set foundWindowIndex to w
              exit repeat
            end if
          end repeat
          
          if foundTab then
            exit repeat
          end if
        end repeat
        
        if foundTab then
          set window foundWindowIndex to active window
          set active tab index of window foundWindowIndex to foundTabIndex
          return "Found existing Vertex AI tab"
        else
          open location "${config.vertexAiUrl}"
          delay 5
          return "Opened new Vertex AI tab"
        end if
      end tell
    `;
    
    const tabResult = await runAppleScript(findTabScript);
    console.log(`Tab operation result: ${tabResult}`);
    
    // Wait for page to load
    console.log('Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Set clipboard content to our query
    console.log(`Setting clipboard content to: "${config.queryText}"`);
    await performMacOSAction('setClipboard', { content: config.queryText });
    
    // Navigate to input field and paste text
    console.log('Finding input field and pasting text...');
    const pasteScript = `
      tell application "System Events"
        tell process "Google Chrome"
          -- Try to find and click the input area (this may need adjustment)
          delay 1
          key code 48 -- tab key
          delay 0.5
          key code 48 -- tab key
          delay 0.5
          key code 48 -- tab key
          delay 0.5
          
          -- Paste text
          keystroke "v" using command down
          delay 1
          
          -- Press Enter
          key code 36 -- return/enter key
          
          return "Text pasted and submitted"
        end tell
      end tell
    `;
    
    const pasteResult = await runAppleScript(pasteScript);
    console.log(`Paste operation result: ${pasteResult}`);
    
    // Wait for response
    console.log('Waiting for response...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Try to get the response
    console.log('Copying response...');
    const copyScript = `
      tell application "System Events"
        tell process "Google Chrome"
          -- Try to navigate to the response
          delay 1
          key code 48 -- tab key
          delay 0.5
          
          -- Select all text
          keystroke "a" using command down
          delay 0.5
          
          -- Copy it
          keystroke "c" using command down
          delay 0.5
          
          return "Response copied to clipboard"
        end tell
      end tell
    `;
    
    const copyResult = await runAppleScript(copyScript);
    console.log(`Copy operation result: ${copyResult}`);
    
    // Get clipboard content (the response)
    console.log('Retrieving response from clipboard...');
    const response = await performMacOSAction('getClipboard');
    
    console.log('\n--- RESULT FROM VERTEX AI ---');
    console.log(response);
    console.log('-----------------------------\n');
    
    return {
      success: true,
      query: config.queryText,
      response
    };
  } catch (error) {
    console.error('Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the main function
interactWithVertexAI()
  .then(result => {
    if (result.success) {
      console.log('Successfully interacted with Vertex AI Studio!');
    } else {
      console.error('Failed to interact with Vertex AI Studio:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });