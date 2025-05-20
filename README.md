# Claude Code MCP

[![MCP Server Badge](https://img.shields.io/badge/MCP%20Server-Enhanced-brightgreen)](https://github.com/grahama1970/claude-code-mcp-enhanced)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server for Claude Code that adds task orchestration, advanced execution modes, and extended functionality.

<p align="center">
  <img src="assets/claude_code_multistep_example.png" alt="Claude Code MCP Example" width="700"/>
</p>

## 📋 Features

- **MCP Server Integration**: Connects Claude Code CLI with other tools via the Model Context Protocol
- **Task Orchestration**: Break down complex tasks into manageable subtasks with dependencies
- **Execution Modes**: Run tasks sequentially or in parallel for better performance
- **Markdown Task Format**: Define tasks using familiar Markdown syntax
- **Task Amender**: Automatically transform task descriptions to conform to the template guide
- **Status Monitoring**: Track task execution status and progress
- **Extensible Design**: Easy to add new capabilities via the MCP protocol

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- Python 3.10+
- Claude Code CLI

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/grahama1970/claude-code-mcp-enhanced.git
   cd claude-code-mcp-enhanced
   ```

2. **Install dependencies**

   ```bash
   # Install Node.js dependencies
   npm install
   
   # Install Python dependencies
   pip install -e .
   # Or install from requirements.txt for CLI tools only
   pip install -r requirements.txt
   ```

3. **Start the MCP server**

   ```bash
   npm start
   ```

   Alternatively, you can use the provided start scripts:

   ```bash
   # On Linux/macOS
   ./start.sh

   # On Windows
   start.bat
   ```

## 🔧 Usage

### Basic Usage

1. **Create a task file in Markdown format**

   ```markdown
   # Task 001: Hello World Task

   **Objective**: Create a simple Hello World application.

   ## Implementation Tasks

   ### Task 1: Create the main file

   - Create a file named hello.py
   - Add code to print "Hello, World!"

   ### Task 2: Run the application

   - Execute the hello.py file
   - Verify the output shows "Hello, World!"
   ```

2. **Amend the task to ensure it conforms to the template**

   ```bash
   python amend_task.py /path/to/your/task.md -o /path/to/amended_task.md
   ```

3. **Convert the task to JSON format**

   ```bash
   python scripts/task_to_json.py /path/to/amended_task.md -o /path/to/output.json
   ```

   Or combine amendment and conversion in one step:

   ```bash
   python scripts/task_to_json.py /path/to/your/task.md -o /path/to/output.json
   ```

4. **Execute the task**

   ```bash
   curl -X POST "http://localhost:3000/api/execute-task" \
     -H "Content-Type: application/json" \
     -d '{"taskId": "task-001", "taskPath": "/path/to/output.json", "executionMode": "sequential"}'
   ```

5. **Check task status**

   ```bash
   curl "http://localhost:3000/api/task-status?taskId=task-001"
   ```

### Task Amender

The Task Amender ensures that all task descriptions conform to the required template structure:

```bash
# Amend a task file (overwrites the original)
python scripts/amend_task.py input.md

# Amend a task file and save to a new location
python scripts/amend_task.py input.md -o output.md

# Just check if a task file conforms to the template
python scripts/amend_task.py input.md --check
```

For more details on using the Task Amender, see [docs/task_amender_guide.md](docs/task_amender_guide.md).

### Execution Modes

You can execute tasks in two modes:

- **Sequential Mode** (default): Executes subtasks one after another
  ```json
  {"taskId": "task-001", "executionMode": "sequential"}
  ```

- **Parallel Mode**: Executes independent subtasks concurrently
  ```json
  {"taskId": "task-001", "executionMode": "parallel"}
  ```

## 📚 Documentation

- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [docs/task_amender_guide.md](docs/task_amender_guide.md) - Task Amender documentation
- [docs/task_template_workflow.md](docs/task_template_workflow.md) - Task template workflow guide
- [docs/guides/claude-code-orchestrator.md](docs/guides/claude-code-orchestrator.md) - Using Claude Code as orchestrator
- [docs/tasks](docs/tasks) - Example task definitions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://www.anthropic.com/) for Claude Code
- [Model Context Protocol](https://github.com/google-deepmind/model-context-protocol) developers