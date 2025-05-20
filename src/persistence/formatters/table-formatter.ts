/**
 * Table Formatter
 * 
 * Provides rich table formatting for terminal output.
 */

import { Task, TaskStatus } from '../models/task';
import { Instance, InstanceStatus } from '../models/instance';
import { TaskResult, ResultStatus } from '../models/task-result';
import { TaskLog, LogType } from '../models/task-log';
import { InstanceTelemetry, TelemetryType } from '../models/instance-telemetry';
import { TimeSeriesMetric, MetricType } from '../models/time-series-metric';

/**
 * Interface for table formatters
 */
export interface TableFormatter<T> {
  /**
   * Format a single item as a table
   */
  formatItem(item: T): string;

  /**
   * Format a list of items as a table
   */
  formatList(items: T[]): string;
}

/**
 * Base formatter with common utilities
 */
abstract class BaseTableFormatter<T> implements TableFormatter<T> {
  /**
   * Format a single item as a table
   */
  abstract formatItem(item: T): string;

  /**
   * Format a list of items as a table
   */
  abstract formatList(items: T[]): string;

  /**
   * Create a simple table with headers and rows
   */
  protected createTable(headers: string[], rows: string[][]): string {
    if (rows.length === 0) {
      return 'No items found.';
    }

    // Calculate column widths
    const columnWidths = headers.map((header, index) => {
      const maxContentWidth = Math.max(
        header.length,
        ...rows.map(row => row[index]?.toString().length || 0)
      );
      return maxContentWidth + 2; // Add padding
    });

    // Create header row
    const headerRow = headers.map((header, index) => {
      return this.padString(header, columnWidths[index]);
    }).join('|');

    // Create separator row
    const separatorRow = columnWidths.map(width => '-'.repeat(width)).join('+');

    // Create content rows
    const contentRows = rows.map(row => {
      return row.map((cell, index) => {
        return this.padString(cell || '', columnWidths[index]);
      }).join('|');
    });

    // Assemble the table
    return [
      headerRow,
      separatorRow,
      ...contentRows
    ].join('\n');
  }

