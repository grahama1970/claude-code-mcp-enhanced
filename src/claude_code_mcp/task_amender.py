#!/usr/bin/env python3
"""
Task Amender for Claude Code MCP

This script preprocesses task markdown files to ensure they conform to the standard
template required for successful conversion to JSON and execution by the MCP.

It validates and amends task structure based on the TASK_LIST_TEMPLATE_GUIDE.md,
ensuring all required sections are present and properly formatted.

Documentation:
- Markdown: https://www.markdownguide.org/
- Task Format: See docs/memory_bank/guides/TASK_LIST_TEMPLATE_GUIDE.md

Sample Input:
  Basic task description with missing sections

Expected Output:
  Complete task description conforming to the template guide
"""

import re
import sys
import os
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
from loguru import logger


# Required sections according to the template guide
REQUIRED_SECTIONS = [
    "# Task",                    # Title
    "**Objective**",             # Objective
    "**Requirements**",          # Requirements
    "## Overview",               # Overview
    "## Implementation Tasks",   # Implementation Tasks
    "## Usage Table",            # Usage Table
    "## Version Control Plan",   # Version Control Plan
    "## Resources",              # Resources
    "## Progress Tracking",      # Progress Tracking
    "## Report Documentation Requirements"  # Report Documentation
]

# Template sections to add if missing
TEMPLATE_SECTIONS = {
    "**Objective**": "**Objective**: [REPLACE WITH SPECIFIC OBJECTIVE]\n\n",
    
    "**Requirements**": """**Requirements**:
1. [REPLACE WITH SPECIFIC REQUIREMENT]
2. [REPLACE WITH SPECIFIC REQUIREMENT]
3. [ADD MORE REQUIREMENTS AS NEEDED]

""",
    
    "## Overview": """## Overview

[REPLACE WITH OVERVIEW OF THE TASK]

**IMPORTANT**: 
1. Each sub-task MUST include creation of a verification report in `/docs/reports/` with actual command outputs and performance results.
2. Task 4 (Final Verification) enforces MANDATORY iteration on ALL incomplete tasks. The agent MUST continue working until 100% completion is achieved - no partial completion is acceptable.

""",
    
    "## Research Summary": """## Research Summary

[REPLACE WITH BRIEF RESEARCH SUMMARY]

""",
    
    "## MANDATORY Research Process": """## MANDATORY Research Process

**CRITICAL REQUIREMENT**: For EACH task, the agent MUST:

1. **Use `perplexity_ask`** to research:
   - Current best practices (2024-2025)
   - Production implementation patterns  
   - Common pitfalls and solutions
   - Performance optimization techniques

2. **Use `WebSearch`** to find:
   - GitHub repositories with working code
   - Real production examples
   - Popular library implementations
   - Benchmark comparisons

3. **Document all findings** in task reports:
   - Links to source repositories
   - Code snippets that work
   - Performance characteristics
   - Integration patterns

4. **DO NOT proceed without research**:
   - No theoretical implementations
   - No guessing at patterns
   - Must have real code examples
   - Must verify current best practices

Example Research Queries:
```
perplexity_ask: "[REPLACE WITH SPECIFIC QUERY]"
WebSearch: "site:github.com [REPLACE WITH SPECIFIC QUERY]"
```

""",
    
    "## Implementation Tasks": """## Implementation Tasks (Ordered by Priority/Complexity)

""",
    
    "### Task": """### Task [NUMBER]: [FEATURE NAME] ⏳ Not Started

**Priority**: [HIGH/MEDIUM/LOW] | **Complexity**: [HIGH/MEDIUM/LOW] | **Impact**: [HIGH/MEDIUM/LOW]

**Research Requirements**:
- [ ] Use `perplexity_ask` to find [SPECIFIC PATTERN]
- [ ] Use `WebSearch` to find [SPECIFIC EXAMPLES]
- [ ] Search GitHub for [SPECIFIC PATTERN]
- [ ] Find real-world [SPECIFIC IMPLEMENTATIONS]
- [ ] Research [SPECIFIC ASPECT]

**Implementation Steps**:
- [ ] [NUMBER].[NUMBER] [STEP DESCRIPTION]
  - [SUB-STEP]
  - [SUB-STEP]
  - [SUB-STEP]
  - [SUB-STEP]
  - [SUB-STEP]

**Technical Specifications**:
- [SPECIFICATION 1]
- [SPECIFICATION 2]
- [SPECIFICATION 3]
- [SPECIFICATION 4]
- [SPECIFICATION 5]

**Verification Method**:
- [VERIFICATION 1]
- [VERIFICATION 2]
- [VERIFICATION 3]
- [VERIFICATION 4]

""",
    
    "### Task Verification": """### Task [NUMBER]: Completion Verification and Iteration ⏳ Not Started

**Priority**: CRITICAL | **Complexity**: LOW | **Impact**: CRITICAL

**Implementation Steps**:
- [ ] [NUMBER].1 Review all task reports
  - Read all reports in `/docs/reports/[TASK]_task_*`
  - Create checklist of incomplete features
  - Identify failed tests or missing functionality
  - Document specific issues preventing completion
  - Prioritize fixes by impact

- [ ] [NUMBER].2 Create task completion matrix
  - Build comprehensive status table
  - Mark each sub-task as COMPLETE/INCOMPLETE
  - List specific failures for incomplete tasks
  - Identify blocking dependencies
  - Calculate overall completion percentage

- [ ] [NUMBER].3 Iterate on incomplete tasks
  - Return to first incomplete task
  - Fix identified issues
  - Re-run validation tests
  - Update verification report
  - Continue until task passes

- [ ] [NUMBER].4 Re-validate completed tasks
  - Ensure no regressions from fixes
  - Run integration tests
  - Verify cross-task compatibility
  - Update affected reports
  - Document any new limitations

- [ ] [NUMBER].5 Final comprehensive validation
  - [SPECIFIC VALIDATION STEP]
  - [SPECIFIC VALIDATION STEP]
  - [SPECIFIC VALIDATION STEP]
  - [SPECIFIC VALIDATION STEP]
  - [SPECIFIC VALIDATION STEP]

- [ ] [NUMBER].6 Create final summary report
  - Create `/docs/reports/[TASK]_final_summary.md`
  - Include completion matrix
  - Document all working features
  - List any remaining limitations
  - Provide usage recommendations

- [ ] [NUMBER].7 Mark task complete only if ALL sub-tasks pass
  - Verify 100% task completion
  - Confirm all reports show success
  - Ensure no critical issues remain
  - Get final approval
  - Update task status to ✅ Complete

**Technical Specifications**:
- Zero tolerance for incomplete features
- Mandatory iteration until completion
- All tests must pass
- All reports must verify success
- No theoretical completions allowed

**Verification Method**:
- Task completion matrix showing 100%
- All reports confirming success
- Rich table with final status

**Acceptance Criteria**:
- ALL tasks marked COMPLETE
- ALL verification reports show success
- ALL tests pass without issues
- ALL features work in production
- NO incomplete functionality

**CRITICAL ITERATION REQUIREMENT**:
This task CANNOT be marked complete until ALL previous tasks are verified as COMPLETE with passing tests and working functionality. The agent MUST continue iterating on incomplete tasks until 100% completion is achieved.

""",
    
    "## Usage Table": """## Usage Table

| Command / Function | Description | Example Usage | Expected Output |
|-------------------|-------------|---------------|-----------------| 
| `[COMMAND]` | [DESCRIPTION] | `[EXAMPLE COMMAND]` | [EXPECTED OUTPUT] |
| `[COMMAND]` | [DESCRIPTION] | `[EXAMPLE COMMAND]` | [EXPECTED OUTPUT] |

""",
    
    "## Version Control Plan": """## Version Control Plan

- **Initial Commit**: Create task-[NUMBER]-start tag before implementation
- **Feature Commits**: After each major feature
- **Integration Commits**: After component integration  
- **Test Commits**: After test suite completion
- **Final Tag**: Create task-[NUMBER]-complete after all tests pass

""",
    
    "## Resources": """## Resources

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

""",
    
    "## Progress Tracking": """## Progress Tracking

- Start date: TBD
- Current phase: Planning
- Expected completion: TBD
- Completion criteria: All features working, tests passing, documented

""",
    
    "## Report Documentation Requirements": """## Report Documentation Requirements

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
`/docs/reports/[TASK_NUMBER]_task_[SUBTASK]_[feature_name].md`
"""
}


