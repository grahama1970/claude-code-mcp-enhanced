#!/usr/bin/env python3
"""
Test suite for the Task Amender module.

This test suite validates the task amender functionality to ensure
it properly amends markdown task files to conform to the template guide.

Documentation:
- pytest: https://docs.pytest.org/
- Task Amender: See src/claude_code_mcp/task_amender.py

Sample Input:
  Basic markdown file with missing sections

Expected Output:
  Amended markdown file with all required sections
"""

import os
import tempfile
import shutil
from pathlib import Path

import pytest

from claude_code_mcp.task_amender import (
    amend_task_list,
    check_required_sections,
    add_missing_sections,
    ensure_status_markers,
    ensure_checkboxes,
    add_execution_info
)


@pytest.fixture
def test_task_file():
    """Create a temporary test task file with missing sections."""
    temp_dir = tempfile.mkdtemp()
    task_path = Path(temp_dir) / "test_task.md"
    
    # Create a minimal task file with missing sections
    content = """# Task 999: Test Task

This is a test task with missing sections.

## Implementation Tasks

### Task 1: Test Subtask

- Step 1: Do something
- Step 2: Do something else

"""
    
    with open(task_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    yield task_path
    
    # Cleanup
    shutil.rmtree(temp_dir)


def test_check_required_sections(test_task_file):
    """Test checking for required sections."""
    with open(test_task_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    missing = check_required_sections(content)
    
    # Verify that expected sections are reported as missing
    assert "**Objective**" in missing
    assert "**Requirements**" in missing
    assert "## Overview" in missing
    assert "## Usage Table" in missing
    assert "## Version Control Plan" in missing
    assert "## Resources" in missing
    assert "## Progress Tracking" in missing
    assert "## Report Documentation Requirements" in missing


def test_add_missing_sections(test_task_file):
    """Test adding missing sections."""
    with open(test_task_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Get missing sections
    missing = check_required_sections(content)
    
    # Add missing sections
    updated = add_missing_sections(content, missing)
    
    # Verify sections were added
    assert "**Objective**" in updated
    assert "**Requirements**" in updated
    assert "## Overview" in updated
    assert "## Usage Table" in updated
    assert "## Version Control Plan" in updated
    assert "## Resources" in updated
    assert "## Progress Tracking" in updated
    assert "## Report Documentation Requirements" in updated


def test_ensure_status_markers(test_task_file):
    """Test ensuring status markers are added."""
    with open(test_task_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    updated = ensure_status_markers(content)
    
    # Verify status markers were added
    assert "# Task 999: Test Task ⏳ Not Started" in updated
    assert "### Task 1: Test Subtask ⏳ Not Started" in updated


def test_ensure_checkboxes(test_task_file):
    """Test ensuring checkboxes are added to steps."""
    with open(test_task_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    updated = ensure_checkboxes(content)
    
    # Verify checkboxes were added
    assert "- [ ] Step 1: Do something" in updated
    assert "- [ ] Step 2: Do something else" in updated


def test_add_execution_info(test_task_file):
    """Test adding execution info to tasks."""
    with open(test_task_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    updated = add_execution_info(content)
    
    # Verify execution info was added (this is more complex and depends on implementation)
    assert "**Execution Mode**" in updated


def test_amend_task_list_integration(test_task_file):
    """Test the complete amend_task_list function."""
    output_path = str(test_task_file) + ".amended"
    
    # Amend the task
    amended_content = amend_task_list(str(test_task_file), output_path)
    
    # Verify output file was created
    assert os.path.exists(output_path)
    
    # Read output file
    with open(output_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Verify all required sections are present
    assert "**Objective**" in content
    assert "**Requirements**" in content
    assert "## Overview" in content
    assert "## Usage Table" in content
    assert "## Version Control Plan" in content
    assert "## Resources" in content
    assert "## Progress Tracking" in content
    assert "## Report Documentation Requirements" in content
    
    # Verify status markers
    assert "# Task 999: Test Task ⏳ Not Started" in content
    assert "### Task 1: Test Subtask ⏳ Not Started" in content
    
    # Verify execution mode
    assert "**Execution Mode**" in content
    
    # Verify checkboxes
    assert "- [ ] Step 1:" in content
    assert "- [ ] Step 2:" in content
    
    # Clean up
    os.unlink(output_path)


if __name__ == "__main__":
    import sys
    
    # Track validation failures
    all_validation_failures = []
    total_tests = 0
    
    # Test check_required_sections
    total_tests += 1
    try:
        # Create a temporary test file
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.md', delete=False) as f:
            f.write("# Task 999: Test Task\n\nThis is a test task with missing sections.")
        
        # Test the function
        with open(f.name, 'r') as file:
            content = file.read()
        
        missing = check_required_sections(content)
        assert "**Objective**" in missing
        assert "**Requirements**" in missing
        assert "## Overview" in missing
        
        # Clean up
        os.unlink(f.name)
    except Exception as e:
        all_validation_failures.append(f"check_required_sections test failed: {str(e)}")
    
    # Test amend_task_list
    total_tests += 1
    try:
        # Create a temporary test file
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.md', delete=False) as f:
            f.write("# Task 999: Test Task\n\nThis is a test task with missing sections.")
        
        # Test the function
        output_path = f.name + ".amended"
        amend_task_list(f.name, output_path)
        
        # Verify output file exists and has required sections
        assert os.path.exists(output_path)
        with open(output_path, 'r') as file:
            content = file.read()
        
        assert "**Objective**" in content
        assert "**Requirements**" in content
        assert "## Overview" in content
        
        # Clean up
        os.unlink(f.name)
        os.unlink(output_path)
    except Exception as e:
        all_validation_failures.append(f"amend_task_list test failed: {str(e)}")
    
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