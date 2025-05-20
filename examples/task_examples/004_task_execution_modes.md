# Task Example: Simple Task Execution Modes

This example file contains simple, specific tasks that can be used to test the sequential and parallel execution modes of the Claude Code MCP server.

## Example Task Format

```json
{
  "id": "task-123",
  "name": "Example Task",
  "description": "This task demonstrates the execution modes feature",
  "executionMode": "sequential",
  "subtasks": [
    {
      "id": "subtask-1",
      "name": "First Subtask",
      "prompt": "What is the capital of France?",
      "type": "question"
    },
    {
      "id": "subtask-2",
      "name": "Second Subtask",
      "prompt": "Write a Python function that multiplies two numbers",
      "type": "code_generation"
    }
  ]
}
```

## Example 1: Sequential Task Execution

```json
{
  "id": "geography-questions",
  "name": "Geography Questions",
  "description": "A series of geography questions executed sequentially",
  "executionMode": "sequential",
  "subtasks": [
    {
      "id": "geo-1",
      "name": "Capital of France",
      "prompt": "What is the capital of France?",
      "type": "question"
    },
    {
      "id": "geo-2",
      "name": "Capital of Japan",
      "prompt": "What is the capital of Japan?",
      "type": "question"
    },
    {
      "id": "geo-3",
      "name": "Capital of Brazil",
      "prompt": "What is the capital of Brazil?",
      "type": "question"
    },
    {
      "id": "geo-4",
      "name": "Largest Country",
      "prompt": "What is the largest country by land area?",
      "type": "question"
    },
    {
      "id": "geo-5",
      "name": "Smallest Country",
      "prompt": "What is the smallest country by land area?",
      "type": "question"
    }
  ]
}
```

Expected Behavior:
- Tasks will execute one after another in the order specified
- Each task must complete before the next one starts
- If a task fails, subsequent tasks will still execute

## Example 2: Parallel Task Execution

```json
{
  "id": "code-generation-tasks",
  "name": "Code Generation Tasks",
  "description": "A series of code generation tasks executed in parallel",
  "executionMode": "parallel",
  "subtasks": [
    {
      "id": "code-1",
      "name": "Multiply Function",
      "prompt": "Write a Python function that multiplies two numbers",
      "type": "code_generation"
    },
    {
      "id": "code-2",
      "name": "Sort Array",
      "prompt": "Write a JavaScript function that sorts an array of numbers",
      "type": "code_generation"
    },
    {
      "id": "code-3",
      "name": "Fibonacci Function",
      "prompt": "Write a Go function that generates the first n Fibonacci numbers",
      "type": "code_generation"
    },
    {
      "id": "code-4",
      "name": "Reverse String",
      "prompt": "Write a Rust function that reverses a string",
      "type": "code_generation"
    },
    {
      "id": "code-5",
      "name": "Find Duplicates",
      "prompt": "Write a SQL query to find duplicate records in a table",
      "type": "code_generation"
    }
  ]
}
```

Expected Behavior:
- All tasks will start execution simultaneously
- Tasks will complete independently of each other
- The total execution time should be approximately equal to the longest task
- Results will be collected as tasks complete

## Example 3: Mixed Task Types

```json
{
  "id": "mixed-content-tasks",
  "name": "Mixed Content Tasks",
  "description": "Different types of tasks executed in parallel",
  "executionMode": "parallel",
  "subtasks": [
    {
      "id": "task-1",
      "name": "Common Apple Color",
      "prompt": "What is the most common color of an apple?",
      "type": "question"
    },
    {
      "id": "task-2",
      "name": "Sum Function",
      "prompt": "Write a Python function that calculates the sum of all numbers in a list",
      "type": "code_generation"
    },
    {
      "id": "task-3",
      "name": "Project Files",
      "prompt": "List all TypeScript files in the src directory",
      "type": "file_operation"
    },
    {
      "id": "task-4",
      "name": "API Documentation",
      "prompt": "Generate API documentation for the task execution endpoints",
      "type": "documentation"
    },
    {
      "id": "task-5",
      "name": "Temperature Conversion",
      "prompt": "Create a function to convert Celsius to Fahrenheit",
      "type": "code_generation"
    }
  ]
}
```

Expected Behavior:
- All tasks will execute concurrently despite different types
- Resource usage will be higher than sequential execution
- Results will be returned as they become available

## Example 4: Sequential Dependency Chain

```json
{
  "id": "dependent-tasks",
  "name": "Dependent Tasks",
  "description": "Tasks that depend on results from previous tasks",
  "executionMode": "sequential",
  "subtasks": [
    {
      "id": "step-1",
      "name": "Generate Random Numbers",
      "prompt": "Generate a list of 10 random integers between 1 and 100",
      "type": "data_generation"
    },
    {
      "id": "step-2",
      "name": "Calculate Average",
      "prompt": "Calculate the average of the numbers generated in step-1",
      "type": "calculation",
      "dependsOn": ["step-1"]
    },
    {
      "id": "step-3",
      "name": "Find Numbers Above Average",
      "prompt": "Find all numbers from step-1 that are above the average calculated in step-2",
      "type": "calculation",
      "dependsOn": ["step-1", "step-2"]
    },
    {
      "id": "step-4",
      "name": "Generate Report",
      "prompt": "Create a report showing the original numbers, average, and numbers above average",
      "type": "report_generation",
      "dependsOn": ["step-1", "step-2", "step-3"]
    },
    {
      "id": "step-5",
      "name": "Store Results",
      "prompt": "Save the report to a JSON file",
      "type": "file_operation",
      "dependsOn": ["step-4"]
    }
  ]
}
```

Expected Behavior:
- Tasks execute in order due to dependencies
- Each task must wait for required dependencies to complete
- If a dependency fails, dependent tasks will not execute
- Results from earlier tasks are available to later tasks

## Example 5: Simple Tasks with Timeouts

```json
{
  "id": "timeout-tasks",
  "name": "Tasks with Timeouts",
  "description": "Tasks with different timeout settings",
  "executionMode": "parallel",
  "subtasks": [
    {
      "id": "quick-1",
      "name": "Quick Task 1",
      "prompt": "What is 2 + 2?",
      "type": "question",
      "timeout": 5000
    },
    {
      "id": "quick-2",
      "name": "Quick Task 2",
      "prompt": "What is the name of the current US President?",
      "type": "question",
      "timeout": 5000
    },
    {
      "id": "medium-1",
      "name": "Medium Task",
      "prompt": "Summarize the plot of Hamlet in 3 sentences",
      "type": "summarization",
      "timeout": 15000
    },
    {
      "id": "long-1",
      "name": "Long Task",
      "prompt": "Generate a 500-word essay about artificial intelligence",
      "type": "content_generation",
      "timeout": 30000
    },
    {
      "id": "very-long",
      "name": "Very Long Task",
      "prompt": "Analyze the performance implications of different sorting algorithms for large datasets",
      "type": "analysis",
      "timeout": 60000
    }
  ]
}
```

Expected Behavior:
- Tasks will execute in parallel
- Tasks that exceed their timeout will be terminated
- Completed tasks will return results even if other tasks time out
- Timed-out tasks will be marked as failed with a timeout error