def load_task_template_guide() -> str:
    """
    Load the Task Template Guide from the expected location.
    
    Returns:
        The content of the Task Template Guide markdown file.
    """
    try:
        # Try to find the template guide relative to the current file
        script_dir = Path(__file__).parent.parent.parent
        template_path = script_dir / "docs" / "memory_bank" / "guides" / "TASK_LIST_TEMPLATE_GUIDE.md"
        
        if not template_path.exists():
            # Try alternative locations if not found
            alt_paths = [
                Path.cwd() / "docs" / "memory_bank" / "guides" / "TASK_LIST_TEMPLATE_GUIDE.md",
                Path.home() / "workspace" / "experiments" / "claude-code-mcp" / "docs" / "memory_bank" / "guides" / "TASK_LIST_TEMPLATE_GUIDE.md"
            ]
            
            for path in alt_paths:
                if path.exists():
                    template_path = path
                    break
            else:
                logger.warning("Could not find TASK_LIST_TEMPLATE_GUIDE.md, using default templates")
                return ""
        
        with open(template_path, 'r', encoding='utf-8') as file:
            return file.read()
    except Exception as e:
        logger.error(f"Error loading template guide: {e}")
        return ""


def check_required_sections(content: str) -> List[str]:
    """
    Check if all required sections are present in the markdown content.
    
    Args:
        content: The markdown content to check.
        
    Returns:
        A list of missing section names.
    """
    missing_sections = []
    
    for section in REQUIRED_SECTIONS:
        # Use fuzzy matching for section headers
        if section.startswith("#"):
            # For headers, check if a similar header exists
            pattern = r"^" + re.escape(section.split(":")[0]).replace("\\#", "#\\s*") + r"[:\s]"
            if not re.search(pattern, content, re.MULTILINE):
                missing_sections.append(section)
        else:
            # For non-headers like **Objective**, check more directly
            if section not in content:
                missing_sections.append(section)
    
    return missing_sections


