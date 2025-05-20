# Mixed Mode Task

**Objective**: Test the mixed execution mode with dependencies.

**Requirements**:
1. Generate random numbers
2. Process numbers in parallel
3. Create a final report

## Overview

This task tests the mixed execution mode where some subtasks run sequentially and others run in parallel, based on dependencies.

## Implementation Tasks

### Task 1: Generate Random Numbers (Sequential)

- Generate a list of 10 random integers between 1 and 100
- Execution mode: sequential

### Task 2: Calculate Sum (Parallel)

- Calculate the sum of the generated numbers
- Depends on: Task 1
- Execution mode: parallel

### Task 3: Calculate Average (Parallel)

- Calculate the average of the generated numbers
- Depends on: Task 1
- Execution mode: parallel

### Task 4: Find Maximum (Parallel)

- Find the maximum value in the list
- Depends on: Task 1
- Execution mode: parallel

### Task 5: Create Report (Sequential)

- Create a report with all the results
- Depends on: Task 2, Task 3, Task 4
- Execution mode: sequential