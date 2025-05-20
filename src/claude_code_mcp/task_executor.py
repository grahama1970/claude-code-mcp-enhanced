"""
Task execution engine for Claude Code MCP.

This module provides functionality for executing tasks in either sequential or parallel mode,
along with status tracking and execution management. Now supports dependency-based execution.

Documentation:
- asyncio: https://docs.python.org/3/library/asyncio.html
- concurrent.futures: https://docs.python.org/3/library/concurrent.futures.html

Sample Input:
  task_data = {
    "id": "task-123",
    "subtasks": [
      {"id": "subtask-1", "description": "Do something", "command": "echo 'Task 1'", "dependencies": []},
      {"id": "subtask-2", "description": "Do something else", "command": "echo 'Task 2'", "dependencies": ["subtask-1"]},
      {"id": "subtask-3", "description": "Do another thing", "command": "echo 'Task 3'", "dependencies": ["subtask-1"]},
      {"id": "subtask-4", "description": "Final task", "command": "echo 'Task 4'", "dependencies": ["subtask-2", "subtask-3"]}
    ],
    "executionMode": "parallel"
  }

Expected Output:
  {
    "taskId": "task-123",
    "status": "completed",
    "subtasks": [
      {"id": "subtask-1", "status": "completed", "output": "Task 1"},
      {"id": "subtask-2", "status": "completed", "output": "Task 2"},
      {"id": "subtask-3", "status": "completed", "output": "Task 3"},
      {"id": "subtask-4", "status": "completed", "output": "Task 4"}
    ],
    "executionMode": "parallel",
    "startTime": "2025-05-20T10:15:30.123Z",
    "endTime": "2025-05-20T10:15:32.456Z"
  }
"""

import asyncio
import concurrent.futures
import subprocess
import json
import time
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Callable

from loguru import logger

# Try to import networkx for dependency management
try:
    import networkx as nx
    HAVE_NETWORKX = True
except ImportError:
    HAVE_NETWORKX = False


