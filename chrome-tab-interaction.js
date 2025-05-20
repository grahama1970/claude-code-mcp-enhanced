#!/usr/bin/env node
/**
 * Chrome Tab Interaction using MacOS Automator MCP
 * 
 * This script accesses a specific Chrome tab, pastes text,
 * and retrieves the results.
 */

const { MacOSAutomator } = require('@steipete/macos-automator-mcp');

// Initialize the MacOS Automator
const macosAutomator = new MacOSAutomator();

// The Chrome tab URL to access
const chromeTabUrl = "https://console.cloud.google.com/vertex-ai/studio/multimodal";
const textToInput = "What is the capital of France?";

async function interactWithChromeTab() {
  try {
    console.log("Starting Chrome tab interaction...");
    
    // Check if Chrome is running
    console.log("Checking if Chrome is running...");
    const isRunning = await macosAutomator.performAction({
      action: 'runAppleScript',
      parameters: {
        script: 'tell application "System Events" to (name of processes) contains "Google Chrome"'
      }
    });
    
    if (!isRunning) {
      console.log("Chrome is not running. Starting Chrome...");
      await macosAutomator.performAction({
        action: 'openApplication',
        parameters: {
          name: 'Google Chrome'
        }
      });
      
      // Wait for Chrome to start
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Find the tab with Vertex AI Studio
    console.log("Finding the Vertex AI Studio tab...");
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
          return true
        else
          open location "${chromeTabUrl}"
          delay 5
          return false
        end if
      end tell
    `;
    
    const tabFound = await macosAutomator.performAction({
      action: 'runAppleScript',
      parameters: {
        script: findTabScript
      }
    });
    
    console.log(`Tab ${tabFound ? "found" : "opened"}. Waiting for page to load...`);
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Set the clipboard content to our query
    console.log(`Setting clipboard content to: "${textToInput}"`);
    await macosAutomator.performAction({
      action: 'setClipboard',
      parameters: {
        content: textToInput
      }
    });
    
    // Find the input field and paste text
    console.log("Finding input field and pasting text...");
    const pasteTextScript = `
      tell application "System Events"
        tell process "Google Chrome"
          -- Focus on the text area (might need to be adjusted based on the actual interface)
          keystroke tab
          delay 0.5
          keystroke tab
          delay 0.5
          keystroke tab
          delay 0.5
          
          -- Paste text
          keystroke "v" using command down
          delay 1
          
          -- Press Enter
          keystroke return
          delay 1
        end tell
      end tell
      
      return "Text pasted and submitted"
    `;
    
    const pasteResult = await macosAutomator.performAction({
      action: 'runAppleScript',
      parameters: {
        script: pasteTextScript
      }
    });
    
    console.log(`Paste operation result: ${pasteResult}`);
    
    // Wait for response to appear
    console.log("Waiting for response...");
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Select and copy the response
    console.log("Attempting to copy the response...");
    const copyResponseScript = `
      tell application "System Events"
        tell process "Google Chrome"
          -- Navigate to the response area
          keystroke tab
          delay 0.5
          
          -- Select all in the current element
          keystroke "a" using command down
          delay 0.5
          
          -- Copy the selected text
          keystroke "c" using command down
          delay 0.5
        end tell
      end tell
      
      return "Response copied to clipboard"
    `;
    
    const copyResult = await macosAutomator.performAction({
      action: 'runAppleScript',
      parameters: {
        script: copyResponseScript
      }
    });
    
    console.log(`Copy operation result: ${copyResult}`);
    
    // Get the clipboard content
    console.log("Retrieving clipboard content...");
    const clipboardContent = await macosAutomator.performAction({
      action: 'getClipboard'
    });
    
    console.log("\n--- RESULT ---");
    console.log(clipboardContent);
    console.log("-------------\n");
    
    return {
      success: true,
      result: clipboardContent
    };
  } catch (error) {
    console.error("Error interacting with Chrome tab:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute the function
interactWithChromeTab()
  .then(result => {
    if (result.success) {
      console.log("Operation completed successfully!");
    } else {
      console.error("Operation failed:", result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });