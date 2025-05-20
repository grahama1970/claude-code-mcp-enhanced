"""
MCP Integration for Claude Code task orchestration system.

This module provides functionality for integrating the task orchestration system with the
Model Context Protocol (MCP) server, enabling task conversion and execution through MCP.
Supports both sequential and parallel execution modes for tasks.

Documentation:
- MCP Protocol: https://github.com/google-deepmind/model-context-protocol
- Claude Code MCP: https://github.com/grahama1970/claude-code-mcp-enhanced

Sample Input:
  ToolUse request for task conversion or execution with mode specification:
  {
    "subtasks": [...],
    "executionMode": "parallel"
  }

Expected Output:
  JSON response with task data or execution results
"""

import json
import sys
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

from loguru import logger
from pydantic import BaseModel, Field

from claude_code_mcp.task_converter import convert_task
from claude_code_mcp.task_executor import TaskExecutor, ExecutionMode


class TaskConversionRequest(BaseModel):
    """Request model for task conversion MCP endpoint."""
    markdownPath: str = Field(..., description="Path to the markdown task file to convert.")
    outputPath: Optional[str] = Field(None, description="Optional path where to save the JSON output. If not provided, returns the JSON directly.")


class TaskConversionResponse(BaseModel):
    """Response model for task conversion MCP endpoint."""
    task: Dict[str, Any] = Field(..., description="The converted task in JSON format.")
    outputPath: Optional[str] = Field(None, description="Path where the JSON was saved, if requested.")


