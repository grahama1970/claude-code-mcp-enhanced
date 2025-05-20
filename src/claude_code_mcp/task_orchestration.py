#!/usr/bin/env python3
"""
Standalone task orchestration script for Claude Code MCP.

This script provides a simplified interface to the task orchestration functionality,
allowing direct use without requiring MCP integration.

Usage:
  python task_orchestration.py convert-task <markdown_path> <output_path>
  python task_orchestration.py execute-task <task_id>
  python task_orchestration.py task-status <task_id>
"""

import sys
import os
import json
import subprocess
from pathlib import Path

# Set up environment
PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON_PATH = PROJECT_ROOT / ".venv" / "bin" / "python"
os.environ["PYTHONPATH"] = str(PROJECT_ROOT)


def convert_task(markdown_path, output_path):
    """Convert a markdown task description to JSON format."""
    cmd = [
        str(PYTHON_PATH),
        "-m",
        "claude_code_mcp.cli",
        "convert-task-markdown",
        markdown_path,
        "--output-path",
        output_path,
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    
    if result.returncode == 0:
        print("Task conversion successful")
        print(result.stdout)
        
        # Read and validate the output file
        try:
            with open(output_path, "r") as f:
                task_data = json.load(f)
            print(f"Task JSON written to {output_path}")
            print(f"Task ID: {task_data.get('metadata', {}).get('task_id')}")
            print(f"Task Title: {task_data.get('metadata', {}).get('title')}")
            print(f"Subtasks: {len(task_data.get('subtasks', []))}")
        except Exception as e:
            print(f"Error reading output file: {e}")
    else:
        print("Task conversion failed")
        print(f"Error: {result.stderr}")


def execute_task(task_id):
    """Execute a task with the task orchestration system."""
    cmd = [
        str(PYTHON_PATH),
        "-m",
        "claude_code_mcp.cli",
        "execute-task",
        task_id,
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    
    if result.returncode == 0:
        print("Task execution started")
        print(result.stdout)
    else:
        print("Task execution failed")
        print(f"Error: {result.stderr}")


def task_status(task_id):
    """Check the status of a task."""
    cmd = [
        str(PYTHON_PATH),
        "-m",
        "claude_code_mcp.cli",
        "task-status",
        task_id,
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    
    if result.returncode == 0:
        print("Task status:")
        print(result.stdout)
    else:
        print("Failed to retrieve task status")
        print(f"Error: {result.stderr}")


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Error: No command specified")
        print(f"Usage: {sys.argv[0]} [convert-task|execute-task|task-status] ...")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "convert-task":
        if len(sys.argv) < 4:
            print("Error: Missing arguments for convert-task")
            print(f"Usage: {sys.argv[0]} convert-task <markdown_path> <output_path>")
            sys.exit(1)
        
        markdown_path = sys.argv[2]
        output_path = sys.argv[3]
        convert_task(markdown_path, output_path)
    
    elif command == "execute-task":
        if len(sys.argv) < 3:
            print("Error: Missing arguments for execute-task")
            print(f"Usage: {sys.argv[0]} execute-task <task_id>")
            sys.exit(1)
        
        task_id = sys.argv[2]
        execute_task(task_id)
    
    elif command == "task-status":
        if len(sys.argv) < 3:
            print("Error: Missing arguments for task-status")
            print(f"Usage: {sys.argv[0]} task-status <task_id>")
            sys.exit(1)
        
        task_id = sys.argv[2]
        task_status(task_id)
    
    else:
        print(f"Error: Unknown command '{command}'")
        print(f"Usage: {sys.argv[0]} [convert-task|execute-task|task-status] ...")
        sys.exit(1)


if __name__ == "__main__":
    main()