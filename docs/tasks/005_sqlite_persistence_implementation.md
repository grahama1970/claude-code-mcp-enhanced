# Task 005: SQLite Persistence with FTS5 for Claude MCP ⏳ Not Started

**Objective**: Implement a robust SQLite-based persistence layer with FTS5 for Claude Code MCP to enable seamless communication between Claude instances, task orchestration, and human-readable progress reporting.

**Requirements**:
1. [ ] Replace file-based persistence with SQLite database using built-in sqlite3 module
2. [ ] Implement FTS5 tables for searchable task content and results
3. [ ] Create dual output formats: rich tables for humans and JSON for machines
4. [ ] Enable real-time progress updates from all Claude instances
5. [ ] Provide a migration path from existing file-based storage
6. [ ] Ensure thread-safety for concurrent Claude instance access
7. [ ] Add robust error handling and recovery mechanisms
8. [ ] Create comprehensive documentation and usage examples
9. [ ] Implement timeout detection and reporting for Claude instances
10. [ ] Add system prompt instructions for instances to report to SQLite
11. [ ] Create detailed logging schema with timestamps, duration, and metrics
12. [ ] Enable structured report generation with time-series analytics

## Overview

The current Claude Code MCP implementation uses a combination of in-memory structures and file-based persistence in /tmp, which works but has limitations for cross-instance communication and coordinated task management. This task implements a more robust SQLite-based persistence layer that enables all Claude instances to share a common data store while maintaining both human-readable and machine-readable outputs.

**IMPORTANT**: 
1. Each sub-task MUST include creation of a verification report in `/docs/reports/` with actual command outputs and performance results.
2. Task 5 (Final Verification) enforces MANDATORY iteration on ALL incomplete tasks. The agent MUST continue working until 100% completion is achieved - no partial completion is acceptable.

## Research Summary

SQLite with FTS5 provides an ideal solution for Claude Code MCP persistence due to its lightweight nature, zero-configuration setup, ACID compliance, and built-in full-text search capabilities. The standard library sqlite3 module with FTS5 extension enables BM25 ranking without external dependencies.

## MANDATORY Research Process

**CRITICAL REQUIREMENT**: For EACH task, the agent MUST:

1. **Use `perplexity_ask`** to research:
   - Current best practices (2024-2025)
   - Production implementation patterns  
   - Common pitfalls and solutions
   - Performance optimization techniques

2. **Use `WebSearch`** to find:
   - GitHub repositories with working code
   - Real production examples
   - Popular library implementations
   - Benchmark comparisons

3. **Document all findings** in task reports:
   - Links to source repositories
   - Code snippets that work
   - Performance characteristics
   - Integration patterns

4. **DO NOT proceed without research**:
   - No theoretical implementations
   - No guessing at patterns
   - Must have real code examples
   - Must verify current best practices

Example Research Queries:
```
perplexity_ask: "sqlite fts5 python implementation best practices 2024"
WebSearch: "site:github.com sqlite3 fts5 python examples"
perplexity_ask: "thread-safe sqlite3 python implementation patterns"
WebSearch: "site:github.com mcp task orchestration sqlite"
```

## Implementation Tasks (Ordered by Priority/Complexity)

### Task 1: SQLite Database Schema Design ⏳ Not Started

**Priority**: HIGH | **Complexity**: MEDIUM | **Impact**: HIGH

**Research Requirements**:
- [ ] Use `perplexity_ask` to research SQLite schema design best practices
- [ ] Use `WebSearch` to find production SQLite FTS5 implementations
- [ ] Research thread-safe SQLite patterns
- [ ] Find real-world task orchestration database examples
- [ ] Research SQLite performance optimization techniques

**Implementation Steps**:
- [ ] 1.1 Create database module structure
  - Create `/src/persistence/` directory
  - Create `__init__.ts` files
  - Create `database.ts` schema definition file
  - Create `migrations.ts` for schema versioning