def handle_convert_task_markdown(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a task conversion request from the MCP server.
    
    Args:
        request: Dictionary containing the request parameters
        
    Returns:
        Dictionary containing the response data
    """
    try:
        # Log the request for debugging
        logger.debug(f"Received convert_task_markdown request: {request}")
        
        # Extract parameters - be flexible as MCP requests might have different formats
        markdown_path = request.get("markdownPath", None)
        output_path = request.get("outputPath", None)
        
        if not markdown_path:
            # Try different parameter formats that might come from JS side
            markdown_path = request.get("markdown_path", None)
            if not markdown_path:
                raise ValueError("markdownPath parameter is required")
        
        # Convert the task
        task_data = convert_task(markdown_path, output_path)
        
        # Return a simplified response to make integration easier
        response = {
            "task": task_data,
            "outputPath": output_path,
            "status": "success"
        }
        
        return response
    except Exception as e:
        logger.error(f"Error converting task: {e}")
        return {
            "error": str(e),
            "status": "error"
        }


class HealthCheckResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str = "healthy"
    version: str = "1.13.0"
    endpoints: List[str] = ["health", "convert_task_markdown", "claude_code", "execute_task", "task_status"]


def handle_health_check() -> Dict[str, Any]:
    """
    Handle a health check request from the MCP server.
    
    Returns:
        Dictionary containing the health check response data
    """
    response = HealthCheckResponse(
        endpoints=["health", "convert_task_markdown", "claude_code", "execute_task", "task_status"]
    )
    return response.dict()


class ClaudeCodeRequest(BaseModel):
    """Request model for claude_code MCP endpoint."""
    prompt: str = Field(..., description="The detailed natural language prompt for Claude to execute.")
    workFolder: Optional[str] = Field(None, description="The working directory for the Claude CLI execution.")
    taskDescription: Optional[str] = Field(None, description="Short description of the task.")
    parentTaskId: Optional[str] = Field(None, description="Optional ID of the parent task for orchestration.")
    returnMode: Optional[str] = Field("full", description="How results should be returned: summary or full.")


class ClaudeCodeResponse(BaseModel):
    """Response model for claude_code MCP endpoint."""
    result: str = Field(..., description="The result of the Claude Code execution.")
    taskId: Optional[str] = Field(None, description="ID of the task that was executed.")
    parentTaskId: Optional[str] = Field(None, description="ID of the parent task, if this was a subtask.")


class TaskExecutionRequest(BaseModel):
    """Request model for task execution MCP endpoint."""
    id: Optional[str] = Field(None, description="Optional ID for the task. If not provided, one will be generated.")
    subtasks: List[Dict[str, Any]] = Field(..., description="List of subtasks to execute.")
    executionMode: Optional[str] = Field(ExecutionMode.SEQUENTIAL, description="Execution mode: 'sequential' or 'parallel'.")


def handle_claude_code(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a claude_code request from the MCP server.
    
    This is a placeholder for the actual implementation, which would forward
    the request to Claude Code CLI or execute the task directly.
    
    Args:
        request: Dictionary containing the request parameters
        
    Returns:
        Dictionary containing the response data
    """
    try:
        # Validate request with Pydantic model
        validated_request = ClaudeCodeRequest(**request)
        
        # TODO: Implement actual Claude Code integration
        # For now, this is just a mock response
        
        logger.info(f"Received Claude Code request: {validated_request.taskDescription}")
        
        return {
            "result": f"Executed: {validated_request.taskDescription or validated_request.prompt[:30]}...",
            "taskId": "mock-task-id-123",
            "parentTaskId": validated_request.parentTaskId
        }
    except Exception as e:
        logger.error(f"Error executing Claude Code task: {e}")
        return {
            "error": str(e),
            "status": "error"
        }


def handle_task_execution(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a task execution request from the MCP server.
    
    Args:
        request: Dictionary containing the request parameters
        
    Returns:
        Dictionary containing the response data
    """
    try:
        # Log the request for debugging
        logger.debug(f"Received task_execution request: {request}")
        
        # Validate request with Pydantic model
        validated_request = TaskExecutionRequest(**request)
        
        # Create task executor
        executor = TaskExecutor()
        
        # Start task execution
        task_id = validated_request.id or f"task-{hash(str(validated_request.subtasks))}" 
        
        # Convert to dict for executor
        task_data = {
            "id": task_id,
            "subtasks": validated_request.subtasks,
            "executionMode": validated_request.executionMode
        }
        
        # Execute the task (use a wrapper to run the async function)
        def run_async(task_data):
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(executor.execute_task(task_data))
            finally:
                loop.close()
        
        # Start execution in a separate thread to avoid blocking
        import threading
        thread = threading.Thread(target=lambda: run_async(task_data))
        thread.start()
        
        return {
            "success": True,
            "message": f"Task execution started in {validated_request.executionMode} mode",
            "taskId": task_id
        }
    except Exception as e:
        logger.error(f"Error executing task: {e}")
        return {
            "error": str(e),
            "status": "error"
        }


def handle_task_status(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a task status request from the MCP server.
    
    Args:
        request: Dictionary containing the request parameters
        
    Returns:
        Dictionary containing the response data
    """
    try:
        # Log the request for debugging
        logger.debug(f"Received task_status request: {request}")
        
        # Extract task ID
        task_id = request.get("taskId")
        if not task_id:
            raise ValueError("taskId parameter is required")
        
        # Create task executor
        executor = TaskExecutor()
        
        # Get task status (use a wrapper to run the async function)
        def run_async(task_id):
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(executor.get_task_status(task_id))
            finally:
                loop.close()
        
        # Get status
        status = run_async(task_id)
        
        if status is None:
            return {
                "success": False,
                "error": f"Task {task_id} not found"
            }
        
        return {
            "success": True,
            "status": status
        }
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        return {
            "error": str(e),
            "status": "error"
        }


def register_mcp_endpoints() -> Dict[str, Any]:
    """
    Register MCP endpoints for the task orchestration system.
    
    Returns:
        Dictionary containing the endpoint configuration
    """
    return {
        "health": handle_health_check,
        "convert_task_markdown": handle_convert_task_markdown,
        "claude_code": handle_claude_code,
        "execute_task": handle_task_execution,
        "task_status": handle_task_status
    }


if __name__ == "__main__":
    import sys
    
    # Track validation failures
    all_validation_failures = []
    total_tests = 0
    
    # Test health check endpoint
    total_tests += 1
    try:
        health_response = handle_health_check()
        assert health_response["status"] == "healthy", "Health check response missing status"
        assert "version" in health_response, "Health check response missing version"
        assert "endpoints" in health_response, "Health check response missing endpoints"
    except Exception as e:
        all_validation_failures.append(f"Health check endpoint test failed: {str(e)}")
    
    # Test conversion request validation
    total_tests += 1
    try:
        # Test with invalid request (missing required field)
        try:
            task_request = {"outputPath": "output.json"}  # Missing markdownPath
            handle_convert_task_markdown(task_request)
            all_validation_failures.append("Conversion request validation failed: Missing field not detected")
        except Exception:
            # This is expected - test passes
            pass
    except Exception as e:
        all_validation_failures.append(f"Conversion request validation test failed: {str(e)}")
    
    # Test task execution request validation
    total_tests += 1
    try:
        # Test with valid request
        valid_request = {
            "subtasks": [{
                "id": "test-subtask",
                "command": "echo 'Hello World'"
            }],
            "executionMode": "sequential"
        }
        validated = TaskExecutionRequest(**valid_request)
        assert validated.executionMode == ExecutionMode.SEQUENTIAL, "Execution mode not set correctly"
        
        # Test with invalid request (missing required field)
        try:
            invalid_request = {"executionMode": "parallel"}  # Missing subtasks
            TaskExecutionRequest(**invalid_request)
            all_validation_failures.append("Task execution request validation failed: Missing field not detected")
        except Exception:
            # This is expected - test passes
            pass
    except Exception as e:
        all_validation_failures.append(f"Task execution request validation test failed: {str(e)}")
    
    # Test endpoint registration
    total_tests += 1
    try:
        endpoints = register_mcp_endpoints()
        assert "health" in endpoints, "Health endpoint not registered"
        assert "convert_task_markdown" in endpoints, "Convert task endpoint not registered"
        assert "claude_code" in endpoints, "Claude code endpoint not registered"
        assert "execute_task" in endpoints, "Execute task endpoint not registered"
        assert "task_status" in endpoints, "Task status endpoint not registered"
    except Exception as e:
        all_validation_failures.append(f"Endpoint registration test failed: {str(e)}")
    
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