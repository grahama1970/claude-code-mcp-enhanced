#!/bin/bash
#
# Example script to demonstrate parallel task execution
#

# Set up variables
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXAMPLE_DIR="$PROJECT_ROOT/examples/task_examples"
OUTPUT_DIR="$PROJECT_ROOT/tmp"

# Create temp directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Convert the task to JSON
echo "Converting parallel data processing task to JSON..."
"$PROJECT_ROOT/node_modules/.bin/ts-node" "$PROJECT_ROOT/src/server.ts" convert-task-markdown \
  --markdown-path="$EXAMPLE_DIR/parallel_data_processing.md" \
  --output-path="$OUTPUT_DIR/parallel_task.json"

# Execute the task in parallel mode
echo "Executing task in parallel mode..."
"$PROJECT_ROOT/node_modules/.bin/ts-node" "$PROJECT_ROOT/src/server.ts" execute-task \
  --task-id="parallel-data-processing" \
  --task-path="$OUTPUT_DIR/parallel_task.json" \
  --execution-mode="parallel"

# Check task status
echo "Checking task status..."
"$PROJECT_ROOT/node_modules/.bin/ts-node" "$PROJECT_ROOT/src/server.ts" task-status \
  --task-id="parallel-data-processing"

echo "Done! Check $OUTPUT_DIR for results."