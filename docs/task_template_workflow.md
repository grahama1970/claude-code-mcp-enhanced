# Task Template Workflow Guide

This guide explains how to use the task amender and converter tools to ensure task markdown files conform to the template guide and can be successfully converted to JSON for execution by the MCP.

## Overview

The Claude Code MCP system requires task descriptions to follow a specific format to be properly converted to JSON and executed. The task amender tool automatically checks and updates task markdown files to conform to the template guide, ensuring they have all required sections and proper formatting.

## Workflow

1. **Create a task markdown file** - Create a markdown file describing your task
2. **Amend the task** - Use the task amender to ensure it conforms to the template
3. **Convert to JSON** - Convert the amended task to JSON format
4. **Execute with MCP** - Execute the task with the MCP server

## Tools

### Task Amender

The task amender checks a markdown file against the template guide requirements and adds missing sections. It also detects execution modes and manages dependencies between tasks.

```bash
# Using the CLI script (uses typer)
python scripts/amend_task.py input.md -o amended_task.md
# or
python scripts/amend_task.py input.md --output amended_task.md

# Using the Python module
python -m claude_code_mcp.cli amend-task input.md --output-path amended_task.md

# Check only (no modification)
python scripts/amend_task.py input.md --check
```

### Task to JSON Converter

The task to JSON converter converts a markdown task file to JSON format for execution by the MCP. It can automatically amend the task if needed.

```bash
# Using the CLI script (with automatic amendment, uses typer)
python scripts/task_to_json.py input.md -o output.json
# or
python scripts/task_to_json.py input.md --output output.json

# Using the Python module (with automatic amendment)
python -m claude_code_mcp.cli convert-task-markdown input.md --output-path output.json

# Without automatic amendment
python scripts/task_to_json.py input.md -o output.json --no-amend
# or
python scripts/task_to_json.py input.md --output output.json --no-amend
```

### MCP Task Execution

Once the task is converted to JSON, you can execute it with the MCP server.

```bash
# Execute task with sequential mode
python -m claude_code_mcp.cli execute-task task-id --task-path task.json --execution-mode sequential

# Execute task with parallel mode
python -m claude_code_mcp.cli execute-task task-id --task-path task.json --execution-mode parallel

# Check task status
python -m claude_code_mcp.cli task-status task-id
```

## Task Format Requirements

The task amender ensures that all task markdown files include the following sections:

1. **Title** - `# Task XXX: Task Name ⏳ Not Started`
2. **Objective** - `**Objective**: Description of task purpose`
3. **Requirements** - `**Requirements**: list of requirements`
4. **Overview** - `## Overview` section with task overview
5. **Implementation Tasks** - `## Implementation Tasks` section with subtasks
6. **Usage Table** - `## Usage Table` with commands and examples
7. **Version Control Plan** - `## Version Control Plan` section
8. **Resources** - `## Resources` section with packages and documentation
9. **Progress Tracking** - `## Progress Tracking` section
10. **Report Documentation Requirements** - `## Report Documentation Requirements` section

For subtasks, the amender detects and standardizes:

1. **Execution Mode** - Whether the task should run sequentially or in parallel
2. **Dependencies** - Which tasks this task depends on
3. **Status Markers** - Adding `⏳ Not Started` to tasks
4. **Checkboxes** - Adding `[ ]` to task steps

## Integration with Claude

For optimal workflow with Claude:

1. Have Claude create a task markdown file
2. Before converting/executing, have Claude amend the task
   ```
   Please amend this task according to the template guide in docs/memory_bank/guides/TASK_LIST_TEMPLATE_GUIDE.md
   ```
3. Claude will use the task amender to update the file
4. Then convert and execute the amended task

## Example: Full Workflow

1. Create a simple task file:

```markdown
# Task 007: Example Task

This is a simple task with missing sections.

## Implementation Tasks

### Task 1: Do Something

- Step 1: Do this
- Step 2: Do that

### Task 2: Do Something Else

- Step 1: Do another thing
```

2. Amend the task file:

```bash
python scripts/amend_task.py task_007.md -o amended_task_007.md
```

3. Convert to JSON:

```bash
python scripts/task_to_json.py amended_task_007.md -o task_007.json
```

4. Execute the task:

```bash
python -m claude_code_mcp.cli execute-task task-007 --task-path task_007.json
```

5. Check task status:

```bash
python -m claude_code_mcp.cli task-status task-007
```

## Best Practices

1. **Always check for template conformance** before converting to JSON
2. **Use the task amender** to ensure all required sections are present
3. **Explicitly specify execution modes** for tasks that should run in parallel
4. **Define dependencies** clearly for complex task workflows
5. **Include detailed verification steps** for each task
6. **Follow the naming convention** for task files and IDs

By following this workflow, you can ensure that task files are properly formatted and can be successfully executed by the MCP system.