- [ ] 1.2 Define core table schemas
  - Design `tasks` table with fields for ID, status, timestamps, etc.
  - Design `instances` table for Claude instance tracking
  - Design `task_logs` table for progress updates with timestamps and durations
  - Design `task_results` table for output storage
  - Design `instance_telemetry` table for timeout and performance tracking
  - Design `time_series_metrics` table for analytics and reporting
  - Include proper foreign key relationships and timestamp indexing

- [ ] 1.3 Implement FTS5 virtual tables
  - Create FTS5 table for searching task content
  - Add BM25 ranking for relevance scoring
  - Add indexes for common query patterns
  - Set up tokenizers and configuration
  - Configure for optimal search performance

- [ ] 1.4 Create database initialization module
  - Implement connection management
  - Create tables if not exist
  - Handle schema migrations
  - Implement connection pooling
  - Add proper error handling

- [ ] 1.5 Implement thread-safety mechanisms
  - Research and implement proper locking strategies
  - Add transaction management
  - Handle concurrent write operations
  - Implement connection timeouts
  - Add retry logic for busy databases

- [ ] 1.6 Create test utilities
  - Create in-memory test database
  - Implement fixture generation
  - Create schema validation tools
  - Add performance benchmarking utilities
  - Create sample data generators

- [ ] 1.7 Create verification report
  - Create `/docs/reports/005_task_1_schema_design.md`
  - Document schema decisions
  - Include schema creation SQL
  - Show example queries
  - Document performance findings

**Technical Specifications**:
- Database file location: configurable, default to `.claude/claude-mcp.db`
- FTS5 tokenizer: porter stemming for optimal text search
- Schema version tracking table for migrations
- Connection timeout: configurable, default 30s
- Maximum connections: configurable, default 10
- Transaction isolation level: SERIALIZABLE for data integrity
- Timestamp format: ISO 8601 with millisecond precision
- Timeout tracking: per instance, per task, with warning thresholds
- Metrics collection interval: configurable, default 5s
- Log rotation: configurable, default 30 days retention

**Verification Method**:
- Create test database
- Verify schema creation
- Run sample queries
- Test concurrent connections
- Measure query performance
- Compare with file-based approach

**CLI Testing Requirements** (MANDATORY FOR ALL TASKS):
- [ ] Execute actual database operations from CLI
  - Create database file
  - Initialize schema
  - Run test queries
  - Verify thread safety
  - Document exact commands used
- [ ] Test database integrity
  - Validate foreign key constraints
  - Test transaction rollback
  - Test concurrent access
  - Verify data consistency
- [ ] Document all tests in report
  - Include exact commands executed
  - Show actual output received
  - Note any error messages
  - Verify against expected behavior

**Acceptance Criteria**:
- Schema correctly creates all tables
- FTS5 virtual tables work with BM25
- Thread-safety mechanisms validated
- Performance meets targets
- Migration mechanism works
- Documentation complete

### Task 2: Persistence Layer Implementation ⏳ Not Started

**Priority**: HIGH | **Complexity**: HIGH | **Impact**: HIGH

**Research Requirements**:
- [ ] Use `perplexity_ask` to research TypeScript SQLite3 patterns
- [ ] Use `WebSearch` to find production NodeJS SQLite implementations
- [ ] Research repository pattern implementations
- [ ] Investigate error handling best practices
- [ ] Find real-world task status tracking implementations
- [ ] Research timeout detection and reporting patterns
- [ ] Investigate time-series data storage for performance metrics

**Implementation Steps**:
- [ ] 2.1 Create repository classes
  - Create `TaskRepository` class
  - Create `InstanceRepository` class
  - Create `LogRepository` class
  - Create `ResultRepository` class
  - Create `TelemetryRepository` class for instance metrics
  - Create `TimeSeriesRepository` class for performance data
  - Implement base Repository interface with timestamp handling

- [ ] 2.2 Implement CRUD operations
  - Add create operations
  - Add read operations with queries
  - Add update operations
  - Add delete operations
  - Add transaction support