class TaskStatus(str, Enum):
    """Status of a task or subtask."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExecutionMode(str, Enum):
    """Task execution mode."""
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"


class TaskExecutor:
    """
    Executes tasks in either sequential or parallel mode.
    
    This class handles the execution of task workflows, managing the execution
    strategy based on the specified mode, and tracking the status of tasks and subtasks.
    It also supports dependency-based execution, where tasks can depend on other tasks.
    """
    
    def __init__(self, storage_dir: Optional[Path] = None):
        """
        Initialize the task executor.
        
        Args:
            storage_dir: Directory to store task execution data
        """
        self.storage_dir = storage_dir or Path("./task_data")
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
        
        # Try to import TaskDependencyManager
        self.dependency_manager = None
        try:
            # Only import if needed to avoid circular imports
            if HAVE_NETWORKX:
                from claude_code_mcp.task_dependencies import TaskDependencyManager
                self.dependency_manager = TaskDependencyManager()
        except ImportError:
            logger.warning("NetworkX or TaskDependencyManager not available. Dependency management disabled.")
    
    async def execute_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a task based on the specified execution mode and dependencies.
        
        Args:
            task_data: Task data including subtasks, execution mode, and dependencies
            
        Returns:
            Task execution results
        """
        task_id = task_data.get("id", f"task-{int(time.time())}")
        subtasks = task_data.get("subtasks", [])
        execution_mode = task_data.get("executionMode", ExecutionMode.SEQUENTIAL)
        
        # Initialize task status
        task_status = {
            "taskId": task_id,
            "status": TaskStatus.RUNNING,
            "subtasks": [{"id": st.get("id", f"subtask-{i}"), "status": TaskStatus.PENDING} 
                         for i, st in enumerate(subtasks)],
            "executionMode": execution_mode,
            "startTime": datetime.now().isoformat(),
            "endTime": None
        }
        
        # Store initial status
        self.active_tasks[task_id] = task_status
        await self._save_task_status(task_id, task_status)
        
        try:
            # Check if we can use dependency-based execution
            if self.dependency_manager is not None and HAVE_NETWORKX:
                # Extract dependencies
                for i, subtask in enumerate(subtasks):
                    if "id" not in subtask:
                        subtask["id"] = f"subtask-{i}"
                    if "dependencies" not in subtask:
                        subtask["dependencies"] = []
                    # Ensure executionMode is set
                    if "executionMode" not in subtask:
                        subtask["executionMode"] = execution_mode
                
                # Create execution plan based on dependencies
                try:
                    execution_plan = self.dependency_manager.create_execution_plan(subtasks)
                    await self._execute_with_dependencies(task_id, subtasks, execution_plan)
                except Exception as e:
                    logger.error(f"Dependency-based execution failed, falling back to {execution_mode} mode: {e}")
                    # Fall back to simple execution mode
                    if execution_mode == ExecutionMode.PARALLEL:
                        await self._execute_parallel(task_id, subtasks)
                    else:
                        await self._execute_sequential(task_id, subtasks)
            else:
                # Simple execution based on mode
                if execution_mode == ExecutionMode.PARALLEL:
                    await self._execute_parallel(task_id, subtasks)
                else:
                    await self._execute_sequential(task_id, subtasks)
                
            # Mark task as completed
            task_status["status"] = TaskStatus.COMPLETED
        except Exception as e:
            logger.error(f"Task {task_id} failed: {e}")
            task_status["status"] = TaskStatus.FAILED
            task_status["error"] = str(e)
        finally:
            # Set end time
            task_status["endTime"] = datetime.now().isoformat()
            await self._save_task_status(task_id, task_status)
            
        return task_status
    
    async def _execute_sequential(self, task_id: str, subtasks: List[Dict[str, Any]]) -> None:
        """
        Execute subtasks sequentially.
        
        Args:
            task_id: ID of the parent task
            subtasks: List of subtasks to execute
        """
        for i, subtask in enumerate(subtasks):
            subtask_id = subtask.get("id", f"subtask-{i}")
            logger.info(f"Executing subtask {subtask_id} sequentially")
            
            # Update subtask status to running
            await self._update_subtask_status(task_id, subtask_id, TaskStatus.RUNNING)
            
            try:
                # Execute the subtask
                result = await self._execute_subtask(subtask)
                
                # Update subtask status to completed
                await self._update_subtask_status(
                    task_id, 
                    subtask_id, 
                    TaskStatus.COMPLETED, 
                    output=result.get("output")
                )
            except Exception as e:
                logger.error(f"Subtask {subtask_id} failed: {e}")
                await self._update_subtask_status(
                    task_id, 
                    subtask_id, 
                    TaskStatus.FAILED, 
                    error=str(e)
                )
                # Depending on configuration, we might want to fail the entire task here
                # For now, we continue with the next subtask
    
    async def _execute_parallel(self, task_id: str, subtasks: List[Dict[str, Any]]) -> None:
        """
        Execute subtasks in parallel.
        
        Args:
            task_id: ID of the parent task
            subtasks: List of subtasks to execute
        """
        # Create tasks for each subtask
        tasks = []
        for i, subtask in enumerate(subtasks):
            subtask_id = subtask.get("id", f"subtask-{i}")
            logger.info(f"Scheduling subtask {subtask_id} for parallel execution")
            
            # Update subtask status to running
            await self._update_subtask_status(task_id, subtask_id, TaskStatus.RUNNING)
            
            # Create task
            task = asyncio.create_task(self._execute_subtask_wrapper(task_id, subtask_id, subtask))
            tasks.append(task)
        
        # Wait for all tasks to complete
        await asyncio.gather(*tasks)
    
    async def _execute_with_dependencies(self, task_id: str, subtasks: List[Dict[str, Any]], execution_plan: List[List[str]]) -> None:
        """
        Execute subtasks according to the dependency-based execution plan.
        
        Args:
            task_id: ID of the parent task
            subtasks: List of subtasks to execute
            execution_plan: List of subtask groups to execute in order
        """
        # Create a map of subtask ID to subtask
        subtask_map = {subtask.get("id", f"subtask-{i}"): subtask for i, subtask in enumerate(subtasks)}
        
        # Execute each group in the plan
        for group in execution_plan:
            logger.info(f"Executing subtask group: {group}")
            
            if len(group) == 1:
                # Sequential execution for a single task
                subtask_id = group[0]
                subtask = subtask_map.get(subtask_id)
                if subtask:
                    await self._update_subtask_status(task_id, subtask_id, TaskStatus.RUNNING)
                    try:
                        result = await self._execute_subtask(subtask)
                        await self._update_subtask_status(
                            task_id, 
                            subtask_id, 
                            TaskStatus.COMPLETED, 
                            output=result.get("output")
                        )
                    except Exception as e:
                        logger.error(f"Subtask {subtask_id} failed: {e}")
                        await self._update_subtask_status(
                            task_id, 
                            subtask_id, 
                            TaskStatus.FAILED, 
                            error=str(e)
                        )
                        # Depending on configuration, we might want to fail the entire task here
                        raise  # Re-raise to stop execution
            else:
                # Parallel execution for a group of tasks
                tasks = []
                for subtask_id in group:
                    subtask = subtask_map.get(subtask_id)
                    if subtask:
                        await self._update_subtask_status(task_id, subtask_id, TaskStatus.RUNNING)
                        task = asyncio.create_task(self._execute_subtask_wrapper(task_id, subtask_id, subtask))
                        tasks.append(task)
                
                # Wait for all tasks in this group to complete
                await asyncio.gather(*tasks)
    
    async def _execute_subtask_wrapper(
        self, 
        task_id: str, 
        subtask_id: str, 
        subtask: Dict[str, Any]
    ) -> None:
        """
        Wrapper for executing a subtask in parallel mode.
        
        Args:
            task_id: ID of the parent task
            subtask_id: ID of the subtask
            subtask: Subtask data
        """
        try:
            result = await self._execute_subtask(subtask)
            await self._update_subtask_status(
                task_id, 
                subtask_id, 
                TaskStatus.COMPLETED, 
                output=result.get("output")
            )
        except Exception as e:
            logger.error(f"Subtask {subtask_id} failed: {e}")
            await self._update_subtask_status(
                task_id, 
                subtask_id, 
                TaskStatus.FAILED, 
                error=str(e)
            )
    
    async def _execute_subtask(self, subtask: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a single subtask.
        
        Args:
            subtask: Subtask data including command to execute
            
        Returns:
            Execution result
        """
        command = subtask.get("command")
        if not command:
            raise ValueError("Subtask command is required")
        
        # Use asyncio to run the command
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            raise RuntimeError(f"Command failed with exit code {proc.returncode}: {stderr.decode()}")
        
        return {
            "output": stdout.decode(),
            "exitCode": proc.returncode
        }
    
    async def _update_subtask_status(
        self, 
        task_id: str, 
        subtask_id: str, 
        status: TaskStatus, 
        output: Optional[str] = None, 
        error: Optional[str] = None
    ) -> None:
        """
        Update the status of a subtask.
        
        Args:
            task_id: ID of the parent task
            subtask_id: ID of the subtask
            status: New status
            output: Optional output
            error: Optional error message
        """
        if task_id not in self.active_tasks:
            logger.warning(f"Task {task_id} not found in active tasks")
            return
        
        # Find the subtask
        for subtask in self.active_tasks[task_id]["subtasks"]:
            if subtask["id"] == subtask_id:
                subtask["status"] = status
                if output is not None:
                    subtask["output"] = output
                if error is not None:
                    subtask["error"] = error
                break
        
        # Save updated status
        await self._save_task_status(task_id, self.active_tasks[task_id])
    
    async def _save_task_status(self, task_id: str, status: Dict[str, Any]) -> None:
        """
        Save task status to disk.
        
        Args:
            task_id: ID of the task
            status: Task status data
        """
        status_file = self.storage_dir / f"{task_id}.json"
        
        # Use executor to avoid blocking the event loop
        loop = asyncio.get_running_loop()
        
        def write_file():
            with open(status_file, 'w') as f:
                json.dump(status, f, indent=2)
        
        await loop.run_in_executor(None, write_file)
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a task.
        
        Args:
            task_id: ID of the task
            
        Returns:
            Task status data if found, None otherwise
        """
        # First check active tasks
        if task_id in self.active_tasks:
            return self.active_tasks[task_id]
        
        # Then check saved tasks
        status_file = self.storage_dir / f"{task_id}.json"
        if status_file.exists():
            try:
                loop = asyncio.get_running_loop()
                
                def read_file():
                    with open(status_file, 'r') as f:
                        return json.load(f)
                
                return await loop.run_in_executor(None, read_file)
            except Exception as e:
                logger.error(f"Error reading task status: {e}")
        
        return None


# Validation function
def _validate_task_executor() -> bool:
    """Run validation checks for the task executor."""
    import sys
    
    # Track validation failures
    all_validation_failures = []
    total_tests = 0
    
    # Test 1: Basic initialization
    total_tests += 1
    try:
        executor = TaskExecutor(storage_dir=Path("./test_task_data"))
        assert executor.storage_dir.exists(), "Storage directory not created"
    except Exception as e:
        all_validation_failures.append(f"Initialization test failed: {str(e)}")
    
    # Test 2: Task execution mode enum values
    total_tests += 1
    try:
        assert ExecutionMode.SEQUENTIAL == "sequential", "Sequential mode value mismatch"
        assert ExecutionMode.PARALLEL == "parallel", "Parallel mode value mismatch"
    except Exception as e:
        all_validation_failures.append(f"Enum value test failed: {str(e)}")
    
    # Test 3: Task status enum values
    total_tests += 1
    try:
        assert TaskStatus.PENDING == "pending", "Pending status value mismatch"
        assert TaskStatus.RUNNING == "running", "Running status value mismatch"
        assert TaskStatus.COMPLETED == "completed", "Completed status value mismatch"
        assert TaskStatus.FAILED == "failed", "Failed status value mismatch"
    except Exception as e:
        all_validation_failures.append(f"Status enum test failed: {str(e)}")
    
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
    success = _validate_task_executor()
    import sys
    sys.exit(0 if success else 1)