#!/usr/bin/env python3
"""
Task to JSON Converter

This script first amends a task markdown file to conform to the template guide
and then converts it to JSON format for execution by the MCP.

Usage:
  python task_to_json.py input.md -o output.json
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import Optional

import typer

# Add the project root to the path
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

# Import functions from amend_task.py which has all the necessary functions
try:
    from amend_task import amend_task_list, check_required_sections
except ImportError:
    print("Error: Could not import task_amender functions. Make sure amend_task.py is in the same directory.")
    sys.exit(1)


def extract_task_info(content: str):
    """
    Extract key information from a markdown task file.
    
    Args:
        content: Content of the markdown file
        
    Returns:
        Dictionary containing task information
    """
    # Extract task ID and title
    header_match = re.search(r"# Task (\d+): (.*?)( ⏳.*)?$", content, re.MULTILINE)
    if not header_match:
        raise ValueError("Could not find task ID and title in the first line")
    
    task_id = header_match.group(1)
    title = header_match.group(2).strip()
    status = "not_started"  # Default status
    
    # Extract objective (optional)
    objective = ""
    objective_match = re.search(r"\*\*Objective\*\*:\s*(.*?)(?=\n\n|\*\*Requirements\*\*)", content, re.DOTALL)
    if objective_match:
        objective = objective_match.group(1).strip()
    
    # Extract requirements (optional)
    requirements = []
    requirements_section = re.search(r"\*\*Requirements\*\*:\s*(.*?)(?=\n\n|\#\# )", content, re.DOTALL)
    if requirements_section:
        requirements_text = requirements_section.group(1)
        requirement_matches = re.findall(r"\d+\.\s*(.*?)(?=\n\d+\.|\n\n|\Z)", requirements_text, re.DOTALL)
        requirements = [req.strip() for req in requirement_matches]
    
    # Extract overview (optional)
    overview = ""
    overview_match = re.search(r"## Overview\s*(.*?)(?=\n\n\*\*IMPORTANT\*\*|\n\n## )", content, re.DOTALL)
    if overview_match:
        overview = overview_match.group(1).strip()
    
    # Extract subtasks
    subtasks = []
    subtask_pattern = r"### Task (\d+): (.*?)( ⏳.*?)?\s*\n(.*?)(?=\n### Task|\n## |$)"
    subtask_matches = re.finditer(subtask_pattern, content, re.DOTALL)
    
    for match in subtask_matches:
        try:
            subtask_id = match.group(1).strip()
            subtask_title = match.group(2).strip()
            subtask_content = match.group(4) if len(match.groups()) > 3 else ""
            
            # Extract execution mode
            execution_mode = "sequential"  # Default
            mode_match = re.search(r"\*\*Execution Mode\*\*:\s*(.*?)(?=\n|\*\*)", subtask_content)
            if mode_match:
                mode = mode_match.group(1).strip()
                if "parallel" in mode.lower():
                    execution_mode = "parallel"
            
            # Extract dependencies
            dependencies = []
            deps_match = re.search(r"\*\*Dependencies\*\*:\s*(.*?)(?=\n|\*\*)", subtask_content)
            if deps_match:
                deps_text = deps_match.group(1).strip()
                # Extract task IDs
                for dep in re.findall(r'"([^"]+)"', deps_text):
                    dependencies.append(dep)
                
                if not dependencies:
                    # Try comma-separated format
                    for dep in deps_text.split(","):
                        dep = dep.strip()
                        if dep:
                            dependencies.append(dep)
            
            # Extract description (first paragraph)
            description = ""
            desc_match = re.search(r"\*\*Description\*\*:\s*(.*?)(?=\n\n|\*\*)", subtask_content)
            if desc_match:
                description = desc_match.group(1).strip()
            
            # Extract steps
            steps = []
            steps_match = re.search(r"\*\*Implementation Steps\*\*:\s*(.*?)(?=\n\n\*\*|$)", subtask_content, re.DOTALL)
            if steps_match:
                steps_text = steps_match.group(1)
                step_pattern = r"- \[ \] (\d+\.\d+) (.*?)(?=\n- \[ \]|\n\n|$)"
                step_matches = re.finditer(step_pattern, steps_text, re.DOTALL)
                
                for step_match in step_matches:
                    step_id = step_match.group(1)
                    step_desc = step_match.group(2).strip()
                    steps.append(f"{step_id} {step_desc}")
            
            subtasks.append({
                "id": f"task-{subtask_id}",
                "title": subtask_title,
                "description": description,
                "executionMode": execution_mode,
                "steps": steps,
                "status": "not_started",
                "dependencies": dependencies
            })
        except Exception as e:
            print(f"Warning: Error processing subtask {match.group(0)[:50]}...: {e}")
    
    # Create result dictionary
    result = {
        "metadata": {
            "task_id": f"task-{task_id}",
            "title": title,
            "status": status,
            "priority": "medium"
        },
        "objective": objective,
        "requirements": requirements,
        "overview": overview,
        "subtasks": subtasks,
        "resources": {},
        "usage_examples": []
    }
    
    return result


def task_to_json(markdown_path, output_path=None, amend=True):
    """
    Convert a markdown task file to JSON.
    
    Args:
        markdown_path: Path to the input markdown file
        output_path: Path to save the JSON output
        amend: Whether to amend the task to conform to the template
        
    Returns:
        The JSON representation of the task
    """
    # Check if the file exists
    if not os.path.exists(markdown_path):
        raise FileNotFoundError(f"Input file {markdown_path} does not exist")
    
    # Step 1: Check if the file needs amendment
    with open(markdown_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    missing_sections = check_required_sections(content)
    needs_amendment = bool(missing_sections)
    
    # Step 2: Amend if needed
    if needs_amendment and amend:
        print(f"Task file does not conform to template. Missing sections: {', '.join(missing_sections)}")
        print("Amending task file...")
        
        # Create a temporary file for the amended version
        temp_path = f"{markdown_path}.amended"
        amended_content = amend_task_list(markdown_path, temp_path)
        
        # Read the amended content
        with open(temp_path, 'r', encoding='utf-8') as file:
            content = file.read()
    
    # Step 3: Extract task information
    try:
        task_info = extract_task_info(content)
    except Exception as e:
        print(f"Error extracting task information: {e}")
        if needs_amendment and amend:
            os.unlink(temp_path)  # Clean up temporary file
        raise
    
    # Step 4: Save to JSON if output path provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as file:
            json.dump(task_info, file, indent=2)
        print(f"Task JSON written to {output_path}")
    
    # Clean up temporary file if created
    if needs_amendment and amend:
        os.unlink(temp_path)
    
    return task_info


app = typer.Typer()

@app.command()
def main(
    input_file: str = typer.Argument(..., help="Path to the input markdown file"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Path to save the JSON output (default: print to stdout)"),
    no_amend: bool = typer.Option(False, "--no-amend", help="Do not amend the task file to conform to the template"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose output")
):
    """Convert a task markdown file to JSON, amending it if needed."""
    
    try:
        task_info = task_to_json(input_file, output, not no_amend)
        
        if not output:
            # Print to stdout if no output file specified
            typer.echo(json.dumps(task_info, indent=2))
            
        typer.echo("Task conversion completed successfully.")
    
    except Exception as e:
        typer.echo(f"Error: {e}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()