- [ ] 2.3 Implement FTS5 search methods
  - Add text search methods
  - Implement BM25 ranking
  - Create search result pagination
  - Add filters for search refinement
  - Implement search result highlighting

- [ ] 2.4 Create data access layer
  - Implement service interfaces
  - Create DTO objects
  - Add validation logic
  - Implement mapping functions
  - Add error handling

- [ ] 2.5 Implement migration from file-based storage
  - Detect existing file-based data
  - Create migration utilities
  - Implement data conversion
  - Add validation checks
  - Preserve existing task IDs

- [ ] 2.6 Add performance optimizations
  - Implement connection pooling
  - Add query caching
  - Optimize transactions
  - Add batch operations
  - Implement prepared statements

- [ ] 2.7 Create verification report
  - Create `/docs/reports/005_task_2_persistence_layer.md`
  - Document repository implementations
  - Include code samples
  - Show performance benchmarks
  - Document migration process

**Technical Specifications**:
- Connection pooling: min 2, max 10 connections
- Statement cache size: 100 statements
- Query timeout: configurable, default 10s
- Batch size: configurable, default 50 items
- Transaction retry: max 3 attempts, exponential backoff
- Instance timeout detection: heartbeat-based with configurable thresholds
- Time-series storage: 1-minute resolution for last 24 hours, 5-minute resolution for older data
- Metrics retention: hourly aggregates for 30 days, daily aggregates for 1 year
- Duration tracking: start/end timestamps plus calculated duration fields

**Verification Method**:
- Run CRUD operation tests
- Verify search functionality
- Test concurrent operations
- Measure operation performance
- Test migration utilities
- Verify data integrity

**CLI Testing Requirements** (MANDATORY FOR ALL TASKS):
- [ ] Execute actual repository operations
  - Create test tasks
  - Query tasks with filters
  - Update task status
  - Delete test data
  - Document exact steps
- [ ] Test end-to-end functionality
  - Start with CLI commands
  - Verify database persistence
  - Confirm queries return expected results
  - Test error scenarios
- [ ] Document all tests in report
  - Include exact operations executed
  - Show actual results
  - Include performance metrics
  - Compare with file-based approach

**Acceptance Criteria**:
- All CRUD operations work correctly
- Search functionality works with BM25 ranking
- Migration utilities successfully convert existing data
- Performance meets or exceeds file-based approach
- Thread-safety confirmed
- Documentation complete

### Task 3: Rich Output Formatting ⏳ Not Started

**Priority**: MEDIUM | **Complexity**: MEDIUM | **Impact**: HIGH

**Research Requirements**:
- [ ] Use `perplexity_ask` to research rich text formatting in Node.js
- [ ] Use `WebSearch` to find table formatting libraries
- [ ] Research JSON serialization best practices
- [ ] Find examples of dual-output formats
- [ ] Research accessibility and formatting standards

**Implementation Steps**:
- [ ] 3.1 Create formatting module
  - Create `/src/formatting/` directory
  - Create `table_formatter.ts` for rich tables
  - Create `json_formatter.ts` for machine output
  - Create `formatter_factory.ts` for output selection
  - Add utility functions

- [ ] 3.2 Implement rich table formatting
  - Add table formatting for task lists
  - Create progress bar rendering
  - Implement status coloring
  - Add timestamp formatting
  - Create tree view for task hierarchies

- [ ] 3.3 Implement JSON output formatting
  - Create JSON schema for task data
  - Implement consistent serialization
  - Add validation functions
  - Create versioned output format
  - Implement filtering options

- [ ] 3.4 Add format detection and selection
  - Implement terminal capability detection
  - Add format preference settings
  - Create environment variable controls
  - Implement format fallback mechanism
  - Add debug output options

- [ ] 3.5 Create output templates
  - Design task list template
  - Create detail view template
  - Implement summary view
  - Add report templates
  - Create error output templates

- [ ] 3.6 Implement markdown export
  - Add markdown table generation
  - Create report export functionality
  - Implement document templates
  - Add syntax highlighting
  - Create embedding options

