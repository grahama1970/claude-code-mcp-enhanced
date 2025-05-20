# Test Task: Execution Modes

## Summary
A simple test task to demonstrate sequential and parallel execution modes.

## Description
This task tests the ability to execute subtasks in different modes (sequential or parallel).

## Subtasks

### Subtask 1: Hello World
```bash
echo "Hello from Subtask 1 - Starting at $(date +%H:%M:%S)"
sleep 3
echo "Subtask 1 complete at $(date +%H:%M:%S)"
```

### Subtask 2: List Current Directory
```bash
echo "Starting Subtask 2 at $(date +%H:%M:%S)"
echo "Files in current directory:"
ls -la /home/graham/workspace/experiments/claude-code-mcp
sleep 2
echo "Subtask 2 complete at $(date +%H:%M:%S)"
```

### Subtask 3: System Information
```bash
echo "Starting Subtask 3 at $(date +%H:%M:%S)"
echo "System Information:"
echo "Hostname: $(hostname)"
echo "Current date: $(date)"
echo "Uptime: $(uptime)"
sleep 3
echo "Subtask 3 complete at $(date +%H:%M:%S)"
```