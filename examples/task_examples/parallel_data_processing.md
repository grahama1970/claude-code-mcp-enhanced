# Task: Parallel Data Processing ⏳ Not Started

**Objective**: Process multiple data files in parallel to demonstrate performance benefits of parallel execution.

**Requirements**:
1. Generate sample data files
2. Process each file independently
3. Aggregate results
4. Compare sequential vs parallel performance

## Overview

This task demonstrates the performance benefits of parallel execution for independent data processing tasks.
It creates multiple sample data files, processes them independently, and then aggregates the results.

## Implementation Tasks

### Task 1: Generate Sample Data ⏳ Not Started

**Priority**: HIGH | **Complexity**: LOW | **Impact**: HIGH

**Implementation Steps**:
- [ ] 1.1 Create data directory
  - Create `/tmp/data_processing` directory
  - Set appropriate permissions

- [ ] 1.2 Generate sample data files
  - Create 5 data files with random numbers
  - Each file should have 1000 numbers
  - Files should be named `data1.txt`, `data2.txt`, etc.

- [ ] 1.3 Verify data creation
  - Check that all files exist
  - Verify that each file has 1000 numbers

### Task 2: Process Data Files ⏳ Not Started

**Priority**: HIGH | **Complexity**: MEDIUM | **Impact**: HIGH

**Implementation Steps**:
- [ ] 2.1 Create processing script
  - Create a Python script to calculate statistics
  - Script should calculate min, max, mean, median
  - Add artificial delay (sleep) to simulate processing time

- [ ] 2.2 Process each file
  - Run the script on each data file
  - Save results to individual output files
  - Record processing time for each file

### Task 3: Aggregate Results ⏳ Not Started

**Priority**: MEDIUM | **Complexity**: MEDIUM | **Impact**: HIGH

**Implementation Steps**:
- [ ] 3.1 Create aggregation script
  - Create a Python script to combine results
  - Calculate overall statistics across all files

- [ ] 3.2 Generate final report
  - Combine all statistics
  - Format as a nice report
  - Include total processing time

### Task 4: Performance Comparison ⏳ Not Started

**Priority**: MEDIUM | **Complexity**: LOW | **Impact**: HIGH

**Implementation Steps**:
- [ ] 4.1 Run in sequential mode
  - Execute the entire workflow sequentially
  - Record total processing time

- [ ] 4.2 Run in parallel mode
  - Execute the same workflow in parallel
  - Record total processing time

- [ ] 4.3 Create comparison report
  - Compare sequential vs parallel performance
  - Calculate speedup factor
  - Generate visualization of the comparison

## Usage

This task can be executed with different execution modes to demonstrate performance differences:

```bash
# Sequential execution
python -m claude_code_mcp.cli execute-task data-processing --execution-mode sequential

# Parallel execution
python -m claude_code_mcp.cli execute-task data-processing --execution-mode parallel
```

## Expected Output

```
=== Performance Comparison ===

Sequential Execution:
- Total time: 15.23 seconds
- Processed 5 files
- Average time per file: 3.05 seconds

Parallel Execution:
- Total time: 3.21 seconds
- Processed 5 files
- Average time per file: 3.05 seconds

Speed Improvement: 4.74x faster with parallel execution
```