- [ ] 3.7 Create verification report
  - Create `/docs/reports/005_task_3_rich_formatting.md`
  - Include screenshots of rich output
  - Document JSON schema
  - Show format examples
  - Provide usage examples

**Technical Specifications**:
- Support ANSI color in terminals
- Fallback to plain text for non-compatible terminals
- JSON schema version: 1.0
- Markdown output compliance: GitHub Flavored Markdown
- Maximum table width: auto-detect or 80 characters
- Progress bar style: [====>    ] with percentage

**Verification Method**:
- Test in various terminal types
- Verify JSON schema correctness
- Check markdown output
- Test formatting edge cases
- Verify accessibility compliance

**CLI Testing Requirements** (MANDATORY FOR ALL TASKS):
- [ ] Execute rendering in different environments
  - Test in standard terminal
  - Test in limited terminal
  - Test with redirected output
  - Verify with actual data
- [ ] Test format selection
  - Test format auto-detection
  - Test format override flags
  - Test environment variable controls
  - Verify fallback mechanisms
- [ ] Document all tests in report
  - Include screenshots
  - Show JSON examples
  - Include markdown samples
  - Document terminal compatibility

**Acceptance Criteria**:
- Rich tables render correctly in compatible terminals
- JSON output follows defined schema
- Format selection works correctly
- Fallback mechanisms work as expected
- Markdown export creates valid GFM
- Documentation complete

### Task 4: Integration with MCP Server and Instances ⏳ Not Started

**Priority**: HIGH | **Complexity**: HIGH | **Impact**: CRITICAL

**Research Requirements**:
- [ ] Use `perplexity_ask` to research TypeScript integration patterns
- [ ] Use `WebSearch` to find MCP server integration examples
- [ ] Research event-based communication patterns
- [ ] Investigate graceful migration strategies
- [ ] Find examples of backward-compatible implementations
- [ ] Research system prompt modifications for Claude instances
- [ ] Investigate inter-instance communication patterns
- [ ] Research timeout detection and recovery strategies

**Implementation Steps**:
- [ ] 4.1 Update server.ts integration
  - Refactor file-based persistence to use new SQLite layer
  - Update task status tracking
  - Modify result handling
  - Update progress reporting
  - Maintain backward compatibility

- [ ] 4.2 Update pooled_task_command.ts
  - Refactor file-based calls to use database
  - Update task execution mechanism
  - Modify status reporting
  - Update progress tracking
  - Implement instance tracking

- [ ] 4.3 Update instance_pool.ts
  - Refactor in-memory maps to use database
  - Update instance allocation logic
  - Modify task association
  - Update metrics collection
  - Implement shared instance pool

- [ ] 4.4 Add realtime progress updates
  - Implement database polling mechanism
  - Add event-based notifications
  - Create progress update API
  - Implement throttling logic
  - Add batch update capabilities
  - Create heartbeat tracking mechanism
  - Implement timeout detection and alerting
  
- [ ] 4.5 Implement Claude instance system prompt
  - Create system prompt template with DB reporting instructions
  - Add progress reporting guidelines
  - Include timestamp and duration tracking requirements
  - Create standardized reporting format
  - Implement backward compatibility for existing prompts

- [ ] 4.6 Implement configuration
  - Add database configuration options
  - Create environment variable controls
  - Implement dynamic configuration
  - Add fallback options
  - Create configuration validation
  - Add timeout threshold configuration
  - Configure logging detail levels
  - Implement metric collection frequency settings

- [ ] 4.7 Add error handling and recovery
  - Implement connection error recovery
  - Add transaction retries
  - Create data validation mechanisms
  - Add corruption detection
  - Implement backup strategies
  - Add timeout recovery procedures
  - Implement instance restart mechanisms
  - Create alert system for repeated timeouts

- [ ] 4.8 Create verification report
  - Create `/docs/reports/005_task_4_integration.md`
  - Document integration changes
  - Show before/after code
  - Provide performance comparison
  - Include compatibility notes
  - Document timeout detection and recovery procedures
  - Include system prompt modifications
  - Show example time-series reports with metrics

