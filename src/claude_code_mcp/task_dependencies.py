"""
Task dependencies manager for Claude Code MCP.

This module provides functionality for managing task dependencies and execution flow,
allowing tasks to be executed in a mix of sequential and parallel patterns based on
their dependencies and specified execution modes.

Documentation:
- asyncio: https://docs.python.org/3/library/asyncio.html
- networkx: https://networkx.org/documentation/stable/index.html

Sample Input:
  tasks = [
    {"id": "task-1", "dependencies": [], "executionMode": "sequential"},
    {"id": "task-2", "dependencies": ["task-1"], "executionMode": "parallel"},
    {"id": "task-3", "dependencies": ["task-1"], "executionMode": "parallel"},
    {"id": "task-4", "dependencies": ["task-2", "task-3"], "executionMode": "sequential"}
  ]

Expected Output:
  Execution plan with tasks ordered based on dependencies and execution modes.
"""

import asyncio
from enum import Enum
from typing import Dict, List, Set, Any, Optional
import networkx as nx
from loguru import logger

from claude_code_mcp.task_executor import ExecutionMode, TaskStatus


class TaskDependencyError(Exception):
    """Exception raised for task dependency issues."""
    pass


class TaskDependencyManager:
    """
    Manages task dependencies and creates execution plans.
    
    This class is responsible for analyzing task dependencies, detecting cycles,
    and creating an execution plan that respects the dependencies while
    maximizing parallel execution where appropriate.
    """
    
    def __init__(self):
        """Initialize the dependency manager."""
        self.dependency_graph = nx.DiGraph()
        
    def add_task(self, task_id: str, dependencies: List[str], execution_mode: str = "sequential"):
        """
        Add a task with its dependencies to the graph.
        
        Args:
            task_id: Unique identifier for the task
            dependencies: List of task IDs this task depends on
            execution_mode: "sequential" or "parallel"
        """
        # Add the task node with attributes
        self.dependency_graph.add_node(
            task_id, 
            execution_mode=execution_mode
        )
        
        # Add dependency edges
        for dep in dependencies:
            self.dependency_graph.add_edge(dep, task_id)
    
    def validate_dependencies(self) -> List[str]:
        """
        Validate the dependency graph for cycles and missing dependencies.
        
        Returns:
            List of validation errors, empty if valid
        """
        errors = []
        
        # Check for cycles
        try:
            nx.find_cycle(self.dependency_graph)
            errors.append("Dependency cycle detected in tasks")
        except nx.NetworkXNoCycle:
            # No cycle found, this is good
            pass
        
        # Check for missing dependencies
        for node in self.dependency_graph.nodes:
            for predecessor in self.dependency_graph.predecessors(node):
                if predecessor not in self.dependency_graph.nodes:
                    errors.append(f"Task {node} depends on missing task {predecessor}")
        
        return errors
    
    def create_execution_plan(self, tasks: List[Dict[str, Any]]) -> List[List[str]]:
        """
        Create an execution plan for tasks respecting dependencies and execution modes.
        
        The plan consists of a list of task groups. Each group can be executed in parallel,
        but groups must be executed sequentially in the order provided.
        
        Args:
            tasks: List of task dictionaries with id, dependencies, and executionMode
            
        Returns:
            List of task groups, where each group is a list of task IDs that can run in parallel
        """
        # Clear any existing graph
        self.dependency_graph.clear()
        
        # Add all tasks to the graph
        for task in tasks:
            task_id = task.get("id")
            dependencies = task.get("dependencies", [])
            execution_mode = task.get("executionMode", "sequential")
            
            self.add_task(task_id, dependencies, execution_mode)
        
        # Validate the graph
        errors = self.validate_dependencies()
        if errors:
            raise TaskDependencyError("\n".join(errors))
        
        # Create execution plan
        execution_plan = []
        remaining_tasks = set(self.dependency_graph.nodes)
        
        while remaining_tasks:
            # Find tasks with no remaining dependencies
            ready_tasks = []
            for task_id in list(remaining_tasks):
                predecessors = set(self.dependency_graph.predecessors(task_id))
                if not predecessors.intersection(remaining_tasks):
                    ready_tasks.append(task_id)
            
            if not ready_tasks:
                # This shouldn't happen if the graph is acyclic
                raise TaskDependencyError("Could not find next tasks to execute. This may indicate a cycle in the dependencies.")
            
            # Group the ready tasks by execution mode
            sequential_tasks = []
            parallel_tasks = []
            
            for task_id in ready_tasks:
                execution_mode = self.dependency_graph.nodes[task_id].get("execution_mode", "sequential")
                if execution_mode == "parallel":
                    parallel_tasks.append(task_id)
                else:
                    sequential_tasks.append(task_id)
            
            # Add sequential tasks individually
            for task_id in sequential_tasks:
                execution_plan.append([task_id])
                remaining_tasks.remove(task_id)
            
            # Add parallel tasks as a group
            if parallel_tasks:
                execution_plan.append(parallel_tasks)
                for task_id in parallel_tasks:
                    remaining_tasks.remove(task_id)
        
        return execution_plan

    @staticmethod
    def get_task_dependencies(task_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Extract dependency information from task data.
        
        Args:
            task_data: Task data including subtasks with dependencies
            
        Returns:
            Dictionary mapping task IDs to lists of dependency task IDs
        """
        dependencies = {}
        subtasks = task_data.get("subtasks", [])
        
        for subtask in subtasks:
            task_id = subtask.get("id")
            task_deps = subtask.get("dependencies", [])
            dependencies[task_id] = task_deps
        
        return dependencies


# Validation function
def _validate_task_dependencies() -> bool:
    """Run validation checks for the task dependencies module."""
    import sys
    
    # Track validation failures
    all_validation_failures = []
    total_tests = 0
    
    # Test 1: Basic dependency validation
    total_tests += 1
    try:
        manager = TaskDependencyManager()
        manager.add_task("task-1", [])
        manager.add_task("task-2", ["task-1"])
        manager.add_task("task-3", ["task-1"])
        manager.add_task("task-4", ["task-2", "task-3"])
        
        errors = manager.validate_dependencies()
        assert not errors, f"Expected no errors, got: {errors}"
    except Exception as e:
        all_validation_failures.append(f"Basic dependency validation test failed: {str(e)}")
    
    # Test 2: Cycle detection
    total_tests += 1
    try:
        manager = TaskDependencyManager()
        manager.add_task("task-1", [])
        manager.add_task("task-2", ["task-1"])
        manager.add_task("task-3", ["task-2"])
        manager.add_task("task-1", ["task-3"])  # Creates a cycle
        
        errors = manager.validate_dependencies()
        assert len(errors) > 0, "Expected cycle detection to report errors"
        assert "cycle" in errors[0].lower(), f"Expected cycle error message, got: {errors[0]}"
    except Exception as e:
        all_validation_failures.append(f"Cycle detection test failed: {str(e)}")
    
    # Test 3: Missing dependency detection
    total_tests += 1
    try:
        manager = TaskDependencyManager()
        manager.add_task("task-1", [])
        manager.add_task("task-2", ["task-1"])
        manager.add_task("task-3", ["missing-task"])  # Missing dependency
        
        errors = manager.validate_dependencies()
        assert len(errors) > 0, "Expected missing dependency detection to report errors"
        assert "missing" in errors[0].lower(), f"Expected missing dependency error message, got: {errors[0]}"
    except Exception as e:
        all_validation_failures.append(f"Missing dependency detection test failed: {str(e)}")
    
    # Test 4: Execution plan creation
    total_tests += 1
    try:
        tasks = [
            {"id": "task-1", "dependencies": [], "executionMode": "sequential"},
            {"id": "task-2", "dependencies": ["task-1"], "executionMode": "parallel"},
            {"id": "task-3", "dependencies": ["task-1"], "executionMode": "parallel"},
            {"id": "task-4", "dependencies": ["task-2", "task-3"], "executionMode": "sequential"}
        ]
        
        manager = TaskDependencyManager()
        plan = manager.create_execution_plan(tasks)
        
        # Validate the plan
        assert len(plan) == 3, f"Expected 3 execution groups, got {len(plan)}"
        assert plan[0] == ["task-1"], f"Expected first group to be ['task-1'], got {plan[0]}"
        assert set(plan[1]) == {"task-2", "task-3"}, f"Expected second group to be ['task-2', 'task-3'] in any order, got {plan[1]}"
        assert plan[2] == ["task-4"], f"Expected third group to be ['task-4'], got {plan[2]}"
    except Exception as e:
        all_validation_failures.append(f"Execution plan creation test failed: {str(e)}")
    
    # Test 5: Mixed execution modes
    total_tests += 1
    try:
        tasks = [
            {"id": "task-1", "dependencies": [], "executionMode": "sequential"},
            {"id": "task-2", "dependencies": ["task-1"], "executionMode": "sequential"},
            {"id": "task-3", "dependencies": ["task-1"], "executionMode": "sequential"},
            {"id": "task-4", "dependencies": ["task-2", "task-3"], "executionMode": "sequential"}
        ]
        
        manager = TaskDependencyManager()
        plan = manager.create_execution_plan(tasks)
        
        # With all sequential tasks, each should be in its own group
        assert len(plan) == 4, f"Expected 4 execution groups for all sequential tasks, got {len(plan)}"
        for group in plan:
            assert len(group) == 1, f"Expected each sequential task in its own group, got {group}"
    except Exception as e:
        all_validation_failures.append(f"Mixed execution modes test failed: {str(e)}")
    
    # Final validation result
    if all_validation_failures:
        print(f"❌ VALIDATION FAILED - {len(all_validation_failures)} of {total_tests} tests failed:")
        for failure in all_validation_failures:
            print(f"  - {failure}")
        return False
    else:
        print(f"✅ VALIDATION PASSED - All {total_tests} tests produced expected results")
        print("Function is validated and formal tests can now be written")
        return True


if __name__ == "__main__":
    # Run validation when executed directly
    success = _validate_task_dependencies()
    import sys
    sys.exit(0 if success else 1)