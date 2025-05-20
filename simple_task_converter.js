#!/usr/bin/env node
/**
 * Simple task converter for Claude Code MCP
 * 
 * This script converts a simple task definition into a task that can be
 * executed by the Claude Code MCP server.
 */

// Sample task for testing
const task = {
  id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  title: 'Geography Questions Task',
  description: 'Answer geography questions using sequential execution mode',
  executionMode: 'sequential',
  subtasks: [
    { 
      id: 'france_capital', 
      title: 'Capital of France', 
      prompt: 'What is the capital of France?',
      expected_answer: 'Paris'
    },
    { 
      id: 'measure_time', 
      title: 'Measure Execution Time', 
      prompt: 'How long did it take to answer the previous question?',
      expected_answer: 'Includes time measurement'
    }
  ]
};

console.log(JSON.stringify([task], null, 2));