**Technical Specifications**:
- Must maintain API compatibility
- Progress update frequency: configurable, default 1s
- Connection retry: exponential backoff, max 5 attempts
- Error logging: detailed with stack traces
- Backward compatibility: support both file and DB modes
- Configuration precedence: env vars > config file > defaults
- Instance heartbeat interval: configurable, default 5s
- Timeout threshold: configurable, default 3 missed heartbeats
- System prompt extension: minimal additions to maintain compatibility
- Time-series reporting: customizable resolution and retention periods

**Verification Method**:
- Run existing MCP commands
- Test new database-backed functionality
- Verify instance communication
- Test error recovery
- Measure performance impact
- Check backward compatibility
- Verify timeout detection and reporting
- Test instance recovery mechanisms
- Validate time-series metrics collection
- Confirm system prompt integration

**CLI Testing Requirements** (MANDATORY FOR ALL TASKS):
- [ ] Execute actual MCP operations
  - Run claude_code tool
  - Test task status checking
  - Verify instance allocation
  - Test error scenarios
  - Validate timeout detection
  - Verify instance recovery
- [ ] Test backward compatibility
  - Verify file-based fallback
  - Test mixed-mode operation
  - Verify data consistency
  - Test migration scenarios
  - Confirm system prompt compatibility
- [ ] Document all tests in report
  - Include command outputs
  - Show actual performance metrics
  - Document compatibility issues
  - Provide migration guidance
  - Include time-series charts
  - Demonstrate timeout alerts and recovery
  - Show reporting examples with timestamps

**Acceptance Criteria**:
- All MCP operations work with SQLite backend
- Instances properly communicate through database
- Performance matches or exceeds file-based approach
- Error handling and recovery work correctly
- Backward compatibility maintained
- Documentation complete
- Timeout detection and reporting functions correctly
- System prompt modifications integrate seamlessly
- Time-series metrics are collected and queryable
- Reporting includes detailed timestamps and durations

### Task 5: Final Verification and Documentation ⏳ Not Started

**Priority**: CRITICAL | **Complexity**: MEDIUM | **Impact**: CRITICAL

**Implementation Steps**:
- [ ] 5.1 Review all task reports
  - Read all reports in `/docs/reports/005_task_*`
  - Create checklist of incomplete features
  - Identify failed tests or missing functionality
  - Document specific issues preventing completion
  - Prioritize fixes by impact

- [ ] 5.2 Create task completion matrix
  - Build comprehensive status table
  - Mark each sub-task as COMPLETE/INCOMPLETE
  - List specific failures for incomplete tasks
  - Identify blocking dependencies
  - Calculate overall completion percentage

- [ ] 5.3 Iterate on incomplete tasks
  - Return to first incomplete task
  - Fix identified issues
  - Re-run validation tests
  - Update verification report
  - Continue until task passes

- [ ] 5.4 Create comprehensive documentation
  - Update README with SQLite persistence info
  - Create migration guide
  - Document configuration options
  - Create API reference
  - Add usage examples

- [ ] 5.5 Create benchmarks and performance reports
  - Run file vs SQLite benchmarks
  - Test with varying task loads
  - Measure concurrency performance
  - Test search performance
  - Document results

- [ ] 5.6 Create final summary report
  - Create `/docs/reports/005_final_summary.md`
  - Include completion matrix
  - Document all working features
  - List any remaining limitations
  - Provide usage recommendations

- [ ] 5.7 Mark task complete only if ALL sub-tasks pass
  - Verify 100% task completion
  - Confirm all reports show success
  - Ensure no critical issues remain
  - Get final approval
  - Update task status to ✅ Complete

**Technical Specifications**:
- Zero tolerance for incomplete features
- Mandatory iteration until completion
- All tests must pass
- All reports must verify success
- No theoretical completions allowed

**Verification Method**:
- Task completion matrix showing 100%
- All reports confirming success
- Rich table with final status

