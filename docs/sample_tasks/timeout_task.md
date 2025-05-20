# Task with Timeouts

**Objective**: Test the timeout handling capability.

**Requirements**:
1. Handle quick tasks
2. Handle long tasks with timeouts
3. Verify timeout behavior

## Overview

This task tests the system's ability to handle task timeouts properly. It includes tasks with different timeout settings.

## Implementation Tasks

### Task 1: Quick Task (5-second timeout)

- Answer "What is 2 + 2?"
- Timeout: 5000ms
- Execution mode: sequential

### Task 2: Medium Task (15-second timeout)

- Summarize Hamlet in 3 sentences
- Timeout: 15000ms
- Execution mode: sequential

### Task 3: Long Task (1-second timeout, should fail)

- Generate a 10,000-word essay about artificial intelligence
- Timeout: 1000ms
- Execution mode: parallel

### Task 4: Another Quick Task

- Answer "What is the largest planet in our solar system?"
- Timeout: 5000ms
- Execution mode: sequential

### Task 5: Verify Timeout Handling

- Check if timed-out tasks are properly marked as failed
- Execution mode: sequential