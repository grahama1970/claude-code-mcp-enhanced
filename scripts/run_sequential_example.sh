#!/bin/bash
#
# Example script to demonstrate sequential task execution
#

# Set up variables
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXAMPLE_DIR="$PROJECT_ROOT/examples/task_examples"
OUTPUT_DIR="$PROJECT_ROOT/tmp"

# Create temp directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Convert the task to JSON
echo "Converting hello world task to JSON..."
"$PROJECT_ROOT/node_modules/.bin/ts-node" "$PROJECT_ROOT/src/server.ts" convert-task-markdown \
  --markdown-path="$EXAMPLE_DIR/simple_hello_world.md" \
  --output-path="$OUTPUT_DIR/hello_world_task.json"

# Execute the task in sequential mode
echo "Executing task in sequential mode..."
"$PROJECT_ROOT/node_modules/.bin/ts-node" "$PROJECT_ROOT/src/server.ts" execute-task \
  --task-id="hello-world" \
  --task-path="$OUTPUT_DIR/hello_world_task.json" \
  --execution-mode="sequential"

# Check task status
echo "Checking task status..."
"$PROJECT_ROOT/node_modules/.bin/ts-node" "$PROJECT_ROOT/src/server.ts" task-status \
  --task-id="hello-world"

echo "Done! Check $OUTPUT_DIR for results."