#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type ServerResult,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve as pathResolve, dirname } from 'node:path';
import * as path from 'path';
import * as os from 'os'; // Added os import
import { fileURLToPath } from 'node:url';
import retry from 'async-retry';
import packageJson from '../package.json' with { type: 'json' }; // Import package.json with attribute

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import task command functions
// Using the pooled implementation for better resource management
import { convertTaskMarkdown, executeTask, taskStatus } from './pooled_task_command.js';

// Import boomerang task handler for task orchestration
import { createBoomerangTask, getParentTaskResults } from './boomerang_handler.js';

// Import MacOS Automator MCP
import { MacOSAutomator } from '@steipete/macos-automator-mcp';

// Task execution mode configuration
const defaultTaskExecutionMode = process.env.MCP_DEFAULT_TASK_EXECUTION_MODE === 'parallel' ? 'parallel' : 'sequential';

// Define environment variables globally
const debugMode = process.env.MCP_CLAUDE_DEBUG === 'true';
const heartbeatIntervalMs = parseInt(process.env.MCP_HEARTBEAT_INTERVAL_MS || '15000', 10); // Default: 15 seconds
const executionTimeoutMs = parseInt(process.env.MCP_EXECUTION_TIMEOUT_MS || '1800000', 10); // Default: 30 minutes
const useRooModes = process.env.MCP_USE_ROOMODES === 'true'; // Enable Roo mode integration
const maxRetries = parseInt(process.env.MCP_MAX_RETRIES || '3', 10); // Default: 3 retries
const retryDelayMs = parseInt(process.env.MCP_RETRY_DELAY_MS || '1000', 10); // Default: 1 second
const watchRooModes = process.env.MCP_WATCH_ROOMODES === 'true'; // Auto-reload .roomodes file on changes

// Dedicated debug logging function
function debugLog(message?: any, ...optionalParams: any[]): void {
  if (debugMode) {
    console.error(message, ...optionalParams);
  }
}

/**
 * Determine the Claude CLI command/path.
 * 1. Checks for Claude CLI at the local user path: ~/.claude/local/claude.
 * 2. If not found, defaults to 'claude', relying on the system's PATH for lookup.
 */
function findClaudeCli(): string {
  debugLog('[Debug] Attempting to find Claude CLI...');

  // 1. Try local install path: ~/.claude/local/claude
  const userPath = join(homedir(), '.claude', 'local', 'claude');
  debugLog(`[Debug] Checking for Claude CLI at local user path: ${userPath}`);

  if (existsSync(userPath)) {
    debugLog(`[Debug] Found Claude CLI at local user path: ${userPath}. Using this path.`);
    return userPath;
  } else {
    debugLog(`[Debug] Claude CLI not found at local user path: ${userPath}.`);
  }

  // 2. Fallback to 'claude' (PATH lookup)
  debugLog('[Debug] Falling back to "claude" command name, relying on spawn/PATH lookup.');
  console.warn('[Warning] Claude CLI not found at ~/.claude/local/claude. Falling back to "claude" in PATH. Ensure it is installed and accessible.');
  return 'claude';
}

/**
 * Interface for Claude Code tool arguments
 */
interface ClaudeCodeArgs {
  prompt: string;
  workFolder?: string;
  parentTaskId?: string;
  returnMode?: 'summary' | 'full';
  taskDescription?: string;
  mode?: string; // Roo mode to use (matches slug in .roomodes)
}

// Cache for Roo modes configuration to improve performance
let roomodesCache: { data: any, timestamp: number } | null = null;
const CACHE_TTL_MS = 60000; // 1 minute cache TTL

// Setup file watcher for roomodes if enabled
if (useRooModes && watchRooModes) {
  const roomodesPath = path.join(process.cwd(), '.roomodes');
  if (existsSync(roomodesPath)) {
    try {
      const watcher = watch(roomodesPath, (eventType, filename) => {
        if (eventType === 'change') {
          // Invalidate cache when file changes
          roomodesCache = null;
          console.error(`[Info] .roomodes file changed, cache invalidated`);
        }
      });
      
      // Ensure the watcher is closed on process exit
      process.on('exit', () => {
        try {
          watcher.close();
        } catch (err) {
          // Ignore errors during shutdown
        }
      });
      
      console.error(`[Setup] Watching .roomodes file for changes`);
    } catch (error) {
      console.error(`[Warning] Failed to set up watcher for .roomodes file:`, error);
    }
  } else {
    console.error(`[Warning] Cannot watch .roomodes file as it doesn't exist at: ${roomodesPath}`);
  }
}

