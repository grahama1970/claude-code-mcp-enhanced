# Claude Code MCP Integration Guide

This guide explains how to configure and use the Claude Code MCP server in other projects.

## Overview

The Claude Code MCP server provides:
1. Access to Claude CLI via MCP
2. Task conversion functionality for Markdown task files
3. Health status information

## Environment Variables

The server supports the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| MCP_CLAUDE_DEBUG | Enable debug logging | false |
| MCP_HEARTBEAT_INTERVAL_MS | Heartbeat interval for long-running processes | 15000 (15s) |
| MCP_EXECUTION_TIMEOUT_MS | Maximum execution time | 1800000 (30m) |
| MCP_USE_ROOMODES | Enable .roomodes integration | false |
| MCP_WATCH_ROOMODES | Auto-reload .roomodes on changes | false |
| MCP_MAX_RETRIES | Maximum retry attempts | 3 |
| MCP_RETRY_DELAY_MS | Delay between retries | 1000 (1s) |

## MCP Configuration

To use this MCP server in your projects, create a `.mcp.json` file with the following configuration:

```json
{
  "mcpServers": {
    "Local MCP Server": {
      "type": "stdio",
      "command": "node",
      "args": [
        "path/to/dist/server.js"
      ],
      "env": {
        "MCP_CLAUDE_DEBUG": "${MCP_CLAUDE_DEBUG:-false}",
        "MCP_HEARTBEAT_INTERVAL_MS": "${MCP_HEARTBEAT_INTERVAL_MS:-15000}",
        "MCP_EXECUTION_TIMEOUT_MS": "${MCP_EXECUTION_TIMEOUT_MS:-1800000}",
        "MCP_USE_ROOMODES": "${MCP_USE_ROOMODES:-false}",
        "MCP_WATCH_ROOMODES": "${MCP_WATCH_ROOMODES:-false}",
        "MCP_MAX_RETRIES": "${MCP_MAX_RETRIES:-3}",
        "MCP_RETRY_DELAY_MS": "${MCP_RETRY_DELAY_MS:-1000}"
      }
    }
  }
}
```

## Available Tools

The MCP server provides the following tools:

### 1. `health`

Returns the health status and configuration of the server.

**Example call:**
```json
{
  "name": "health",
  "arguments": {}
}
```

### 2. `convert_task_markdown`

Converts Markdown task files into Claude Code MCP-compatible JSON format.

**Example call:**
```json
{
  "name": "convert_task_markdown",
  "arguments": {
    "markdownPath": "/path/to/task.md",
    "outputPath": "/path/to/output.json"
  }
}
```

### 3. `claude_code`

Runs the Claude CLI with the specified prompt and working directory.

**Example call:**
```json
{
  "name": "claude_code",
  "arguments": {
    "prompt": "List files in the current directory",
    "workFolder": "/path/to/workfolder"
  }
}
```

**Extended parameters for task orchestration:**
```json
{
  "name": "claude_code",
  "arguments": {
    "prompt": "Your detailed prompt here",
    "workFolder": "/path/to/workfolder",
    "parentTaskId": "task_123",
    "returnMode": "summary", 
    "taskDescription": "Short task description",
    "mode": "boomerang-mode"
  }
}
```

## Task Conversion

The task conversion functionality converts Markdown task files to JSON format for use with Claude Code. The input format must follow specific conventions:

1. Must have a title with task number: `# Task NNN: Title`
2. Must have an Objective section: `## Objective`
3. Must have a Requirements section: `## Requirements`
4. Must have validation tasks with indented steps: `- [ ] Validate \`module_name\``

Example:
```markdown
# Task 001: Test Task

## Objective
Test the functionality of a module.

## Requirements
1. [ ] Test all functions
2. [ ] Verify outputs

## Validation Tasks
- [ ] Validate `module_name`
   - [ ] Test function A
   - [ ] Test function B
```

## Integration Notes

- The server uses `stdio` communication, which requires the parent process to manage stdin/stdout
- Error handling should include timeout detection
- The claude_code tool requests should include a workFolder when referencing files

For more details, see the [Claude Code MCP Repository](https://github.com/grahama1970/claude-code-mcp).