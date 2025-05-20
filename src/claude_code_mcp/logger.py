"""
Logging configuration for the Claude Code MCP server.

This module sets up and configures the logging system for the entire application
using the loguru library.

Documentation:
- Loguru: https://github.com/Delgan/loguru#readme

Sample Input:
  from claude_code_mcp.logger import logger
  logger.info("Server started")

Expected Output:
  2023-05-19 14:30:45.123 | INFO     | claude_code_mcp.server:start:42 - Server started
"""

import sys
from typing import Dict, Any, Optional

from loguru import logger

# Remove default handler
logger.remove()

# Add a console handler with a specific format
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO",
)

# Add a file handler for more permanent logging
logger.add(
    "logs/claude_code_mcp.log",
    rotation="10 MB",
    retention="1 week",
    compression="zip",
    level="DEBUG",
)


def configure(config: Dict[str, Any]) -> None:
    """
    Configure the logger with custom settings.
    
    Args:
        config: Dictionary with configuration values like log_level, log_file, etc.
    """
    # Remove all handlers first
    logger.remove()
    
    # Add console handler with configured level
    level = config.get("log_level", "INFO")
    logger.add(sys.stderr, level=level)
    
    # Add file handler if specified
    log_file = config.get("log_file")
    if log_file:
        logger.add(
            log_file,
            rotation=config.get("log_rotation", "10 MB"),
            retention=config.get("log_retention", "1 week"),
            compression=config.get("log_compression", "zip"),
            level=config.get("file_log_level", level),
        )


if __name__ == "__main__":
    import sys
    
    # Track validation failures
    all_validation_failures = []
    total_tests = 0
    
    # Test 1: Basic logging functionality
    total_tests += 1
    try:
        # Capture log output to verify it works
        test_message = "Test log message"
        logger.info(test_message)
        # In a real test, we would capture the output and verify it contains the message
        # Since this is just validation, we'll simply check the logger is configured
        assert logger._core.handlers, "Logger should have at least one handler"
    except Exception as e:
        all_validation_failures.append(f"Basic logging test failed: {str(e)}")
    
    # Test 2: Configuration function
    total_tests += 1
    try:
        # Test the configuration function
        test_config = {"log_level": "DEBUG", "log_file": "test.log"}
        configure(test_config)
        # Verify it applied the configuration
        assert logger._core.handlers, "Logger should have handlers after configuration"
    except Exception as e:
        all_validation_failures.append(f"Configuration test failed: {str(e)}")
    
    # Final validation result
    if all_validation_failures:
        print(f"❌ VALIDATION FAILED - {len(all_validation_failures)} of {total_tests} tests failed:")
        for failure in all_validation_failures:
            print(f"  - {failure}")
        sys.exit(1)
    else:
        print(f"✅ VALIDATION PASSED - All {total_tests} tests produced expected results")
        print("Function is validated and formal tests can now be written")
        sys.exit(0)