// Function to load Roo modes configuration with caching
function loadRooModes(): any {
  try {
    const roomodesPath = path.join(process.cwd(), '.roomodes');
    if (!existsSync(roomodesPath)) {
      return null;
    }
    
    // Check if we have a fresh cached version
    const fs = require('fs');
    const stats = fs.statSync(roomodesPath);
    const fileModifiedTime = stats.mtimeMs;
    
    // Use cache if available and fresh
    if (roomodesCache && roomodesCache.timestamp > fileModifiedTime) {
      if (Date.now() - roomodesCache.timestamp < CACHE_TTL_MS) {
        debugLog('[Debug] Using cached .roomodes configuration');
        return roomodesCache.data;
      }
    }
    
    // Otherwise read the file and update cache
    const roomodesContent = fs.readFileSync(roomodesPath, 'utf8');
    const parsedData = JSON.parse(roomodesContent);
    
    // Update cache
    roomodesCache = {
      data: parsedData,
      timestamp: Date.now()
    };
    
    debugLog('[Debug] Loaded fresh .roomodes configuration');
    return parsedData;
  } catch (error) {
    debugLog('[Error] Failed to load .roomodes file:', error);
    return null;
  }
}

// Ensure spawnAsync is defined correctly *before* the class
/**
 * Execute a command asynchronously with progress reporting to prevent client timeouts.
 * Sends heartbeat messages to stderr every 15 seconds to keep the connection alive.
 */
