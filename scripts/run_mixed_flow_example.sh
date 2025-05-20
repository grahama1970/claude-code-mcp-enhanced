#!/bin/bash
#
# Example script to demonstrate mixed sequential/parallel task execution flow
#

# Set up variables
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXAMPLE_DIR="$PROJECT_ROOT/examples/task_examples"
OUTPUT_DIR="$PROJECT_ROOT/tmp"

# Create temp directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Convert the task to JSON
echo "Converting mixed execution flow task to JSON..."
"$PROJECT_ROOT/node_modules/.bin/ts-node" "$PROJECT_ROOT/src/server.ts" convert-task-markdown \
  --markdown-path="$EXAMPLE_DIR/mixed_execution_flow.md" \
  --output-path="$OUTPUT_DIR/mixed_flow_task.json"

# Execute the task with dependency-based execution
echo "Executing task with mixed execution flow..."
"$PROJECT_ROOT/node_modules/.bin/ts-node" "$PROJECT_ROOT/src/server.ts" execute-task \
  --task-id="mixed-flow" \
  --task-path="$OUTPUT_DIR/mixed_flow_task.json"

# Check task status
echo "Checking task status..."
"$PROJECT_ROOT/node_modules/.bin/ts-node" "$PROJECT_ROOT/src/server.ts" task-status \
  --task-id="mixed-flow"

echo "Done! Check $OUTPUT_DIR for results."