**Acceptance Criteria**:
- ALL tasks marked COMPLETE
- ALL verification reports show success
- ALL tests pass without issues
- ALL features work in production
- NO incomplete functionality

**CRITICAL ITERATION REQUIREMENT**:
This task CANNOT be marked complete until ALL previous tasks are verified as COMPLETE with passing tests and working functionality. The agent MUST continue iterating on incomplete tasks until 100% completion is achieved.

## Usage Table

| Command / Function | Description | Example Usage | Expected Output |
|-------------------|-------------|---------------|-----------------|
| `claude-code health` | Check MCP status with DB info | `claude-code health` | Rich table with DB stats |
| `claude-code execute-task` | Run a task with DB tracking | `claude-code execute-task 123` | Real-time progress updates |
| `claude-code task-status` | Check task status | `claude-code task-status 123` | Rich table with progress |
| `claude-code search-tasks` | Search tasks using FTS5 | `claude-code search-tasks "pdf processing"` | Ranked search results |
| `claude-code metrics` | View time-series metrics | `claude-code metrics --task 123` | Performance charts with timestamps |
| `claude-code timeout-report` | Check timeout statistics | `claude-code timeout-report --days 7` | Timeout report with charts |
| `claude-code instance-status` | View instance health | `claude-code instance-status` | Instance health dashboard |
| Database Config | Set database options | `DB_PATH=/custom/path.db claude-code` | Uses custom database file |
| Timeout Config | Set timeout thresholds | `TIMEOUT_THRESHOLD=60s claude-code` | Uses custom timeout settings |

## Version Control Plan

- **Initial Commit**: Create task-005-start tag before implementation
- **Feature Commits**: After each major feature
- **Integration Commits**: After component integration  
- **Test Commits**: After test suite completion
- **Final Tag**: Create task-005-complete after all tests pass

## Resources

**Node.js Packages**:
- sqlite3: Native SQLite binding
- better-sqlite3: Improved SQLite interface (optional)
- node-sqlite: Promise-based wrapper (optional)
- cli-table3: Terminal table formatting
- chalk: Terminal coloring

**Documentation**:
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [SQLite FTS5 Extension](https://www.sqlite.org/fts5.html)
- [Node.js sqlite3 Documentation](https://github.com/TryGhost/node-sqlite3)
- [MCP SDK Documentation](https://modelcontextprotocol.github.io/sdk/latest/index.html)

**Example Implementations**:
- [SQLite Repository Pattern Examples](https://github.com/topics/sqlite-repository)
- [Node.js SQLite Projects](https://github.com/topics/sqlite-nodejs)
- [Task Orchestration Systems](https://github.com/topics/task-orchestration)

## Progress Tracking

- Start date: TBD
- Current phase: Planning
- Expected completion: TBD
- Completion criteria: All features working, tests passing, documented

## Report Documentation Requirements

Each sub-task MUST have a corresponding verification report in `/docs/reports/` following these requirements:

### Report Structure:
Each report must include:
1. **Task Summary**: Brief description of what was implemented
2. **Research Findings**: Links to repos, code examples found, best practices discovered
3. **Non-Mocked Results**: Real command outputs and performance metrics
4. **Performance Metrics**: Actual benchmarks with real data
5. **Code Examples**: Working code with verified output
6. **Verification Evidence**: Logs or metrics proving functionality
7. **Limitations Found**: Any discovered issues or constraints
8. **External Resources Used**: All GitHub repos, articles, and examples referenced

### Report Naming Convention:
`/docs/reports/005_task_[SUBTASK]_[feature_name].md`

## Context Management

When context length is running low during implementation, use the following approach to compact and resume work:

1. Issue the `/compact` command to create a concise summary of current progress
2. The summary will include:
   - Completed tasks and key functionality
   - Current task in progress with specific subtask
   - Known issues or blockers
   - Next steps to resume work
   - Key decisions made or patterns established

---

This task document serves as the comprehensive implementation guide. Update status emojis and checkboxes as tasks are completed to maintain progress tracking.