def extract_task_sections(content: str) -> Dict[str, List[str]]:
    """
    Extract task sections from the markdown content.
    
    Args:
        content: The markdown content to parse.
        
    Returns:
        A dictionary of section names to section content.
    """
    sections = {}
    
    # Extract main sections using regex
    main_section_pattern = r"^(#+\s+[\w\s-]+)$|^(\*\*[\w\s-]+\*\*):"
    matches = re.finditer(main_section_pattern, content, re.MULTILINE)
    
    # Get the positions of all section headers
    positions = [(m.start(), m.group(0)) for m in matches]
    positions.append((len(content), "EOF"))
    
    # Extract content between positions
    for i in range(len(positions) - 1):
        start_pos, header = positions[i]
        end_pos = positions[i + 1][0]
        
        section_content = content[start_pos:end_pos].strip()
        sections[header] = section_content
    
    # Extract task subsections
    task_pattern = r"^(###\s+Task\s+\d+:.+?)(?=###\s+Task|$)"
    task_matches = re.finditer(task_pattern, content, re.MULTILINE | re.DOTALL)
    
    tasks = {}
    for m in task_matches:
        task_content = m.group(1).strip()
        task_name = re.match(r"^###\s+(Task\s+\d+:.+?)$", task_content.split("\n")[0], re.MULTILINE)
        if task_name:
            tasks[task_name.group(1)] = task_content
    
    # Add tasks to the sections
    sections["tasks"] = tasks
    
    return sections


def detect_execution_modes(task_content: str) -> Tuple[str, List[str]]:
    """
    Detect execution mode and dependencies from task content.
    
    Args:
        task_content: The content of a task section.
        
    Returns:
        A tuple of (execution_mode, dependencies).
    """
    execution_mode = "sequential"  # Default mode
    dependencies = []
    
    # Check for execution mode
    if "parallel" in task_content.lower():
        execution_mode = "parallel"
    
    # Check for dependencies
    dependency_pattern = r"depends\s+on:?\s+([^.\n]+)"
    dependency_match = re.search(dependency_pattern, task_content, re.IGNORECASE)
    if dependency_match:
        deps_text = dependency_match.group(1).strip()
        # Split by commas, 'and', or just spaces
        deps = re.split(r',|\sand\s|\s+', deps_text)
        dependencies = [d.strip() for d in deps if d.strip()]
    
    return execution_mode, dependencies


