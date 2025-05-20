# Task List Template Guide for Marker

This guide provides a comprehensive template for creating task lists that ensure agents can successfully complete implementations with real-world code examples, mandatory research, and iterative completion verification.

## Core Requirements for Task Lists

### 1. Mandatory Research Process
Every task list MUST include a research requirement section that forces agents to:
- Use `perplexity_ask` for current best practices
- Use `WebSearch` to find real GitHub repositories and code examples
- Document all findings in verification reports
- Base implementations on actual production code, not theoretical patterns

### 2. Iterative Completion Enforcement
Task lists MUST include a final verification task that:
- Reviews all sub-task reports for completion status
- Forces iteration on incomplete tasks until 100% success
- Creates a completion matrix showing COMPLETE/INCOMPLETE status
- Prevents marking the main task complete until ALL sub-tasks pass

### 3. Report Documentation Requirements
Each sub-task MUST generate a verification report with:
- Real test outputs and performance metrics
- Actual command executions and results
- Links to external resources and code examples used
- Evidence of functionality (logs, metrics, outputs)
- Discovered limitations and issues

## Standard Task List Template

```markdown
# Task [NUMBER]: [DESCRIPTIVE NAME] ⏳ Not Started

**Objective**: Clear, specific description of what this task implements and why.

**Requirements**:
1. Specific, measurable requirement 1
2. Specific, measurable requirement 2  
3. [Continue with all requirements]

## Overview

Brief context about the task's importance and relationship to the project.

**IMPORTANT**: 
1. Each sub-task MUST include creation of a verification report in `/docs/reports/` with actual command outputs and performance results.
2. Task [N] (Final Verification) enforces MANDATORY iteration on ALL incomplete tasks. The agent MUST continue working until 100% completion is achieved - no partial completion is acceptable.

## Research Summary

[Brief summary of domain research that informed this task design]

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
perplexity_ask: "pdf layout analysis best practices 2024 python"
WebSearch: "site:github.com marker pdf converter surya model integration"
```

## Implementation Tasks (Ordered by Priority/Complexity)

### Task 1: [Feature Name] ⏳ Not Started

**Priority**: HIGH/MEDIUM/LOW | **Complexity**: HIGH/MEDIUM/LOW | **Impact**: HIGH/MEDIUM/LOW

**Research Requirements**:
- [ ] Use `perplexity_ask` to find PDF processing patterns
- [ ] Use `WebSearch` to find production marker implementations
- [ ] Search GitHub for "surya model pdf" examples
- [ ] Find real-world document processing strategies
- [ ] Locate performance benchmarking code

**Example Starting Code** (to be found via research):
```python
# Agent MUST use perplexity_ask and WebSearch to find:
# 1. [Specific pattern 1]
# 2. [Specific pattern 2]
# 3. [Implementation approach]
# 4. [Best practice]
# Example search queries:
# - "site:github.com marker pdf converter production" 
# - "surya model optimization patterns 2024"
# - "pdf table extraction best practices"
```

**Working Starting Code** (if available):
```python
# Include actual working code examples when possible
from marker.converters.pdf import PdfConverter
from marker.config.parser import ParserConfig

config = ParserConfig(
    model_list=["surya_det", "surya_rec"],
    batch_multiplier=2
)

converter = PdfConverter(config=config)
document = converter("input.pdf")
```

**Implementation Steps**:
- [ ] 1.1 Create infrastructure
  - Create `/marker/[module]/[submodule]/` directory
  - Create `__init__.py` files
  - Create main implementation file
  - Add dependencies to pyproject.toml

- [ ] 1.2 Implement core functionality  
  - Define interfaces and base classes
  - Implement main logic with error handling
  - Add configuration management
  - Create helper utilities
  - Include logging

- [ ] 1.3 Add integration points
  - Integrate with existing modules
  - Create adapter patterns if needed  
  - Add backwards compatibility
  - Implement graceful degradation
  - Test integration scenarios

- [ ] 1.4 Create CLI commands
  - Add commands to marker CLI
  - Follow existing CLI patterns
  - Include help documentation
  - Add input validation
  - Implement output formatting

- [ ] 1.5 Add verification methods
  - Create test fixtures with real PDFs
  - Generate verification outputs
  - Measure performance metrics
  - Validate against requirements
  - Document limitations found

- [ ] 1.6 Create verification report
  - Create `/docs/reports/[TASK]_task_[N]_[feature].md`
  - Document actual commands and results
  - Include real performance benchmarks
  - Show working code examples
  - Add evidence of functionality

- [ ] 1.7 Test with real documents
  - Test with various PDF types
  - Validate table extraction
  - Check image handling
  - Verify section hierarchy
  - Test LLM integration

- [ ] 1.8 Git commit feature

**Technical Specifications**:
- Performance target: <5s for 10 page PDF
- Memory constraint: <1GB RAM
- Accuracy requirement: >95% text extraction
- Table quality: >90% structure preservation
- Error rate: <1% on standard PDFs

**Verification Method**:
- Run conversion on test PDFs
- Measure processing time
- Check memory usage
- Compare output quality
- CLI execution log showing commands

