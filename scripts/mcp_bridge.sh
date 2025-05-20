#!/bin/bash
# Simple shell-based MCP bridge for Task Orchestration

# Project paths
PROJECT_ROOT="/home/graham/workspace/experiments/claude-code-mcp"
PYTHON_PATH="$PROJECT_ROOT/.venv/bin/python"
LOG_FILE="$PROJECT_ROOT/mcp_bridge.log"

# Log helper function
log() {
    echo "$(date -Iseconds) - $1" >> "$LOG_FILE"
}

# Initialize log
log "MCP bridge started"

# Function to handle list_tools requests
handle_list_tools() {
    local id="$1"
    log "Handling list_tools request with id $id"
    
    # Create a response with the available tools
    cat <<EOF
{"jsonrpc":"2.0","id":$id,"result":{"tools":[
  {
    "name":"convert_task",
    "description":"Convert a markdown task to JSON",
    "input_schema":{
      "type":"object",
      "properties":{
        "markdownPath":{"type":"string","description":"Path to the markdown task file"},
        "outputPath":{"type":"string","description":"Path to save the output JSON"}
      },
      "required":["markdownPath"]
    }
  },
  {
    "name":"execute_task",
    "description":"Execute a task with the orchestration system",
    "input_schema":{
      "type":"object",
      "properties":{
        "taskId":{"type":"string","description":"ID of the task to execute"}
      },
      "required":["taskId"]
    }
  },
  {
    "name":"task_status",
    "description":"Check the status of a task",
    "input_schema":{
      "type":"object",
      "properties":{
        "taskId":{"type":"string","description":"ID of the task to check"}
      },
      "required":["taskId"]
    }
  }
]}}
EOF
}

# Function to handle call_tool requests
handle_call_tool() {
    local id="$1"
    local name="$2"
    local input="$3"
    
    log "Handling call_tool request with id $id, tool $name, input $input"
    
    # Extract parameters
    if [ "$name" = "convert_task" ]; then
        # Extract markdownPath and outputPath
        markdown_path=$(echo "$input" | grep -o '"markdownPath"[^,}]*' | cut -d '"' -f 4)
        output_path=$(echo "$input" | grep -o '"outputPath"[^,}]*' | cut -d '"' -f 4 || echo "")
        
        log "markdownPath=$markdown_path, outputPath=$output_path"
        
        # Build the command
        cmd="cd $PROJECT_ROOT && $PYTHON_PATH -m claude_code_mcp.cli convert-task-markdown \"$markdown_path\""
        if [ -n "$output_path" ]; then
            cmd="$cmd --output-path \"$output_path\""
        fi
        
        log "Executing: $cmd"
        
        # Execute the command
        output=$(eval "$cmd" 2>&1) || {
            error_msg="Error executing command: $output"
            log "$error_msg"
            echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"error\":{\"code\":-32603,\"message\":\"$error_msg\"}}"
            return
        }
        
        log "Command output: $output"
        
        # Return success response
        escaped_output=$(echo "$output" | sed 's/"/\\"/g')
        echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"result\":{\"status\":\"success\",\"output\":\"$escaped_output\"}}"
        
    elif [ "$name" = "execute_task" ]; then
        # Extract taskId
        task_id=$(echo "$input" | grep -o '"taskId"[^,}]*' | cut -d '"' -f 4)
        
        log "taskId=$task_id"
        
        # Build the command
        cmd="cd $PROJECT_ROOT && $PYTHON_PATH -m claude_code_mcp.cli execute-task \"$task_id\""
        
        log "Executing: $cmd"
        
        # Execute the command
        output=$(eval "$cmd" 2>&1) || {
            error_msg="Error executing command: $output"
            log "$error_msg"
            echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"error\":{\"code\":-32603,\"message\":\"$error_msg\"}}"
            return
        }
        
        log "Command output: $output"
        
        # Return success response
        escaped_output=$(echo "$output" | sed 's/"/\\"/g')
        echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"result\":{\"status\":\"success\",\"output\":\"$escaped_output\"}}"
        
    elif [ "$name" = "task_status" ]; then
        # Extract taskId
        task_id=$(echo "$input" | grep -o '"taskId"[^,}]*' | cut -d '"' -f 4)
        
        log "taskId=$task_id"
        
        # Build the command
        cmd="cd $PROJECT_ROOT && $PYTHON_PATH -m claude_code_mcp.cli task-status \"$task_id\""
        
        log "Executing: $cmd"
        
        # Execute the command
        output=$(eval "$cmd" 2>&1) || {
            error_msg="Error executing command: $output"
            log "$error_msg"
            echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"error\":{\"code\":-32603,\"message\":\"$error_msg\"}}"
            return
        }
        
        log "Command output: $output"
        
        # Return success response
        escaped_output=$(echo "$output" | sed 's/"/\\"/g')
        echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"result\":{\"status\":\"success\",\"output\":\"$escaped_output\"}}"
        
    else
        # Unknown tool
        error_msg="Unknown tool: $name"
        log "$error_msg"
        echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"error\":{\"code\":-32601,\"message\":\"$error_msg\"}}"
    fi
}

# Main processing loop
while read -r line; do
    log "Received request: $line"
    
    # Extract method and id
    method=$(echo "$line" | grep -o '"method":"[^"]*"' | cut -d '"' -f 4)
    id=$(echo "$line" | grep -o '"id":[^,}]*' | cut -d ':' -f 2)
    
    log "Method: $method, ID: $id"
    
    if [ "$method" = "list_tools" ]; then
        # Handle list_tools request
        handle_list_tools "$id"
    elif [ "$method" = "call_tool" ]; then
        # Extract tool name and input
        name=$(echo "$line" | grep -o '"name":"[^"]*"' | cut -d '"' -f 4)
        input=$(echo "$line" | grep -o '"input":{[^}]*}' | cut -d '{' -f 2 | sed 's/}$//')
        input="{$input}"
        
        # Handle call_tool request
        handle_call_tool "$id" "$name" "$input"
    else
        # Unknown method
        log "Unknown method: $method"
        echo "{\"jsonrpc\":\"2.0\",\"id\":$id,\"error\":{\"code\":-32601,\"message\":\"Method not found: $method\"}}"
    fi
done