  /**
   * Pad a string to a specified width
   */
  protected padString(str: string, width: number): string {
    const padding = Math.max(0, width - str.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
  }

  /**
   * Format a date string as a readable date
   */
  protected formatDate(dateStr?: string | null): string {
    if (!dateStr) {
      return '';
    }

    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  /**
   * Format a duration in milliseconds
   */
  protected formatDuration(ms?: number | null): string {
    if (ms === undefined || ms === null) {
      return '';
    }

    if (ms < 1000) {
      return `${ms}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  /**
   * Format a number as a percentage
   */
  protected formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  /**
   * Format a progress bar
   */
  protected formatProgressBar(progress: number, width: number = 20): string {
    const numBars = Math.round((progress / 100) * width);
    const progressText = `[${'='.repeat(numBars)}${numBars < width ? '>' : ''}${' '.repeat(Math.max(0, width - numBars - 1))}] ${progress}%`;
    return progressText;
  }
}

/**
 * Task table formatter
 */
export class TaskTableFormatter extends BaseTableFormatter<Task> {
  /**
   * Format a single task as a table
   */
  formatItem(task: Task): string {
    const headers = ['Field', 'Value'];
    const rows = [
      ['ID', task.id],
      ['Status', this.formatTaskStatus(task.status)],
      ['Progress', this.formatProgressBar(task.progress)],
      ['Name', task.name || ''],
      ['Description', task.description || ''],
      ['Priority', task.priority],
      ['Execution Mode', task.executionMode],
      ['Instance ID', task.instanceId || ''],
      ['Created At', this.formatDate(task.createdAt)],
      ['Started At', this.formatDate(task.startedAt)],
      ['Completed At', this.formatDate(task.completedAt)],
      ['Duration', this.formatDuration(task.duration)],
      ['Parent Task ID', task.parentTaskId || ''],
      ['Work Folder', task.workFolder || ''],
      ['Return Mode', task.returnMode || ''],
      ['Mode', task.mode || ''],
      ['Timeout', task.timeout ? this.formatDuration(task.timeout) : ''],
      ['Timeout At', this.formatDate(task.timeoutAt)]
    ];

    return this.createTable(headers, rows);
  }

  /**
   * Format a list of tasks as a table
   */
  formatList(tasks: Task[]): string {
    const headers = ['ID', 'Status', 'Progress', 'Name', 'Instance', 'Created', 'Duration'];
    const rows = tasks.map(task => [
      task.id,
      this.formatTaskStatus(task.status),
      this.formatProgressBar(task.progress, 10),
      task.name || '',
      task.instanceId || '',
      this.formatDate(task.createdAt),
      this.formatDuration(task.duration)
    ]);

    return this.createTable(headers, rows);
  }

  /**
   * Format task status with color indicators
   */
  private formatTaskStatus(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.PENDING:
        return '⏳ Pending';
      case TaskStatus.RUNNING:
        return '🔄 Running';
      case TaskStatus.COMPLETED:
        return '✅ Completed';
      case TaskStatus.FAILED:
        return '❌ Failed';
      case TaskStatus.CANCELLED:
        return '⛔ Cancelled';
      case TaskStatus.TIMEOUT:
        return '⏰ Timeout';
      default:
        return status;
    }
  }
}

/**
 * Instance table formatter
 */
export class InstanceTableFormatter extends BaseTableFormatter<Instance> {
  /**
   * Format a single instance as a table
   */
  formatItem(instance: Instance): string {
    const metrics = instance.metrics;
    
    const headers = ['Field', 'Value'];
    const rows = [
      ['ID', instance.id],
      ['Status', this.formatInstanceStatus(instance.status)],
      ['Current Task', instance.currentTaskId || ''],
      ['Created At', this.formatDate(instance.createdAt)],
      ['Last Used At', this.formatDate(instance.lastUsedAt)],
      ['Last Heartbeat', this.formatDate(instance.lastHeartbeatAt)],
      ['Heartbeat Age', instance.heartbeatAge !== undefined ? `${instance.heartbeatAge}s` : ''],
      ['Total Tasks', metrics.totalTasks.toString()],
      ['Successful Tasks', metrics.successfulTasks.toString()],
      ['Failed Tasks', metrics.failedTasks.toString()],
      ['Timeout Tasks', metrics.timeoutTasks.toString()],
      ['Cancelled Tasks', metrics.cancelledTasks.toString()],
      ['Error Rate', this.formatPercentage(metrics.errorRate)],
      ['Timeout Rate', this.formatPercentage(metrics.timeoutRate)],
      ['Avg Task Time', this.formatDuration(metrics.avgTaskTime)],
      ['Task Timeout', this.formatDuration(instance.config.taskTimeout)],
      ['Work Folder', instance.config.workFolder || '']
    ];

    return this.createTable(headers, rows);
  }

  /**
   * Format a list of instances as a table
   */
  formatList(instances: Instance[]): string {
    const headers = ['ID', 'Status', 'Current Task', 'Total Tasks', 'Success Rate', 'Last Heartbeat'];
    const rows = instances.map(instance => [
      instance.id,
      this.formatInstanceStatus(instance.status),
      instance.currentTaskId || '',
      instance.metrics.totalTasks.toString(),
      this.formatPercentage(1 - instance.metrics.errorRate),
      this.formatDate(instance.lastHeartbeatAt)
    ]);

    return this.createTable(headers, rows);
  }

  /**
   * Format instance status with color indicators
   */
  private formatInstanceStatus(status: InstanceStatus): string {
    switch (status) {
      case InstanceStatus.IDLE:
        return '⚪ Idle';
      case InstanceStatus.RUNNING:
        return '🟢 Running';
      case InstanceStatus.ERROR:
        return '🔴 Error';
      case InstanceStatus.TERMINATED:
        return '⚫ Terminated';
      default:
        return status;
    }
  }
}

/**
 * TaskResult table formatter
 */
export class TaskResultTableFormatter extends BaseTableFormatter<TaskResult> {
  /**
   * Format a single result as a table
   */
  formatItem(result: TaskResult): string {
    const headers = ['Field', 'Value'];
    const rows = [
      ['ID', result.id.toString()],
      ['Task ID', result.taskId],
      ['Instance ID', result.instanceId || ''],
      ['Status', this.formatResultStatus(result.status)],
      ['Execution Time', this.formatDuration(result.executionTime)],
      ['Timestamp', this.formatDate(result.timestamp)],
      ['Output', this.truncateText(result.output, 100)],
      ['Error', result.error ? this.truncateText(result.error, 100) : '']
    ];

    return this.createTable(headers, rows);
  }

  /**
   * Format a list of results as a table
   */
  formatList(results: TaskResult[]): string {
    const headers = ['ID', 'Task ID', 'Status', 'Execution Time', 'Timestamp'];
    const rows = results.map(result => [
      result.id.toString(),
      result.taskId,
      this.formatResultStatus(result.status),
      this.formatDuration(result.executionTime),
      this.formatDate(result.timestamp)
    ]);

    return this.createTable(headers, rows);
  }

  /**
   * Format result status with color indicators
   */
  private formatResultStatus(status: ResultStatus): string {
    switch (status) {
      case ResultStatus.SUCCESS:
        return '✅ Success';
      case ResultStatus.ERROR:
        return '❌ Error';
      case ResultStatus.TIMEOUT:
        return '⏰ Timeout';
      case ResultStatus.CANCELLED:
        return '⛔ Cancelled';
      default:
        return status;
    }
  }

  /**
   * Truncate text for display purposes
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
}

/**
 * TaskLog table formatter
 */
export class TaskLogTableFormatter extends BaseTableFormatter<TaskLog> {
  /**
   * Format a single log as a table
   */
  formatItem(log: TaskLog): string {
    const headers = ['Field', 'Value'];
    const rows = [
      ['ID', log.id.toString()],
      ['Task ID', log.taskId],
      ['Instance ID', log.instanceId || ''],
      ['Type', this.formatLogType(log.type)],
      ['Level', log.level],
      ['Message', log.message],
      ['Progress', log.progress !== null ? this.formatProgressBar(log.progress) : ''],
      ['Status', log.status || ''],
      ['Timestamp', this.formatDate(log.timestamp)],
      ['Elapsed Time', log.elapsedTime ? this.formatDuration(log.elapsedTime) : '']
    ];

    return this.createTable(headers, rows);
  }

  /**
   * Format a list of logs as a table
   */
  formatList(logs: TaskLog[]): string {
    const headers = ['ID', 'Type', 'Level', 'Message', 'Progress', 'Timestamp', 'Elapsed'];
    const rows = logs.map(log => [
      log.id.toString(),
      this.formatLogType(log.type),
      log.level,
      this.truncateText(log.message, 30),
      log.progress !== null ? `${log.progress}%` : '',
      this.formatDate(log.timestamp),
      log.elapsedTime ? this.formatDuration(log.elapsedTime) : ''
    ]);

    return this.createTable(headers, rows);
  }

  /**
   * Format log type with color indicators
   */
  private formatLogType(type: LogType): string {
    switch (type) {
      case LogType.PROGRESS:
        return '📊 Progress';
      case LogType.STATUS:
        return '🔄 Status';
      case LogType.HEARTBEAT:
        return '💓 Heartbeat';
      case LogType.ERROR:
        return '❌ Error';
      case LogType.MESSAGE:
        return '📝 Message';
      case LogType.SYSTEM:
        return '⚙️ System';
      default:
        return type;
    }
  }

  /**
   * Truncate text for display purposes
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
}

/**
 * InstanceTelemetry table formatter
 */
export class InstanceTelemetryTableFormatter extends BaseTableFormatter<InstanceTelemetry> {
  /**
   * Format a single telemetry item as a table
   */
  formatItem(telemetry: InstanceTelemetry): string {
    const headers = ['Field', 'Value'];
    const rows = [
      ['ID', telemetry.id.toString()],
      ['Instance ID', telemetry.instanceId],
      ['Task ID', telemetry.taskId || ''],
      ['Type', this.formatTelemetryType(telemetry.type)],
      ['Metric Name', telemetry.metricName || ''],
      ['Value', telemetry.value.toString()],
      ['Unit', telemetry.metricUnit || ''],
      ['Timestamp', this.formatDate(telemetry.timestamp)],
      ['Threshold', telemetry.metricThreshold !== undefined ? telemetry.metricThreshold.toString() : ''],
      ['Exceeded Threshold', telemetry.exceededThreshold !== undefined ? (telemetry.exceededThreshold ? 'Yes' : 'No') : '']
    ];

    return this.createTable(headers, rows);
  }

  /**
   * Format a list of telemetry items as a table
   */
  formatList(telemetry: InstanceTelemetry[]): string {
    const headers = ['ID', 'Instance ID', 'Type', 'Metric', 'Value', 'Timestamp'];
    const rows = telemetry.map(t => [
      t.id.toString(),
      t.instanceId,
      this.formatTelemetryType(t.type),
      t.metricName || '',
      t.value.toString() + (t.metricUnit ? ` ${t.metricUnit}` : ''),
      this.formatDate(t.timestamp)
    ]);

    return this.createTable(headers, rows);
  }

  /**
   * Format telemetry type with color indicators
   */
  private formatTelemetryType(type: TelemetryType): string {
    switch (type) {
      case TelemetryType.HEARTBEAT:
        return '💓 Heartbeat';
      case TelemetryType.TIMEOUT:
        return '⏰ Timeout';
      case TelemetryType.PERFORMANCE:
        return '📊 Performance';
      case TelemetryType.RESOURCE:
        return '💻 Resource';
      case TelemetryType.ERROR:
        return '❌ Error';
      default:
        return type;
    }
  }
}

/**
 * TimeSeriesMetric table formatter
 */
export class TimeSeriesMetricTableFormatter extends BaseTableFormatter<TimeSeriesMetric> {
  /**
   * Format a single metric as a table
   */
  formatItem(metric: TimeSeriesMetric): string {
    const headers = ['Field', 'Value'];
    const rows = [
      ['ID', metric.id.toString()],
      ['Type', this.formatMetricType(metric.type)],
      ['Resolution', metric.resolution],
      ['Timestamp', this.formatDate(metric.timestamp)],
      ['Time Bucket', metric.timeBucket || ''],
      ['Value', metric.value.toString()],
      ['Count', metric.count.toString()],
      ['Min', metric.min?.toString() || ''],
      ['Max', metric.max?.toString() || ''],
      ['Avg', metric.avg?.toString() || ''],
      ['Sum', metric.sum?.toString() || '']
    ];

    return this.createTable(headers, rows);
  }

  /**
   * Format a list of metrics as a table
   */
  formatList(metrics: TimeSeriesMetric[]): string {
    const headers = ['ID', 'Type', 'Resolution', 'Time Bucket', 'Value', 'Count'];
    const rows = metrics.map(metric => [
      metric.id.toString(),
      this.formatMetricType(metric.type),
      metric.resolution,
      metric.timeBucket || this.formatDate(metric.timestamp),
      metric.value.toString(),
      metric.count.toString()
    ]);

    return this.createTable(headers, rows);
  }

  /**
   * Format metric type
   */
  private formatMetricType(type: MetricType): string {
    switch (type) {
      case MetricType.TASK_DURATION:
        return '⏱️ Task Duration';
      case MetricType.TASK_COUNT:
        return '🔢 Task Count';
      case MetricType.INSTANCE_COUNT:
        return '👥 Instance Count';
      case MetricType.TIMEOUT_COUNT:
        return '⏰ Timeout Count';
      case MetricType.ERROR_COUNT:
        return '❌ Error Count';
      case MetricType.RESOURCE_USAGE:
        return '💻 Resource Usage';
      case MetricType.QUEUE_LENGTH:
        return '📋 Queue Length';
      case MetricType.CPU_USAGE:
        return '🔄 CPU Usage';
      case MetricType.MEMORY_USAGE:
        return '🧠 Memory Usage';
      case MetricType.CUSTOM:
        return '🔧 Custom';
      default:
        return type;
    }
  }
}

// Export formatter instances
export const taskTableFormatter = new TaskTableFormatter();
export const instanceTableFormatter = new InstanceTableFormatter();
export const taskResultTableFormatter = new TaskResultTableFormatter();
export const taskLogTableFormatter = new TaskLogTableFormatter();
export const instanceTelemetryTableFormatter = new InstanceTelemetryTableFormatter();
export const timeSeriesMetricTableFormatter = new TimeSeriesMetricTableFormatter();