def add_execution_modes(task_sections: Dict[str, str]) -> Dict[str, str]:
    """
    Add execution modes to task sections if not present.
    
    Args:
        task_sections: Dictionary of task name to task content.
        
    Returns:
        Updated dictionary with execution modes added.
    """
    updated_tasks = {}
    
    for task_name, task_content in task_sections.items():
        # Skip if already has execution mode
        if "executionMode" in task_content or "execution mode" in task_content.lower():
            updated_tasks[task_name] = task_content
            continue
        
        # Detect mode
        execution_mode, _ = detect_execution_modes(task_content)
        
        # Split the task header from the content
        lines = task_content.split("\n")
        header = lines[0]
        rest = "\n".join(lines[1:])
        
        # Add execution mode after priority/impact section if it exists
        priority_match = re.search(r"\*\*Priority\*\*:.+?\*\*Impact\*\*:.+?$", rest, re.MULTILINE)
        if priority_match:
            insert_pos = priority_match.end()
            updated_content = (
                rest[:insert_pos] + 
                f"\n\n**Execution Mode**: {execution_mode.upper()}" + 
                rest[insert_pos:]
            )
        else:
            # Add after header
            updated_content = f"**Execution Mode**: {execution_mode.upper()}\n\n{rest}"
        
        updated_tasks[task_name] = f"{header}\n{updated_content}"
    
    return updated_tasks


def build_dependency_graph(task_sections: Dict[str, str]) -> Dict[str, List[str]]:
    """
    Build a dependency graph from task descriptions.
    
    Args:
        task_sections: Dictionary of task name to task content.
        
    Returns:
        Dictionary mapping task names to lists of dependent task names.
    """
    dependencies = {}
    
    # First pass: extract task IDs and information
    task_ids = {}
    for task_name in task_sections:
        match = re.search(r"Task\s+(\d+)", task_name)
        if match:
            task_num = match.group(1)
            task_ids[task_name] = f"task-{task_num}"
            dependencies[f"task-{task_num}"] = []
    
    # Second pass: detect dependencies
    for task_name, task_content in task_sections.items():
        if task_name not in task_ids:
            continue
            
        task_id = task_ids[task_name]
        _, deps = detect_execution_modes(task_content)
        
        # Convert dependency text to task IDs
        for dep in deps:
            # Try to match task number
            match = re.search(r"Task\s+(\d+)", dep)
            if match:
                dep_num = match.group(1)
                dependencies[task_id].append(f"task-{dep_num}")
    
    return dependencies


