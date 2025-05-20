# Task 5: Tasks with Timeouts

## Task Summary
Implemented timeout handling for tasks with both successful completion and timeout scenarios:
1. Simple task: "What is 2 + 2?" with a 5-second timeout (should complete)
2. Complex task: Simulated long-running task with a 1-second timeout (should timeout)

## Research Findings
Timeout handling is crucial in distributed task execution systems to:
- Prevent resource exhaustion from stuck tasks
- Ensure system responsiveness
- Support graceful degradation
- Handle partial results when available

Common timeout patterns include:
- Signal-based timeouts (as implemented)
- Thread-based timeouts
- Future/Promise-based timeouts with cancellation tokens

## Non-Mocked Results
```
Running simple task with 5-second timeout...
Simple Task Result: {'status': 'SUCCESS', 'result': 4, 'error': None, 'execution_time': 4.76837158203125e-07}

Running complex task with 1-second timeout...
Complex Task Result: {'status': 'TIMEOUT', 'result': None, 'error': 'Task timed out after 1 seconds', 'execution_time': 1.0000367164611816}

Verification complete. All timeout tests passed.
```

## Performance Metrics
- Simple task execution time: 4.76837158203125e-07 seconds (well under timeout)
- Complex task execution time: 1.0000367164611816 seconds (timed out at 1 second limit)

## Code Examples
The implementation uses Python's signal module for timeout handling:

```python
def run_with_timeout(func, timeout, *args, **kwargs):
    '''Run a function with a timeout'''
    # Set the timeout handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(timeout)
    
    result = None
    error = None
    start_time = time.time()
    
    try:
        # Run the function
        result = func(*args, **kwargs)
        execution_time = time.time() - start_time
        status = 'SUCCESS'
    except TimeoutError:
        execution_time = time.time() - start_time
        status = 'TIMEOUT'
        error = 'Task timed out after {} seconds'.format(timeout)
    except Exception as e:
        execution_time = time.time() - start_time
        status = 'ERROR'
        error = str(e)
    finally:
        # Cancel the alarm
        signal.alarm(0)
    
    return {
        'status': status,
        'result': result,
        'error': error,
        'execution_time': execution_time
    }
```

## Verification Evidence
- Quick task completed successfully and returned the correct result (4)
- Long task timed out as expected after 1 second
- Timeout was handled gracefully with appropriate error message
- Execution times were accurately measured
- All verification assertions passed

## Limitations Found
- Signal-based timeouts only work in the main thread
- This implementation doesn't support partial results
- On Windows, signal.SIGALRM isn't available (would need to use threading.Timer instead)
- Current implementation doesn't allow for cleanup code to run after timeout

## External Resources Used
- Python's signal module for timeout implementation
- Python's time module for performance measurement
- Python's threading module (imported but not directly used in this simple example)