**CLI Testing Requirements** (MANDATORY FOR ALL TASKS):
- [ ] Execute actual CLI commands, not just unit tests
  - Run `marker convert` with real PDFs
  - Test all parameter combinations
  - Verify error handling with invalid inputs
  - Document exact command syntax used
  - Capture and verify actual output
- [ ] Test end-to-end functionality
  - Start with CLI input
  - Verify all intermediate steps
  - Confirm final output matches expectations
  - Test integration between components
- [ ] Document all CLI tests in report
  - Include exact commands executed
  - Show actual output received
  - Note any error messages
  - Verify against expected behavior

**Acceptance Criteria**:
- All test PDFs convert successfully
- Performance meets target
- Output quality verified
- CLI commands work correctly
- Documentation complete

### Task 2: [Next Feature] ⏳ Not Started

[Repeat same structure for all tasks...]

### Task [N]: Completion Verification and Iteration ⏳ Not Started

**Priority**: CRITICAL | **Complexity**: LOW | **Impact**: CRITICAL

**Implementation Steps**:
- [ ] N.1 Review all task reports
  - Read all reports in `/docs/reports/[TASK]_task_*`
  - Create checklist of incomplete features
  - Identify failed tests or missing functionality
  - Document specific issues preventing completion
  - Prioritize fixes by impact

- [ ] N.2 Create task completion matrix
  - Build comprehensive status table
  - Mark each sub-task as COMPLETE/INCOMPLETE
  - List specific failures for incomplete tasks
  - Identify blocking dependencies
  - Calculate overall completion percentage

- [ ] N.3 Iterate on incomplete tasks
  - Return to first incomplete task
  - Fix identified issues
  - Re-run validation tests
  - Update verification report
  - Continue until task passes

- [ ] N.4 Re-validate completed tasks
  - Ensure no regressions from fixes
  - Run integration tests
  - Verify cross-task compatibility
  - Update affected reports
  - Document any new limitations

- [ ] N.5 Final comprehensive validation
  - Run all CLI commands
  - Execute performance benchmarks
  - Test all integrations
  - Verify documentation accuracy
  - Confirm all features work together

- [ ] N.6 Create final summary report
  - Create `/docs/reports/[TASK]_final_summary.md`
  - Include completion matrix
  - Document all working features
  - List any remaining limitations
  - Provide usage recommendations

- [ ] N.7 Mark task complete only if ALL sub-tasks pass
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
| `marker convert` | Convert PDF to markdown | `marker convert input.pdf -o output.md` | Markdown file created |
| `marker convert` | With table extraction | `marker convert input.pdf --config.table.enabled=true` | PDF with tables extracted |
| Task Matrix | Verify completion | Review `/docs/reports/[TASK]_task_*` | 100% completion required |

## Version Control Plan

- **Initial Commit**: Create task-[NUMBER]-start tag before implementation
- **Feature Commits**: After each major feature
- **Integration Commits**: After component integration  
- **Test Commits**: After test suite completion
- **Final Tag**: Create task-[NUMBER]-complete after all tests pass

## Resources

**Python Packages**:
- marker-pdf: PDF conversion
- surya-ocr: Layout detection
- litellm: LLM integration
- camelot-py: Table extraction

**Documentation**:
- [Marker Documentation](https://github.com/VikParuchuri/marker)
- [Surya OCR Docs](https://github.com/VikParuchuri/surya)
- [LiteLLM Documentation](https://docs.litellm.ai/)
- [Camelot Documentation](https://camelot-py.readthedocs.io/)

**Example Implementations**:
- [Marker Fork Examples](https://github.com/USERNAME/marker)
- [PDF Processing Projects](https://github.com/topics/pdf-processing)
- [Document AI Solutions](https://github.com/topics/document-ai)

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
`/docs/reports/[TASK_NUMBER]_task_[SUBTASK]_[feature_name].md`

Example content for a report:
```markdown
# Task [N].[M]: [Feature] Verification Report

## Summary
[What was implemented and key achievements]

## Research Findings
- Found pattern X in repo: [link]
- Best practice Y from: [link]
- Performance optimization Z from: [article]

## Real Command Outputs
```bash
$ marker convert test.pdf -o test.md
Processing test.pdf...
Detecting layout with surya_det...
Extracting text with surya_rec...
Converting to markdown...
Conversion complete: test.md
Time: 3.2s
```

## Actual Performance Results
| Operation | Metric | Result | Target | Status |
|-----------|--------|--------|--------|--------|
| 10-page PDF | Time | 3.2s | <5s | PASS |
| Memory usage | RAM | 650MB | <1GB | PASS |

## Working Code Example
```python
# Actual tested code
from marker.converters.pdf import PdfConverter

converter = PdfConverter()
result = converter("test.pdf")
print(f"Pages: {len(result.pages)}")
# Output:
# Pages: 10
```

## Verification Evidence
- Command executed successfully
- Output markdown validated
- Performance within targets
- Table extraction working

## Limitations Discovered
- Large images slow processing
- Complex tables need camelot fallback

## External Resources Used
- [Marker GitHub](https://github.com/VikParuchuri/marker) - Base implementation
- [Surya Examples](link) - Layout detection patterns
- [PDF Best Practices](link) - Referenced for optimization
```

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
```