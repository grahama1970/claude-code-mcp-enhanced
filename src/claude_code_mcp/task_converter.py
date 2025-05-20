"""
Task Converter for Claude Code MCP task orchestration system.

This module provides functionality for converting markdown task descriptions into
structured JSON format for execution by the task orchestration system.

Documentation:
- Markdown: https://python-markdown.github.io/
- JSON Schema: https://json-schema.org/
- Pydantic: https://docs.pydantic.dev/

Sample Input:
  A markdown file with structured task description

Expected Output:
  JSON representation of the task structure with metadata, subtasks, and verification requirements
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Union

from loguru import logger
from pydantic import BaseModel, Field, validator

class TaskMetadata(BaseModel):
    """Task metadata model for validation and serialization."""
    task_id: str
    title: str
    status: str = "not_started"
    priority: str = "medium"
    
    @validator("status")
    def validate_status(cls, v: str) -> str:
        """Validate task status."""
        valid_statuses = ["not_started", "in_progress", "completed", "blocked"]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of {valid_statuses}")
        return v.lower()
    
    @validator("priority")
    def validate_priority(cls, v: str) -> str:
        """Validate task priority."""
        valid_priorities = ["low", "medium", "high", "critical"]
        if v.lower() not in valid_priorities:
            raise ValueError(f"Priority must be one of {valid_priorities}")
        return v.lower()


class SubTask(BaseModel):
    """Subtask model for validation and serialization."""
    id: str
    title: str
    description: str
    steps: List[str]
    status: str = "not_started"
    dependencies: List[str] = []


class Task(BaseModel):
    """Main task model for validation and serialization."""
    metadata: TaskMetadata
    objective: str
    requirements: List[str]
    overview: str
    subtasks: List[SubTask]
    resources: Dict[str, List[str]] = {}
    usage_examples: List[Dict[str, str]] = []


def parse_task_from_markdown(markdown_path: Path) -> Dict[str, Any]:
    """
    Parse a markdown file into a structured task dictionary.
    
    Args:
        markdown_path: Path to the markdown file containing task description
        
    Returns:
        Dictionary representation of the task structure
    """
    try:
        # Try different encodings
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                content = markdown_path.read_text(encoding=encoding)
                logger.info(f"Successfully read file using {encoding} encoding")
                break
            except UnicodeDecodeError:
                continue
        else:
            # If all encodings fail, try binary mode and detect encoding
            with open(markdown_path, 'rb') as f:
                content = f.read().decode('utf-8', errors='replace')
                logger.warning(f"Used fallback encoding with replacement characters")
    except Exception as e:
        logger.error(f"Error reading markdown file: {e}")
        raise ValueError(f"Could not read markdown file: {e}")
    
    # Extract task ID and title from first line
    header_match = re.search(r"# Task (\d+): (.*?)( ⏳.*)?$", content, re.MULTILINE)
    if not header_match:
        raise ValueError("Could not find task ID and title in the first line")
    
    task_id = header_match.group(1)
    title = header_match.group(2).strip()
    status = "not_started"  # Default status
    
    # Extract objective
    objective_match = re.search(r"\*\*Objective\*\*:\s*(.*?)(?=\n\n|\*\*Requirements\*\*)", content, re.DOTALL)
    if not objective_match:
        raise ValueError("Could not find objective section")
    objective = objective_match.group(1).strip()
    
    # Extract requirements
    requirements_section = re.search(r"\*\*Requirements\*\*:\s*(.*?)(?=\n\n|\#\# )", content, re.DOTALL)
    if not requirements_section:
        raise ValueError("Could not find requirements section")
    
    requirements_text = requirements_section.group(1)
    requirements = [req.strip() for req in re.findall(r"\d+\.\s*(.*?)(?=\n\d+\.|\n\n|\Z)", requirements_text, re.DOTALL)]
    
    # Extract overview
    overview_match = re.search(r"## Overview\s*(.*?)(?=\n\n\*\*IMPORTANT\*\*|\n\n## )", content, re.DOTALL)
    if not overview_match:
        raise ValueError("Could not find overview section")
    overview = overview_match.group(1).strip()
    
    # Extract subtasks
    subtasks = []
    try:
        subtask_sections = re.finditer(r"### Task (\d+): (.*?)( ⏳.*?)?\s*\n\n(.*?)(?=\n### Task|\n## |$)", content, re.DOTALL)
        
        for match in subtask_sections:
            try:
                subtask_id = match.group(1)
                subtask_title = match.group(2).strip() if isinstance(match.group(2), str) else str(match.group(2))
                subtask_content = match.group(4)
                
                # Extract steps
                steps = []
                steps_section = re.search(r"\*\*Implementation Steps\*\*:\s*(.*?)(?=\n\n\*\*Technical Specifications\*\*|\n\n\*\*Verification Method\*\*|\n\n\*\*CLI Testing|\Z)", subtask_content, re.DOTALL)
                
                if steps_section:
                    steps_text = steps_section.group(1)
                    
                    # Extract individual steps with their sub-steps
                    step_matches = re.finditer(r"- \[ \] (\d+\.\d+) (.*?)(?=\n  - |\n- \[ \]|\n\n|\Z)", steps_text, re.DOTALL)
                    for step_match in step_matches:
                        try:
                            step_id = step_match.group(1)
                            step_title = step_match.group(2).strip() if isinstance(step_match.group(2), str) else ""
                            
                            # Extract substeps if any
                            substep_text = ""
                            substep_matches = re.finditer(r"  - (.*?)(?=\n  - |\n- \[ \]|\n\n|\Z)", step_match.group(0), re.DOTALL)
                            for substep_match in substep_matches:
                                substep = substep_match.group(1).strip() if isinstance(substep_match.group(1), str) else ""
                                substep_text += f"\n  - {substep}"
                            
                            steps.append(f"{step_id} {step_title}{substep_text}")
                        except Exception as e:
                            logger.warning(f"Error processing step: {e}")
                            continue
                
                # Extract dependencies (if any)
                dependencies = []
                
                subtask_desc = ""
                if "\n\n" in subtask_content:
                    subtask_desc = subtask_content.split("\n\n")[0].strip()
                
                subtasks.append({
                    "id": subtask_id,
                    "title": subtask_title,
                    "description": subtask_desc,
                    "steps": steps,
                    "status": "not_started",
                    "dependencies": dependencies
                })
            except Exception as e:
                logger.warning(f"Error processing subtask: {e}")
                continue
    except Exception as e:
        logger.warning(f"Error extracting subtasks: {e}")
        # Continue with an empty subtasks list
    
    # Extract resources
    resources = {}
    resources_section = re.search(r"## Resources\s*(.*?)(?=\n\n## |$)", content, re.DOTALL)
    if resources_section:
        resources_content = resources_section.group(1)
        
        # Extract Python packages
        packages_match = re.search(r"\*\*Python Packages\*\*:\s*(.*?)(?=\n\n\*\*|\Z)", resources_content, re.DOTALL)
        if packages_match:
            packages_text = packages_match.group(1)
            packages = [pkg.strip() for pkg in re.findall(r"- (.*?)(?=\n-|\Z)", packages_text)]
            resources["python_packages"] = packages
        
        # Extract documentation links
        docs_match = re.search(r"\*\*Documentation\*\*:\s*(.*?)(?=\n\n\*\*|\Z)", resources_content, re.DOTALL)
        if docs_match:
            docs_text = docs_match.group(1)
            docs = [doc.strip() for doc in re.findall(r"- \[(.*?)\]\((.*?)\)", docs_text)]
            resources["documentation"] = [f"{name}: {url}" for name, url in docs]
        
        # Extract example implementations
        examples_match = re.search(r"\*\*Example Implementations\*\*:\s*(.*?)(?=\n\n\*\*|\Z)", resources_content, re.DOTALL)
        if examples_match:
            examples_text = examples_match.group(1)
            examples = [ex.strip() for ex in re.findall(r"- \[(.*?)\]\((.*?)\)", examples_text)]
            resources["examples"] = [f"{name}: {url}" for name, url in examples]
    
    # Extract usage examples
    usage_examples = []
    usage_section = re.search(r"## Usage Table\s*\n\|\s*Command / Function\s*\|\s*Description\s*\|\s*Example Usage\s*\|\s*Expected Output\s*\|\s*\n\|[-\s]*\|\s*[-\s]*\|\s*[-\s]*\|\s*[-\s]*\|\s*(.*?)(?=\n\n## |$)", content, re.DOTALL)
    
    if usage_section:
        usage_content = usage_section.group(1)
        usage_rows = re.findall(r"\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|", usage_content)
        
        for command, description, example, output in usage_rows:
            usage_examples.append({
                "command": command.strip(),
                "description": description.strip(),
                "example": example.strip(),
                "expected_output": output.strip()
            })
    
    # Create task dictionary
    task_dict = {
        "metadata": {
            "task_id": task_id,
            "title": title,
            "status": status,
            "priority": "medium"  # Default priority
        },
        "objective": objective,
        "requirements": requirements,
        "overview": overview,
        "subtasks": subtasks,
        "resources": resources,
        "usage_examples": usage_examples
    }
    
    return task_dict


def convert_task(markdown_path: str, output_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Convert a markdown task description to JSON format.
    
    Args:
        markdown_path: Path to the markdown file
        output_path: Optional path to save the JSON output
        
    Returns:
        Dictionary representation of the task
    """
    path = Path(markdown_path)
    if not path.exists():
        raise FileNotFoundError(f"Markdown file not found: {markdown_path}")
    
    # Parse markdown into task dictionary
    task_dict = parse_task_from_markdown(path)
    
    try:
        # Validate with Pydantic model
        task = Task(**task_dict)
        validated_dict = task.dict()
    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise ValueError(f"Task validation failed: {e}")
    
    # Write to output file if specified
    if output_path:
        output = Path(output_path)
        output.write_text(json.dumps(validated_dict, indent=2), encoding="utf-8")
        logger.info(f"Task JSON written to {output_path}")
    
    return validated_dict