async function spawnAsync(command: string, args: string[], options?: { timeout?: number, cwd?: string }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    debugLog(`[Spawn] Running command: ${command} ${args.join(' ')}`);
    const process = spawn(command, args, {
      shell: false, // Reverted to false
      timeout: options?.timeout,
      cwd: options?.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let executionStartTime = Date.now();
    let heartbeatCounter = 0;

    // Set up progress reporter to prevent client timeouts
    // Send a heartbeat message at the configured interval
    const progressReporter = setInterval(() => {
      heartbeatCounter++;
      const elapsedSeconds = Math.floor((Date.now() - executionStartTime) / 1000);
      const heartbeatMessage = `[Progress] Claude Code execution in progress: ${elapsedSeconds}s elapsed (heartbeat #${heartbeatCounter})`;
      
      // Log heartbeat to stderr which will be seen by the client
      console.error(heartbeatMessage);
      debugLog(heartbeatMessage);
    }, heartbeatIntervalMs);

    process.stdout.on('data', (data) => { stdout += data.toString(); });
    process.stderr.on('data', (data) => {
      stderr += data.toString();
      debugLog(`[Spawn Stderr Chunk] ${data.toString()}`);
    });

    process.on('error', (error: NodeJS.ErrnoException) => {
      clearInterval(progressReporter); // Clean up the interval
      debugLog(`[Spawn Error Event] Full error object:`, error);
      let errorMessage = `Spawn error: ${error.message}`;
      if (error.path) {
        errorMessage += ` | Path: ${error.path}`;
      }
      if (error.syscall) {
        errorMessage += ` | Syscall: ${error.syscall}`;
      }
      errorMessage += `\nStderr: ${stderr.trim()}`;
      reject(new Error(errorMessage));
    });

    process.on('close', (code) => {
      clearInterval(progressReporter); // Clean up the interval
      const executionTimeMs = Date.now() - executionStartTime;
      debugLog(`[Spawn Close] Exit code: ${code}, Execution time: ${executionTimeMs}ms`);
      debugLog(`[Spawn Stderr Full] ${stderr.trim()}`);
      debugLog(`[Spawn Stdout Full] ${stdout.trim()}`);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}\nStderr: ${stderr.trim()}\nStdout: ${stdout.trim()}`));
      }
    });
  });
}

/**
 * MCP Server for Claude Code
 * Provides a simple MCP tool to run Claude CLI in one-shot mode
 */
class ClaudeCodeServer {
  private server: Server;
  private claudeCliPath: string; // This now holds either a full path or just 'claude'
  private packageVersion: string; // Add packageVersion property
  private activeRequests: Set<string> = new Set(); // Track active request IDs
  private macosAutomator: MacOSAutomator; // MacOS Automator MCP

  constructor() {
    // Use the simplified findClaudeCli function
    this.claudeCliPath = findClaudeCli(); // Removed debugMode argument
    console.error(`[Setup] Using Claude CLI command/path: ${this.claudeCliPath}`);
    this.packageVersion = packageJson.version; // Access version directly
    
    // Initialize MacOS Automator MCP
    try {
      this.macosAutomator = new MacOSAutomator();
      console.error('[Setup] MacOS Automator MCP initialized successfully');
    } catch (error) {
      console.error('[Warning] Failed to initialize MacOS Automator MCP:', error);
    }

    this.server = new Server(
      {
        name: 'claude_code',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Improved error handling and graceful shutdown
    this.server.onerror = (error) => console.error('[Error]', error);
    
    // Handle shutdown signals
    const handleShutdown = async (signal: string) => {
      console.error(`[Shutdown] Received ${signal} signal. Graceful shutdown initiated.`);
      
      // If there are active requests, wait briefly for them to complete
      if (this.activeRequests.size > 0) {
        console.error(`[Shutdown] Waiting for ${this.activeRequests.size} active requests to complete...`);
        
        // Wait up to 10 seconds for active requests to complete
        const shutdownTimeoutMs = 10000;
        const shutdownStart = Date.now();
        
        while (this.activeRequests.size > 0 && (Date.now() - shutdownStart) < shutdownTimeoutMs) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (this.activeRequests.size > 0) {
          console.error(`[Shutdown] ${this.activeRequests.size} requests still active after timeout. Proceeding with shutdown anyway.`);
        } else {
          console.error('[Shutdown] All active requests completed successfully.');
        }
      }
      
      // Close the server
      await this.server.close();
      console.error('[Shutdown] Server closed. Exiting process.');
      process.exit(0);
    };
    
    // Register signal handlers
    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  }

  /**
   * Set up the MCP tool handlers
   */
  private setupToolHandlers(): void {
    // Define available tools
    // Add a health check and version info tool
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'health',
          description: 'Returns health status, version information, and current configuration of the Claude Code MCP server.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'convert_task_markdown',
          description: 'Converts markdown task files into Claude Code MCP-compatible JSON format. Returns an array of tasks that can be executed using the claude_code tool.',
          inputSchema: {
            type: 'object',
            properties: {
              markdownPath: {
                type: 'string',
                description: 'Path to the markdown task file to convert.',
              },
              outputPath: {
                type: 'string',
                description: 'Optional path where to save the JSON output. If not provided, returns the JSON directly.',
              },
            },
            required: ['markdownPath'],
          },
        },
        {
          name: 'execute_task',
          description: 'Execute a task with the task orchestration system. Tasks can be run in sequential or parallel mode.',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: 'ID of the task to execute',
              },
              executionMode: {
                type: 'string',
                enum: ['sequential', 'parallel'],
                description: 'Execution mode for task (sequential or parallel). Defaults to sequential.',
              },
            },
            required: ['taskId'],
          },
        },
        {
          name: 'task_status',
          description: 'Check the status of a task being executed by the task orchestration system.',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: 'ID of the task to check status for',
              },
            },
            required: ['taskId'],
          },
        },
        {
          name: 'create_boomerang_task',
          description: 'Create a boomerang task (child task) that reports back to a parent task. Used for complex task orchestration.',
          inputSchema: {
            type: 'object',
            properties: {
              parentTaskId: {
                type: 'string',
                description: 'ID of the parent task that will receive the results',
              },
              description: {
                type: 'string',
                description: 'Short description of the child task for organization and tracking',
              },
              prompt: {
                type: 'string',
                description: 'The detailed prompt for the child task to execute',
              },
              workFolder: {
                type: 'string',
                description: 'Optional working directory for the task execution',
              },
              returnMode: {
                type: 'string',
                enum: ['summary', 'full'],
                description: 'How results should be returned: summary (concise) or full (detailed). Defaults to full.',
              },
              mode: {
                type: 'string',
                description: 'Optional Roo mode to use for Claude execution',
              },
            },
            required: ['parentTaskId', 'description', 'prompt'],
          },
        },
        {
          name: 'get_parent_task_results',
          description: 'Get the results of a parent task and its child tasks. Used to check the status and results of orchestrated tasks.',
          inputSchema: {
            type: 'object',
            properties: {
              parentTaskId: {
                type: 'string',
                description: 'ID of the parent task to get results for',
              },
            },
            required: ['parentTaskId'],
          },
        },
        {
          name: 'macos_automator',
          description: 'Automate macOS operations including controlling applications, manipulating files, and running AppleScript.',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: 'The action to perform (openApplication, runAppleScript, getClipboard, setClipboard, etc.)',
              },
              parameters: {
                type: 'object',
                description: 'Parameters for the action (varies by action type)',
              },
            },
            required: ['action'],
          },
        },
        {
          name: 'claude_code',
          description: `Claude Code Agent: Your versatile multi-modal assistant for code, file, Git, and terminal operations via Claude CLI. Use \`workFolder\` for contextual execution.

• File ops: Create, read, (fuzzy) edit, move, copy, delete, list files, analyze/ocr images, file content analysis
    └─ e.g., "Create /tmp/log.txt with 'system boot'", "Edit main.py to replace 'debug_mode = True' with 'debug_mode = False'", "List files in /src", "Move a specific section somewhere else"

• Code: Generate / analyse / refactor / fix
    └─ e.g. "Generate Python to parse CSV→JSON", "Find bugs in my_script.py"

• Git: Stage ▸ commit ▸ push ▸ tag (any workflow)
    └─ "Commit '/workspace/src/main.java' with 'feat: user auth' to develop."

• Terminal: Run any CLI cmd or open URLs
    └─ "npm run build", "Open https://developer.mozilla.org"

• Web search + summarise content on-the-fly

• Multi-step workflows  (Version bumps, changelog updates, release tagging, etc.)

• GitHub integration  Create PRs, check CI status

• Confused or stuck on an issue? Ask Claude Code for a second opinion, it might surprise you!

• Task Orchestration with "Boomerang" pattern
    └─ Break down complex tasks into subtasks for Claude Code to execute separately
    └─ Pass parent task ID and get results back for complex workflows
    └─ Specify return mode (summary or full) for tailored responses

**Prompt tips**

1. Be concise, explicit & step-by-step for complex tasks. No need for niceties, this is a tool to get things done.
2. For multi-line text, write it to a temporary file in the project root, use that file, then delete it.
3. If you get a timeout, split the task into smaller steps.
4. **Seeking a second opinion/analysis**: If you're stuck or want advice, you can ask \`claude_code\` to analyze a problem and suggest solutions. Clearly state in your prompt that you are looking for analysis only and no actual file modifications should be made.
5. If workFolder is set to the project path, there is no need to repeat that path in the prompt and you can use relative paths for files.
6. Claude Code is really good at complex multi-step file operations and refactorings and faster than your native edit features.
7. Combine file operations, README updates, and Git commands in a sequence.
8. **Task Orchestration**: For complex workflows, use \`parentTaskId\` to create subtasks and \`returnMode: "summary"\` to get concise results back.
9. Claude can do much more, just ask it!

        `,
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'The detailed natural language prompt for Claude to execute.',
              },
              workFolder: {
                type: 'string',
                description: 'Mandatory when using file operations or referencing any file. The working directory for the Claude CLI execution.',
              },
              parentTaskId: {
                type: 'string',
                description: 'Optional ID of the parent task that created this task (for task orchestration/boomerang).',
              },
              returnMode: {
                type: 'string',
                enum: ['summary', 'full'],
                description: 'How results should be returned: summary (concise) or full (detailed). Defaults to full.',
              },
              taskDescription: {
                type: 'string',
                description: 'Short description of the task for better organization and tracking in orchestrated workflows.',
              },
              mode: {
                type: 'string',
                description: 'When MCP_USE_ROOMODES=true, specifies the mode from .roomodes to use (e.g., "boomerang-mode", "coder", "designer", etc.).',
              },
            },
            required: ['prompt'],
          },
        }
      ],
    }));

    // Handle tool calls using the configurable execution timeout
    this.server.setRequestHandler(CallToolRequestSchema, async (args, call): Promise<ServerResult> => {
      // Generate a unique request ID
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.activeRequests.add(requestId);
      
      debugLog(`[Debug] Handling CallToolRequest: ${requestId}`, args);

      // Correctly access toolName from args.params.name (may include namespace)
      const fullToolName = args.params.name;
      // Extract the local tool name (remove namespace if present)
      const toolName = fullToolName.includes(':') ? fullToolName.split(':')[1] : fullToolName;
      
      debugLog(`[Debug] Tool request: ${fullToolName}, Local tool name: ${toolName}`);
      
      // Handle health check tool
      if (toolName === 'health') {
        // Check if Claude CLI is accessible
        let claudeCliStatus = 'unknown';
        try {
          const { stdout } = await spawnAsync('/bin/bash', [this.claudeCliPath, '--version'], { timeout: 5000 });
          claudeCliStatus = 'available';
        } catch (error) {
          claudeCliStatus = 'unavailable';
        }

        // Collect and return system information
        const healthInfo = {
          status: 'ok',
          version: this.packageVersion,
          claudeCli: {
            path: this.claudeCliPath,
            status: claudeCliStatus
          },
          config: {
            debugMode,
            heartbeatIntervalMs,
            executionTimeoutMs,
            useRooModes,
            maxRetries,
            retryDelayMs
          },
          system: {
            platform: os.platform(),
            release: os.release(),
            arch: os.arch(),
            cpus: os.cpus().length,
            memory: {
              total: Math.round(os.totalmem() / (1024 * 1024)) + 'MB',
              free: Math.round(os.freemem() / (1024 * 1024)) + 'MB'
            },
            uptime: Math.round(os.uptime() / 60) + ' minutes'
          },
          timestamp: new Date().toISOString()
        };
        
        // Health check request completed, remove from tracking
        this.activeRequests.delete(requestId);
        debugLog(`[Debug] Health check request ${requestId} completed`);

        return { content: [{ type: 'text', text: JSON.stringify(healthInfo, null, 2) }] };
      }
      
      // Handle convert_task_markdown tool
      if (toolName === 'convert_task_markdown') {
        const toolArguments = args.params.arguments;
        
        // Extract markdownPath (required)
        let markdownPath: string;
        if (
          toolArguments &&
          typeof toolArguments === 'object' &&
          'markdownPath' in toolArguments &&
          typeof toolArguments.markdownPath === 'string'
        ) {
          markdownPath = toolArguments.markdownPath;
        } else {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid required parameter: markdownPath for convert_task_markdown tool');
        }
        
        // Extract outputPath (optional)
        let outputPath: string | undefined;
        if (toolArguments.outputPath && typeof toolArguments.outputPath === 'string') {
          outputPath = toolArguments.outputPath;
        }
        
        debugLog(`[Debug] Converting markdown task file: ${markdownPath}`);
        
        let stderr = '';
        
        try {
          // Prepare command to run task_converter.py
          const pythonPath = 'python3';
          const converterPath = pathResolve(__dirname, '../docs/task_converter.py');
          
          // Use --json-output flag to get JSON to stdout
          const args = ['--json-output', markdownPath];
          
          const result = await spawnAsync(pythonPath, [converterPath, ...args], {
            cwd: homedir(),
            timeout: 30000 // 30 seconds timeout
          });
          
          const stdout = result.stdout;
          stderr = result.stderr;
          
          // Extract progress messages and actual errors
          const stderrLines = stderr.split('\n');
          const progressMessages = stderrLines.filter(line => line.includes('[Progress]'));
          const errorMessages = stderrLines.filter(line => !line.includes('[Progress]') && line.trim());
          
          // Log progress messages
          progressMessages.forEach(msg => {
            console.error(msg); // Send to client
            debugLog(msg);
          });
          
          if (errorMessages.length > 0) {
            stderr = errorMessages.join('\n');
            debugLog(`[Debug] Task converter stderr: ${stderr}`);
          }
          
          // Check if there was an error from the converter
          if (stderr && stderr.includes('Markdown format validation failed')) {
            // Return validation error as a structured response
            const validationError = {
              status: 'error',
              error: 'Markdown format validation failed',
              details: stderr,
              helpUrl: 'https://github.com/grahama1970/claude-code-mcp/blob/main/README.md#markdown-task-file-format'
            };
            
            this.activeRequests.delete(requestId);
            return { content: [{ type: 'text', text: JSON.stringify(validationError, null, 2) }] };
          }
          
          // Parse the JSON output
          const tasks = JSON.parse(stdout);
          
          // If outputPath is provided, also save to file
          if (outputPath) {
            await fs.writeFile(outputPath, JSON.stringify(tasks, null, 2));
            debugLog(`[Debug] Saved converted tasks to: ${outputPath}`);
          }
          
          // Return the converted tasks
          const response = {
            status: 'success',
            tasksCount: tasks.length,
            outputPath: outputPath || 'none',
            tasks: tasks
          };
          
          this.activeRequests.delete(requestId);
          return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
          
        } catch (error) {
          this.activeRequests.delete(requestId);
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Check if this is a JSON parsing error (indicating validation failure)
          if (errorMessage.includes('JSON') && stderr) {
            const validationError = {
              status: 'error',
              error: 'Task conversion failed',
              details: stderr || errorMessage,
              helpUrl: 'https://github.com/grahama1970/claude-code-mcp/blob/main/README.md#markdown-task-file-format'
            };
            return { content: [{ type: 'text', text: JSON.stringify(validationError, null, 2) }] };
          }
          
          throw new McpError(ErrorCode.InternalError, `Failed to convert markdown tasks: ${errorMessage}`);
        }
      }
      
      // Handle execute_task tool
      if (toolName === 'execute_task') {
        const toolArguments = args.params.arguments;
        
        // Extract taskId (required)
        let taskId: string;
        let executionMode: 'sequential' | 'parallel' | undefined;
        
        if (
          toolArguments &&
          typeof toolArguments === 'object' &&
          'taskId' in toolArguments &&
          typeof toolArguments.taskId === 'string'
        ) {
          taskId = toolArguments.taskId;
        } else {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid required parameter: taskId for execute_task tool');
        }
        
        // Extract executionMode (optional)
        if (toolArguments.executionMode && 
            (toolArguments.executionMode === 'sequential' || toolArguments.executionMode === 'parallel')) {
          executionMode = toolArguments.executionMode;
        }
        
        debugLog(`[Debug] Executing task: ${taskId} in ${executionMode || 'sequential'} mode`);
        
        try {
          const result = await executeTask({ taskId, executionMode });
          
          this.activeRequests.delete(requestId);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          this.activeRequests.delete(requestId);
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new McpError(ErrorCode.InternalError, `Failed to execute task: ${errorMessage}`);
        }
      }
      
      // Handle task_status tool
      if (toolName === 'task_status') {
        const toolArguments = args.params.arguments;
        
        // Extract taskId (required)
        let taskId: string;
        
        if (
          toolArguments &&
          typeof toolArguments === 'object' &&
          'taskId' in toolArguments &&
          typeof toolArguments.taskId === 'string'
        ) {
          taskId = toolArguments.taskId;
        } else {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid required parameter: taskId for task_status tool');
        }
        
        debugLog(`[Debug] Checking status for task: ${taskId}`);
        
        try {
          const result = await taskStatus({ taskId });
          
          this.activeRequests.delete(requestId);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          this.activeRequests.delete(requestId);
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new McpError(ErrorCode.InternalError, `Failed to check task status: ${errorMessage}`);
        }
      }
      
      // Handle create_boomerang_task tool
      if (toolName === 'create_boomerang_task') {
        const toolArguments = args.params.arguments;
        
        // Extract required parameters
        let parentTaskId: string;
        let description: string;
        let prompt: string;
        
        if (
          toolArguments &&
          typeof toolArguments === 'object' &&
          'parentTaskId' in toolArguments &&
          typeof toolArguments.parentTaskId === 'string' &&
          'description' in toolArguments &&
          typeof toolArguments.description === 'string' &&
          'prompt' in toolArguments &&
          typeof toolArguments.prompt === 'string'
        ) {
          parentTaskId = toolArguments.parentTaskId;
          description = toolArguments.description;
          prompt = toolArguments.prompt;
        } else {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid required parameters for create_boomerang_task tool');
        }
        
        // Extract optional parameters
        let workFolder: string | undefined;
        let returnMode: 'summary' | 'full' | undefined;
        let mode: string | undefined;
        
        if (toolArguments.workFolder && typeof toolArguments.workFolder === 'string') {
          workFolder = toolArguments.workFolder;
        }
        
        if (toolArguments.returnMode && 
            (toolArguments.returnMode === 'summary' || toolArguments.returnMode === 'full')) {
          returnMode = toolArguments.returnMode;
        }
        
        if (toolArguments.mode && typeof toolArguments.mode === 'string') {
          mode = toolArguments.mode;
        }
        
        debugLog(`[Debug] Creating boomerang task for parent ${parentTaskId}, description: ${description}`);
        
        try {
          const result = await createBoomerangTask(
            parentTaskId,
            description,
            prompt,
            {
              workFolder,
              returnMode,
              mode
            }
          );
          
          this.activeRequests.delete(requestId);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          this.activeRequests.delete(requestId);
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new McpError(ErrorCode.InternalError, `Failed to create boomerang task: ${errorMessage}`);
        }
      }
      
      // Handle get_parent_task_results tool
      if (toolName === 'get_parent_task_results') {
        const toolArguments = args.params.arguments;
        
        // Extract parentTaskId (required)
        let parentTaskId: string;
        
        if (
          toolArguments &&
          typeof toolArguments === 'object' &&
          'parentTaskId' in toolArguments &&
          typeof toolArguments.parentTaskId === 'string'
        ) {
          parentTaskId = toolArguments.parentTaskId;
        } else {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid required parameter: parentTaskId for get_parent_task_results tool');
        }
        
        debugLog(`[Debug] Getting results for parent task: ${parentTaskId}`);
        
        try {
          const results = await getParentTaskResults(parentTaskId);
          
          if (!results) {
            const notFoundResponse = {
              success: false,
              message: `Parent task ${parentTaskId} not found or has no results yet`,
              parentTaskId
            };
            
            this.activeRequests.delete(requestId);
            return { content: [{ type: 'text', text: JSON.stringify(notFoundResponse, null, 2) }] };
          }
          
          const response = {
            success: true,
            message: `Results retrieved for parent task ${parentTaskId}`,
            ...results
          };
          
          this.activeRequests.delete(requestId);
          return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
        } catch (error) {
          this.activeRequests.delete(requestId);
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new McpError(ErrorCode.InternalError, `Failed to get parent task results: ${errorMessage}`);
        }
      }
      
      // Handle macos_automator tool
      if (toolName === 'macos_automator') {
        if (!this.macosAutomator) {
          throw new McpError(ErrorCode.InternalError, 'MacOS Automator MCP not initialized');
        }
        
        const toolArguments = args.params.arguments;
        
        // Extract action (required)
        let action: string;
        let parameters: object = {};
        
        if (
          toolArguments &&
          typeof toolArguments === 'object' &&
          'action' in toolArguments &&
          typeof toolArguments.action === 'string'
        ) {
          action = toolArguments.action;
        } else {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid required parameter: action for macos_automator tool');
        }
        
        // Extract parameters (optional)
        if (toolArguments.parameters && typeof toolArguments.parameters === 'object') {
          parameters = toolArguments.parameters;
        }
        
        debugLog(`[Debug] Executing MacOS Automator action: ${action}`);
        
        try {
          const result = await this.macosAutomator.performAction({
            action,
            parameters
          });
          
          this.activeRequests.delete(requestId);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          this.activeRequests.delete(requestId);
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new McpError(ErrorCode.InternalError, `MacOS Automator error: ${errorMessage}`);
        }
      }
      
      // Handle the supported tools
      if (toolName !== 'claude_code' && toolName !== 'health' && toolName !== 'convert_task_markdown' && 
          toolName !== 'execute_task' && toolName !== 'task_status' && 
          toolName !== 'create_boomerang_task' && toolName !== 'get_parent_task_results' &&
          toolName !== 'macos_automator') {
        // ErrorCode.ToolNotFound should be ErrorCode.MethodNotFound as per SDK for tools
        throw new McpError(ErrorCode.MethodNotFound, `Tool ${toolName} not found`);
      }

      // Robustly access arguments from args.params.arguments
      const toolArguments = args.params.arguments;
      let prompt: string;
      let parentTaskId: string | undefined;
      let returnMode: 'summary' | 'full' = 'full';
      let taskDescription: string | undefined;
      let mode: string | undefined;

      // Validate and extract prompt (required)
      if (
        toolArguments &&
        typeof toolArguments === 'object' &&
        'prompt' in toolArguments &&
        typeof toolArguments.prompt === 'string'
      ) {
        prompt = toolArguments.prompt;
      } else {
        throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid required parameter: prompt (must be an object with a string "prompt" property) for claude_code tool');
      }

      // Extract optional parameters for task orchestration
      if (toolArguments.parentTaskId && typeof toolArguments.parentTaskId === 'string') {
        parentTaskId = toolArguments.parentTaskId;
        debugLog(`[Debug] Task has parent ID: ${parentTaskId}`);
      }

      if (toolArguments.returnMode && 
          (toolArguments.returnMode === 'summary' || toolArguments.returnMode === 'full')) {
        returnMode = toolArguments.returnMode;
        debugLog(`[Debug] Task return mode: ${returnMode}`);
      }

      if (toolArguments.taskDescription && typeof toolArguments.taskDescription === 'string') {
        taskDescription = toolArguments.taskDescription;
        debugLog(`[Debug] Task description: ${taskDescription}`);
      }
      
      // Check for Roo mode
      if (useRooModes && toolArguments.mode && typeof toolArguments.mode === 'string') {
        mode = toolArguments.mode;
        debugLog(`[Debug] Using Roo mode: ${mode}`);
      }

      // Determine the working directory
      let effectiveCwd = homedir(); // Default CWD is user's home directory

      // Check if workFolder is provided in the tool arguments
      if (toolArguments.workFolder && typeof toolArguments.workFolder === 'string') {
        const resolvedCwd = pathResolve(toolArguments.workFolder);
        debugLog(`[Debug] Specified workFolder: ${toolArguments.workFolder}, Resolved to: ${resolvedCwd}`);

        // Check if the resolved path exists
        if (existsSync(resolvedCwd)) {
          effectiveCwd = resolvedCwd;
          debugLog(`[Debug] Using workFolder as CWD: ${effectiveCwd}`);
        } else {
          debugLog(`[Warning] Specified workFolder does not exist: ${resolvedCwd}. Using default: ${effectiveCwd}`);
        }
      } else {
        debugLog(`[Debug] No workFolder provided, using default CWD: ${effectiveCwd}`);
      }
      
      // For tasks with a parent, add boomerang context to the prompt
      if (parentTaskId) {
        // Prepend task context to prompt
        const taskContext = `
# Boomerang Task
${taskDescription ? `## Task Description\n${taskDescription}\n\n` : ''}
## Parent Task ID
${parentTaskId}

## Return Instructions
You are part of a larger workflow. After completing your task, you should ${returnMode === 'summary' ? 'provide a BRIEF SUMMARY of the results' : 'return your FULL RESULTS'}.

${returnMode === 'summary' ? 'IMPORTANT: Keep your response concise and focused on key findings/changes only!' : ''}

---

`;
        prompt = taskContext + prompt;
        debugLog(`[Debug] Prepended boomerang task context to prompt`);
      }

      try {
        debugLog(`[Debug] Attempting to execute Claude CLI with prompt: "${prompt}" in CWD: "${effectiveCwd}"`);

        let claudeProcessArgs = [this.claudeCliPath, '--dangerously-skip-permissions'];
        
        // Handle Roo mode selection if enabled and specified
        if (useRooModes && mode) {
          // Load room modes configuration
          const roomodes = loadRooModes();
          if (roomodes && roomodes.customModes) {
            // Find the matching mode
            const selectedMode = roomodes.customModes.find((m: any) => m.slug === mode);
            if (selectedMode) {
              debugLog(`[Debug] Found Roo mode configuration for: ${mode}`);
              // Add the mode parameter to the Claude CLI command
              claudeProcessArgs.push('--role', selectedMode.roleDefinition);
              // If the mode has a specific model, use it
              if (selectedMode.apiConfiguration && selectedMode.apiConfiguration.modelId) {
                claudeProcessArgs.push('--model', selectedMode.apiConfiguration.modelId);
              }
            } else {
              debugLog(`[Warning] Specified Roo mode not found: ${mode}`);
            }
          } else {
            debugLog(`[Warning] Roo modes configuration not found or invalid`);
          }
        }
        
        // Add the prompt
        claudeProcessArgs.push('-p', prompt);
        
        debugLog(`[Debug] Invoking /bin/bash with args: ${claudeProcessArgs.join(' ')}`);

        // Use retry for robust execution
        const { stdout, stderr } = await retry(
          async (bail: (err: Error) => void, attemptNumber: number) => {
            try {
              if (attemptNumber > 1) {
                debugLog(`[Retry] Attempt ${attemptNumber}/${maxRetries + 1} for Claude CLI execution`);
              }
              
              return await spawnAsync(
                '/bin/bash', // Explicitly use /bin/bash as the command
                claudeProcessArgs, // Pass the script path as the first argument to bash
                { timeout: executionTimeoutMs, cwd: effectiveCwd }
              );
            } catch (err: any) {
              // Log the error
              debugLog(`[Retry] Error during attempt ${attemptNumber}/${maxRetries + 1}: ${err.message}`);
              
              // Determine if we should retry based on the error
              const isNetworkError = err.message.includes('ECONNRESET') || 
                                    err.message.includes('ETIMEDOUT') ||
                                    err.message.includes('ECONNREFUSED');
                                    
              const isTransientError = isNetworkError || 
                                      err.message.includes('429') || // Rate limit
                                      err.message.includes('500'); // Server error
              
              // If it's not a transient error, bail immediately
              if (!isTransientError) {
                debugLog(`[Retry] Non-retryable error: ${err.message}. Bailing out.`);
                bail(err);
                return { stdout: '', stderr: '' }; // This never happens due to bail
              }
              
              // Otherwise, throw to trigger retry
              throw err;
            }
          },
          {
            retries: maxRetries,
            minTimeout: retryDelayMs,
            onRetry: (err: Error, attempt: number) => {
              console.error(`[Progress] Retry attempt ${attempt}/${maxRetries} due to: ${err.message}`);
            }
          }
        );

        debugLog('[Debug] Claude CLI stdout:', stdout.trim());
        if (stderr) {
          debugLog('[Debug] Claude CLI stderr:', stderr.trim());
        }

        // Process the output
        let processedOutput = stdout;
        
        // For tasks with a parent, add a boomerang marker to help identify responses
        if (parentTaskId) {
          // Add a boomerang marker with task info
          const boomerangInfo = {
            parentTaskId,
            returnMode,
            taskDescription: taskDescription || 'Unknown task',
            completed: new Date().toISOString()
          };
          
          // Add a hidden JSON marker that can be detected by the parent task
          // Format is a special comment that won't interfere with normal content
          const boomerangMarker = `\n\n<!-- BOOMERANG_RESULT ${JSON.stringify(boomerangInfo)} -->`;
          processedOutput += boomerangMarker;
          
          debugLog(`[Debug] Added boomerang marker to output for parent task: ${parentTaskId}`);
          
          // Process the result back to the parent
          // Import only if needed to avoid circular dependencies
          const { processChildTaskResult } = await import('./boomerang_handler.js');
          try {
            // Generate a unique child task ID if not already set
            const childTaskId = `child_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            processChildTaskResult(childTaskId, processedOutput)
              .then(processed => {
                debugLog(`[Debug] Boomerang result processing ${processed ? 'succeeded' : 'failed'} for task ${childTaskId} and parent ${parentTaskId}`);
              })
              .catch(error => {
                debugLog(`[Error] Failed to process boomerang result: ${error}`);
              });
          } catch (error) {
            debugLog(`[Error] Error during boomerang result processing: ${error}`);
          }
        }

        // Request completed successfully, remove from tracking
        this.activeRequests.delete(requestId);
        debugLog(`[Debug] Request ${requestId} completed successfully`);
        
        // Return processed output
        return { content: [{ type: 'text', text: processedOutput }] };

      } catch (error: any) {
        debugLog('[Error] Error executing Claude CLI:', error);
        let errorMessage = error.message || 'Unknown error';
        // Attempt to include stderr and stdout from the error object if spawnAsync attached them
        if (error.stderr) {
          errorMessage += `\nStderr: ${error.stderr}`;
        }
        if (error.stdout) {
          errorMessage += `\nStdout: ${error.stdout}`;
        }

        // Request failed, remove from tracking
        this.activeRequests.delete(requestId);
        debugLog(`[Debug] Request ${requestId} failed: ${errorMessage}`);
        
        if (error.signal === 'SIGTERM' || (error.message && error.message.includes('ETIMEDOUT')) || (error.code === 'ETIMEDOUT')) {
          // Reverting to InternalError due to lint issues, but with a specific timeout message.
          throw new McpError(ErrorCode.InternalError, `Claude CLI command timed out after ${executionTimeoutMs / 1000}s. Details: ${errorMessage}`);
        }
        // ErrorCode.ToolCallFailed should be ErrorCode.InternalError or a more specific execution error if available
        throw new McpError(ErrorCode.InternalError, `Claude CLI execution failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    // Revert to original server start logic if listen caused errors
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Claude Code MCP server running on stdio');
  }
}

// Create and run the server
const server = new ClaudeCodeServer();
server.run().catch(console.error);