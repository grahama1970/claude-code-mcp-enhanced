# Task Amender Guide

This guide provides detailed information about the Task Amender tool for the Claude Code MCP project. The Task Amender ensures markdown task files conform to the required template structure before being converted to JSON for execution.

## Purpose

The Task Amender serves as a preprocessing tool that validates and amends markdown task files to ensure they include all required sections, proper formatting, and structural elements as defined in the `TASK_LIST_TEMPLATE_GUIDE.md`.

Key benefits:
- Ensures consistent task structure across all task definitions
- Automatically adds missing sections based on the template guide
- Detects and standardizes execution modes and dependencies
- Adds status markers and checkboxes to improve tracking
- Simplifies the creation of complex task descriptions

## How Task Amender Works

The Task Amender analyzes a markdown task file and:

1. **Checks for Required Sections**: Verifies the presence of all mandatory sections
2. **Adds Missing Sections**: Adds template-based content for any missing sections
3. **Ensures Status Markers**: Adds `⏳ Not Started` status to tasks without status
4. **Ensures Checkboxes**: Adds `[ ]` checkboxes to task steps
5. **Adds Execution Information**: Detects and standardizes execution modes and dependencies

## Using the Task Amender

### Command Line Interface

The Task Amender can be used through the `amend_task.py` script, which implements a typer-based CLI:

```bash
# Basic usage (overwrites the input file)
python scripts/amend_task.py input.md

# Save amended file to a different location
python scripts/amend_task.py input.md -o output.md
# or
python scripts/amend_task.py input.md --output output.md

# Check for conformance without modifying
python scripts/amend_task.py input.md --check

# Enable verbose output
python scripts/amend_task.py input.md -v
# or
python scripts/amend_task.py input.md --verbose
```

### Python Module

You can also use the Task Amender directly from the Python module:

```python
from claude_code_mcp.task_amender import amend_task_list, check_required_sections

# Check if a file conforms to the template
with open('task.md', 'r', encoding='utf-8') as f:
    content = f.read()
    
missing_sections = check_required_sections(content)
if missing_sections:
    print(f"Task file is missing these sections: {', '.join(missing_sections)}")
else:
    print("Task file conforms to the template.")

# Amend a task file
amended_content = amend_task_list('task.md', 'amended_task.md')
```

### CLI Commands

The Task Amender is also integrated into the Claude Code MCP CLI:

```bash
# Amend a task
python -m claude_code_mcp.cli amend-task input.md -o output.md

# Amend and convert in one step
python -m claude_code_mcp.cli convert-task-markdown input.md -o output.json --auto-amend
```

## Examples

### Example 1: Basic Task with Missing Sections

**Input (`basic_task.md`):**
```markdown
# Task 123: Example Task

This is a basic task description without proper sections.

## Implementation Tasks

### Task 1: First Subtask

- Step 1: Implement feature X
- Step 2: Test feature X
```

**Amendment Command:**
```bash
python scripts/amend_task.py basic_task.md -o amended_task.md
```

