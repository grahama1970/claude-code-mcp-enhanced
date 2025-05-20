# Claude Code MCP Task Orchestration Demo

This demo shows how to use the Claude Code MCP server for task orchestration, implementing both sequential and parallel execution modes, and using the "boomerang pattern" where child tasks report results back to parent tasks.

## Setup

Make sure the Claude Code MCP server is running. This demo assumes the server is listening on `localhost:3000`. If your server is running on a different host or port, update the configuration in the script files.

## Files in this Demo

- `simple_task_converter.js`: Generates a simple task definition for testing
- `run_parent_task.js`: Creates a parent task and child tasks from a task definition
- `create_geography_task.js`: Creates a simple geography question task
- `monitor_tasks.js`: Monitors task execution by polling for updates
- `display_results.js`: Displays task results in a formatted way
- `generated_task.json`: A generated task definition (created by running `simple_task_converter.js`)

## Demo Workflow

1. **Convert task markdown to JSON**

   ```bash
   node simple_task_converter.js > generated_task.json
   ```

2. **Create parent task and child tasks**

   ```bash
   node run_parent_task.js
   ```

   Or, for a simpler test:

   ```bash
   node create_geography_task.js
   ```

3. **Monitor task execution**

   ```bash
   # For parent task
   node monitor_tasks.js <parent_task_id> --parent
   
   # For child task
   node monitor_tasks.js <child_task_id>
   ```

4. **Display task results**

   ```bash
   # List available result files
   node display_results.js
   
   # Display parent task results
   node display_results.js <parent_task_id> --parent
   
   # Display child task results
   node display_results.js <child_task_id>
   ```

## Task Orchestration Features

This demo implements the following task orchestration features:

- **Task Definition**: Define tasks with subtasks that can be executed in sequential or parallel mode
- **Parent-Child Relationships**: Create parent tasks that orchestrate the execution of child tasks
- **Boomerang Pattern**: Child tasks report results back to parent tasks
- **Execution Modes**: Support for both sequential and parallel execution
- **Progress Monitoring**: Poll for task status updates
- **Result Processing**: Process and display task results in a formatted way

## Example: Geography Question Task

The demo includes a simple geography question task that asks "What is the capital of France?" and expects the answer "Paris".

To run this example:

```bash
# Create the task
node create_geography_task.js

# Monitor task execution (replace <parent_task_id> with the actual ID)
node monitor_tasks.js <parent_task_id> --parent

# Display results when complete
node display_results.js <parent_task_id> --parent
```

## Architecture

The Claude Code MCP server implements the following components for task orchestration:

1. **server.ts**: The main MCP server that handles tool requests
2. **pooled_task_command.ts**: Task command functions using an instance pool
3. **instance_pool.ts**: Instance pooling for efficient Claude instance management
4. **boomerang_handler.ts**: Handles the boomerang pattern for task orchestration

The boomerang pattern allows child tasks to report results back to parent tasks, enabling complex task orchestration flows.