def add_missing_sections(content: str, missing_sections: List[str]) -> str:
    """
    Add missing sections to the markdown content.
    
    Args:
        content: The original markdown content.
        missing_sections: List of section names to add.
        
    Returns:
        The updated markdown content.
    """
    updated_content = content
    
    # Determine task number
    task_num_match = re.search(r"#\s*Task\s+(\d+)", updated_content)
    task_num = task_num_match.group(1) if task_num_match else "001"
    
    # Get current task count to determine verification task number
    task_count = len(re.findall(r"###\s+Task\s+\d+:", updated_content))
    verification_task_num = task_count + 1 if task_count > 0 else 4
    
    # Extract sections to determine insertion points
    sections = extract_task_sections(updated_content)
    
    # Process missing sections in a specific order
    ordered_sections = [
        "# Task",
        "**Objective**",
        "**Requirements**",
        "## Overview",
        "## Research Summary",
        "## MANDATORY Research Process",
        "## Implementation Tasks",
        "### Task",
        "### Task Verification",
        "## Usage Table",
        "## Version Control Plan",
        "## Resources",
        "## Progress Tracking",
        "## Report Documentation Requirements"
    ]
    
    # Filter ordered_sections to only include missing sections
    ordered_missing = [s for s in ordered_sections if s in missing_sections]
    
    for section in ordered_missing:
        template = TEMPLATE_SECTIONS.get(section, "")
        
        # Special processing for different section types
        if section == "# Task" and "# Task" not in updated_content:
            # Add title at the beginning
            updated_content = f"# Task {task_num}: [DESCRIPTIVE NAME] ⏳ Not Started\n\n{updated_content}"
        
        elif section == "### Task" and "### Task" not in updated_content:
            # Add task section before or after existing content
            if "## Implementation Tasks" in updated_content:
                # Add after implementation tasks
                parts = updated_content.split("## Implementation Tasks")
                before, after = parts[0], parts[1] if len(parts) > 1 else ""
                template = template.replace("[NUMBER]", "1")
                updated_content = f"{before}## Implementation Tasks\n\n{template}{after}"
            else:
                # Add at the end
                template = template.replace("[NUMBER]", "1")
                updated_content += f"\n\n## Implementation Tasks\n\n{template}"
        
        elif section == "### Task Verification":
            # Add verification task
            if "## Implementation Tasks" in updated_content:
                # Add after the last task
                template = template.replace("[NUMBER]", str(verification_task_num))
                # Find position after the last task
                tasks = re.findall(r"###\s+Task\s+\d+:", updated_content)
                if tasks:
                    last_task = tasks[-1]
                    parts = updated_content.split(last_task)
                    before = parts[0] + last_task
                    after = parts[1] if len(parts) > 1 else ""
                    
                    # Find end of the last task section
                    next_section_match = re.search(r"^##\s+[^#]", after, re.MULTILINE)
                    if next_section_match:
                        next_section_pos = next_section_match.start()
                        updated_content = f"{before}{after[:next_section_pos]}\n\n{template}{after[next_section_pos:]}"
                    else:
                        updated_content = f"{before}{after}\n\n{template}"
                else:
                    # No tasks yet, add after implementation tasks
                    parts = updated_content.split("## Implementation Tasks")
                    before, after = parts[0], parts[1] if len(parts) > 1 else ""
                    updated_content = f"{before}## Implementation Tasks\n\n{template}{after}"
            else:
                # Add at the end
                template = template.replace("[NUMBER]", str(verification_task_num))
                updated_content += f"\n\n{template}"
        
        elif section in TEMPLATE_SECTIONS:
            # Generic section insertion
            if section.startswith("##"):
                # Main section (## heading)
                updated_content += f"\n\n{template}"
            elif section.startswith("**"):
                # Metadata section (**bold**)
                # Insert after title if it exists
                title_match = re.search(r"^#\s+Task.+?$", updated_content, re.MULTILINE)
                if title_match:
                    pos = title_match.end()
                    updated_content = f"{updated_content[:pos]}\n\n{template}{updated_content[pos:]}"
                else:
                    # Insert at the beginning
                    updated_content = f"{template}\n{updated_content}"
    
    # Replace placeholders with task-specific information
    updated_content = updated_content.replace("[TASK_NUMBER]", task_num)
    
    return updated_content


def add_execution_info(content: str) -> str:
    """
    Add execution mode and dependency information to tasks.
    
    Args:
        content: The markdown content to update.
        
    Returns:
        Updated markdown content.
    """
    sections = extract_task_sections(content)
    task_sections = sections.get("tasks", {})
    
    # Add execution modes
    updated_tasks = add_execution_modes(task_sections)
    
    # Build dependency graph
    dependencies = build_dependency_graph(task_sections)
    
    # Update content with execution modes and dependencies
    updated_content = content
    
    for task_name, updated_task in updated_tasks.items():
        # Only replace if we actually made changes
        if updated_task != task_sections.get(task_name, ""):
            # Escape special characters for regex
            safe_task_name = re.escape(task_name)
            safe_original = re.escape(task_sections.get(task_name, ""))
            
            # Replace the task section with the updated version
            pattern = f"(###\\s+{safe_task_name}.*?)(?=###\\s+Task|$)"
            updated_content = re.sub(pattern, updated_task, updated_content, flags=re.DOTALL)
    
    # Add dependencies section to tasks if missing
    for task_name, task_content in task_sections.items():
        match = re.search(r"Task\s+(\d+)", task_name)
        if not match:
            continue
            
        task_num = match.group(1)
        task_id = f"task-{task_num}"
        
        deps = dependencies.get(task_id, [])
        if deps and "depends" not in task_content.lower():
            # Find place to insert dependencies
            new_deps_line = f"\n**Dependencies**: {', '.join(deps)}\n"
            
            # Try to insert after Execution Mode if it exists
            if "**Execution Mode**" in task_content:
                pattern = r"(\*\*Execution Mode\*\*:.+?)(\n\n|\n\*\*)"
                match = re.search(pattern, task_content, re.DOTALL)
                if match:
                    pos = match.end(1)
                    updated_task = task_content[:pos] + new_deps_line + task_content[pos:]
                    
                    # Escape special characters for regex
                    safe_task_name = re.escape(task_name)
                    
                    # Replace the task section with the updated version
                    pattern = f"(###\\s+{safe_task_name}.*?)(?=###\\s+Task|$)"
                    updated_content = re.sub(pattern, updated_task, updated_content, flags=re.DOTALL)
                    
            # Try to insert after Priority/Impact section
            elif "**Priority**" in task_content:
                pattern = r"(\*\*Impact\*\*:.+?)(\n\n|\n\*\*)"
                match = re.search(pattern, task_content, re.DOTALL)
                if match:
                    pos = match.end(1)
                    updated_task = task_content[:pos] + new_deps_line + task_content[pos:]
                    
                    # Escape special characters for regex
                    safe_task_name = re.escape(task_name)
                    
                    # Replace the task section with the updated version
                    pattern = f"(###\\s+{safe_task_name}.*?)(?=###\\s+Task|$)"
                    updated_content = re.sub(pattern, updated_task, updated_content, flags=re.DOTALL)
    
    return updated_content