**Output (`amended_task.md`):**
```markdown
# Task 123: Example Task ⏳ Not Started

**Objective**: [REPLACE WITH SPECIFIC OBJECTIVE]

**Requirements**:
1. [REPLACE WITH SPECIFIC REQUIREMENT]
2. [REPLACE WITH SPECIFIC REQUIREMENT]
3. [ADD MORE REQUIREMENTS AS NEEDED]

## Overview

[REPLACE WITH OVERVIEW OF THE TASK]

**IMPORTANT**: 
1. Each sub-task MUST include creation of a verification report in `/docs/reports/` with actual command outputs and performance results.
2. Task 4 (Final Verification) enforces MANDATORY iteration on ALL incomplete tasks. The agent MUST continue working until 100% completion is achieved - no partial completion is acceptable.

## Implementation Tasks (Ordered by Priority/Complexity)

### Task 1: First Subtask ⏳ Not Started

**Priority**: [HIGH/MEDIUM/LOW] | **Complexity**: [HIGH/MEDIUM/LOW] | **Impact**: [HIGH/MEDIUM/LOW]

**Execution Mode**: SEQUENTIAL

**Implementation Steps**:
- [ ] Step 1: Implement feature X
- [ ] Step 2: Test feature X

### Task 2: Completion Verification and Iteration ⏳ Not Started

**Priority**: CRITICAL | **Complexity**: LOW | **Impact**: CRITICAL

**Execution Mode**: SEQUENTIAL

**Implementation Steps**:
- [ ] 2.1 Review all task reports
  - Read all reports in `/docs/reports/123_task_*`
  - Create checklist of incomplete features
  - Identify failed tests or missing functionality
  - Document specific issues preventing completion
  - Prioritize fixes by impact

[... remaining verification task details ...]

## Usage Table

| Command / Function | Description | Example Usage | Expected Output |
|-------------------|-------------|---------------|-----------------|
| `[COMMAND]` | [DESCRIPTION] | `[EXAMPLE COMMAND]` | [EXPECTED OUTPUT] |
| `[COMMAND]` | [DESCRIPTION] | `[EXAMPLE COMMAND]` | [EXPECTED OUTPUT] |

## Version Control Plan

- **Initial Commit**: Create task-123-start tag before implementation
- **Feature Commits**: After each major feature
- **Integration Commits**: After component integration  
- **Test Commits**: After test suite completion
- **Final Tag**: Create task-123-complete after all tests pass

## Resources

**Python Packages**:
- [PACKAGE 1]: [PURPOSE]
- [PACKAGE 2]: [PURPOSE]
- [PACKAGE 3]: [PURPOSE]
- [PACKAGE 4]: [PURPOSE]

**Documentation**:
- [DOCUMENTATION 1](LINK)
- [DOCUMENTATION 2](LINK)
- [DOCUMENTATION 3](LINK)
- [DOCUMENTATION 4](LINK)

**Example Implementations**:
- [EXAMPLE 1](LINK)
- [EXAMPLE 2](LINK)
- [EXAMPLE 3](LINK)

## Progress Tracking

- Start date: TBD
- Current phase: Planning
- Expected completion: TBD
- Completion criteria: All features working, tests passing, documented

## Report Documentation Requirements

Each sub-task MUST have a corresponding verification report in `/docs/reports/` following these requirements:

### Report Structure:
Each report must include:
1. **Task Summary**: Brief description of what was implemented
2. **Research Findings**: Links to repos, code examples found, best practices discovered
3. **Non-Mocked Results**: Real command outputs and performance metrics
4. **Performance Metrics**: Actual benchmarks with real data
5. **Code Examples**: Working code with verified output
6. **Verification Evidence**: Logs or metrics proving functionality
7. **Limitations Found**: Any discovered issues or constraints
8. **External Resources Used**: All GitHub repos, articles, and examples referenced

### Report Naming Convention:
`/docs/reports/123_task_[SUBTASK]_[feature_name].md`
```

### Example 2: Task with Multiple Subtasks and Dependencies

To amend a task with multiple subtasks and dependencies, create a file with explicit execution modes and dependencies:

**Input (`complex_task.md`):**
```markdown
# Task 456: Complex Task with Dependencies

## Implementation Tasks

### Task 1: Setup Environment

- Step 1: Install dependencies
- Step 2: Configure environment

### Task 2: Build API Endpoints (depends on Task 1)

- Step 1: Design endpoint structure
- Step 2: Implement endpoints

### Task 3: Create Frontend (runs in parallel with Task 2)

- Step 1: Create UI components
- Step 2: Connect to API endpoints
```

After running `python scripts/amend_task.py complex_task.md`, the output will include proper execution modes and dependencies.

## Integration with Task to JSON Workflow

The Task Amender is designed to integrate seamlessly with the Task to JSON conversion workflow:

1. Create or receive a markdown task file
2. Run the Task Amender to ensure it conforms to the template
3. Convert the amended task to JSON
4. Execute the JSON task with the MCP server

Use the `task_to_json.py` script to combine the amendment and conversion steps:

```bash
python scripts/task_to_json.py input.md -o output.json
```

This script automatically:
1. Checks if the input file conforms to the template
2. Amends the file if needed
3. Converts the amended file to JSON
4. Outputs the JSON to the specified path

## Common Issues and Solutions

### Missing Sections Not Added

If the Task Amender doesn't add missing sections, check that:
- The file is using UTF-8 encoding
- The file has a proper Task title header (`# Task XXX: ...`)
- You have write permissions to the output location

### Incorrect Execution Mode Detection

The Task Amender detects execution modes based on keywords in the task description:
- "parallel" for parallel execution
- "depends on" for dependencies

To ensure correct detection, explicitly mention these keywords in your task descriptions.

### Incorrect Path Resolution for Template Guide

The Task Amender looks for the Template Guide in several locations:
- Relative to the script file
- In the current working directory
- In the home workspace

If it cannot find the guide, it will use default templates. Ensure the guide is in one of these locations.

## Extending the Task Amender

The Task Amender can be extended by:

1. Adding new template sections in the `TEMPLATE_SECTIONS` dictionary
2. Adding new validation checks in the `check_required_sections` function
3. Implementing additional formatting functions for specialized section types

See the `task_amender.py` module for implementation details.

## Conclusion

The Task Amender is a powerful tool for ensuring task files conform to the standardized template guide. By using it as part of your workflow, you can ensure consistent task structure, proper formatting, and successful execution by the MCP system.