if __name__ == "__main__":
    import sys
    
    # Track validation failures
    all_validation_failures = []
    total_tests = 0
    
    # Test validation with a sample task
    total_tests += 1
    try:
        # Create a minimal valid task for testing
        test_task = {
            "metadata": {
                "task_id": "001",
                "title": "Test Task",
                "status": "not_started",
                "priority": "medium"
            },
            "objective": "Test objective",
            "requirements": ["Requirement 1", "Requirement 2"],
            "overview": "Task overview",
            "subtasks": [
                {
                    "id": "1",
                    "title": "Subtask 1",
                    "description": "Subtask description",
                    "steps": ["1.1 Step 1", "1.2 Step 2"],
                    "status": "not_started",
                    "dependencies": []
                }
            ]
        }
        
        # Validate with Pydantic model
        task = Task(**test_task)
        validated = task.dict()
        assert validated["metadata"]["task_id"] == "001", "Task ID validation failed"
        assert len(validated["subtasks"]) == 1, "Subtasks validation failed"
    except Exception as e:
        all_validation_failures.append(f"Task validation test failed: {str(e)}")
    
    # Test status validation
    total_tests += 1
    try:
        # Test invalid status
        test_metadata = {
            "task_id": "001",
            "title": "Test Task",
            "status": "invalid_status",
            "priority": "medium"
        }
        
        # This should raise a validation error
        try:
            metadata = TaskMetadata(**test_metadata)
            all_validation_failures.append("Status validation test failed: Invalid status was accepted")
        except ValueError:
            # This is expected - test passes
            pass
    except Exception as e:
        all_validation_failures.append(f"Status validation test failed with unexpected error: {str(e)}")
    
    # Final validation result
    if all_validation_failures:
        print(f"❌ VALIDATION FAILED - {len(all_validation_failures)} of {total_tests} tests failed:")
        for failure in all_validation_failures:
            print(f"  - {failure}")
        sys.exit(1)
    else:
        print(f"✅ VALIDATION PASSED - All {total_tests} tests produced expected results")
        print("Function is validated and formal tests can now be written")
        sys.exit(0)