def ensure_status_markers(content: str) -> str:
    """
    Ensure all tasks have status markers (⏳ Not Started).
    
    Args:
        content: The markdown content to update.
        
    Returns:
        Updated markdown content.
    """
    # Add status marker to main task title if missing
    title_pattern = r"^(#\s+Task\s+\d+:[^#\n]+)$"
    title_match = re.search(title_pattern, content, re.MULTILINE)
    if title_match and "⏳" not in title_match.group(1) and "✅" not in title_match.group(1):
        updated_title = f"{title_match.group(1)} ⏳ Not Started"
        content = content.replace(title_match.group(1), updated_title)
    
    # Add status markers to subtasks if missing
    subtask_pattern = r"^(###\s+Task\s+\d+:[^#\n]+)$"
    
    def replace_subtask_title(match):
        title = match.group(1)
        if "⏳" not in title and "✅" not in title:
            return f"{title} ⏳ Not Started"
        return title
    
    content = re.sub(subtask_pattern, replace_subtask_title, content, flags=re.MULTILINE)
    
    return content


def ensure_checkboxes(content: str) -> str:
    """
    Ensure all task steps have checkboxes.
    
    Args:
        content: The markdown content to update.
        
    Returns:
        Updated markdown content.
    """
    # Find all task step lists without checkboxes
    step_pattern = r"^(\s*-\s+)([^[\]\n]+)$"
    
    def replace_step(match):
        prefix = match.group(1)
        step = match.group(2)
        if not step.strip().startswith("[ ]") and not step.strip().startswith("[x]"):
            return f"{prefix}[ ] {step}"
        return match.group(0)
    
    return re.sub(step_pattern, replace_step, content, flags=re.MULTILINE)


def amend_task_list(markdown_path: str, output_path: Optional[str] = None) -> str:
    """
    Amend a task list to conform to the template guide.
    
    Args:
        markdown_path: Path to the input markdown file.
        output_path: Optional path to save the amended file.
        
    Returns:
        The amended markdown content.
    """
    try:
        # Load task file
        with open(markdown_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Check required sections
        missing_sections = check_required_sections(content)
        
        # First add execution info to existing tasks
        content = add_execution_info(content)
        
        # Then add missing sections
        if missing_sections:
            content = add_missing_sections(content, missing_sections)
        
        # Ensure status markers
        content = ensure_status_markers(content)
        
        # Ensure checkboxes
        content = ensure_checkboxes(content)
        
        # Save amended file if output path provided
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write(content)
            logger.info(f"Amended task list saved to {output_path}")
        
        return content
    
    except Exception as e:
        logger.error(f"Error amending task list: {e}")
        raise


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description='Amend task lists to conform to the template guide.')
    parser.add_argument('input_file', help='Path to the input markdown file')
    parser.add_argument('-o', '--output', help='Path to save the amended file (defaults to overwriting input)')
    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Configure logging
    log_level = "DEBUG" if args.verbose else "INFO"
    logger.remove()
    logger.add(sys.stderr, level=log_level)
    
    # Default output to input if not specified
    output_path = args.output or args.input_file
    
    # Amend task list
    try:
        amended_content = amend_task_list(args.input_file, output_path)
        print(f"Task list amended successfully and saved to {output_path}")
    except Exception as e:
        logger.error(f"Failed to amend task list: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()