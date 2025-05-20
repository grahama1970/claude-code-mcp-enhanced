/**
 * JSON Formatter
 * 
 * Provides JSON formatting for machine-readable output.
 */

import { Task } from '../models/task';
import { Instance } from '../models/instance';
import { TaskResult } from '../models/task-result';
import { TaskLog } from '../models/task-log';
import { InstanceTelemetry } from '../models/instance-telemetry';
import { TimeSeriesMetric } from '../models/time-series-metric';

/**
 * Interface for JSON formatters
 */
export interface JsonFormatter<T> {
  /**
   * Format a single item as JSON
   */
  formatItem(item: T): string;

  /**
   * Format a list of items as JSON
   */
  formatList(items: T[]): string;
}

/**
 * Base JSON formatter with common utilities
 */
abstract class BaseJsonFormatter<T> implements JsonFormatter<T> {
  /**
   * Format a single item as JSON
   */
  formatItem(item: T): string {
    return JSON.stringify(this.prepareItem(item), null, 2);
  }

  /**
   * Format a list of items as JSON
   */
  formatList(items: T[]): string {
    return JSON.stringify({
      count: items.length,
      items: items.map(item => this.prepareItem(item))
    }, null, 2);
  }

  /**
   * Prepare item for JSON serialization
   */
  protected abstract prepareItem(item: T): any;

  /**
   * Convert date string to ISO format
   */
  protected formatDate(dateStr?: string | null): string | null {
    if (!dateStr) {
      return null;
    }

    return new Date(dateStr).toISOString();
  }

  /**
   * Calculate duration between two dates
   */
  protected calculateDuration(startDate?: string | null, endDate?: string | null): number | null {
    if (!startDate || !endDate) {
      return null;
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return end - start;
  }
}

/**
 * Task JSON formatter
 */
export class TaskJsonFormatter extends BaseJsonFormatter<Task> {
  /**
   * Prepare task for JSON serialization
   */
  protected prepareItem(task: Task): any {
    // Calculate duration if not provided
    let duration = task.duration;
    if (!duration && task.startedAt && task.completedAt) {
      duration = this.calculateDuration(task.startedAt, task.completedAt);
    }

    return {
      id: task.id,
      parentTaskId: task.parentTaskId,
      status: task.status,
      progress: task.progress,
      priority: task.priority,
      executionMode: task.executionMode,
      name: task.name,
      description: task.description,
      workFolder: task.workFolder,
      returnMode: task.returnMode,
      mode: task.mode,
      metadata: task.metadata,
      createdAt: this.formatDate(task.createdAt),
      startedAt: this.formatDate(task.startedAt),
      completedAt: this.formatDate(task.completedAt),
      updatedAt: this.formatDate(task.updatedAt),
      instanceId: task.instanceId,
      timeout: task.timeout,
      timeoutAt: this.formatDate(task.timeoutAt),
      timeoutHandled: task.timeoutHandled,
      duration,
      subtasks: task.subtasks ? task.subtasks.map(subtask => ({
        id: subtask.id,
        taskId: subtask.taskId,
        status: subtask.status,
        progress: subtask.progress,
        name: subtask.name,
        description: subtask.description,
        createdAt: this.formatDate(subtask.createdAt),
        updatedAt: this.formatDate(subtask.updatedAt)
      })) : []
    };
  }
}

/**
 * Instance JSON formatter
 */
export class InstanceJsonFormatter extends BaseJsonFormatter<Instance> {
  /**
   * Prepare instance for JSON serialization
   */
  protected prepareItem(instance: Instance): any {
    return {
      id: instance.id,
      status: instance.status,
      currentTaskId: instance.currentTaskId,
      metrics: {
        totalTasks: instance.metrics.totalTasks,
        successfulTasks: instance.metrics.successfulTasks,
        failedTasks: instance.metrics.failedTasks,
        timeoutTasks: instance.metrics.timeoutTasks,
        cancelledTasks: instance.metrics.cancelledTasks,
        avgTaskTime: instance.metrics.avgTaskTime,
        lastTaskTime: instance.metrics.lastTaskTime,
        totalTaskTime: instance.metrics.totalTaskTime,
        errorRate: instance.metrics.errorRate,
        timeoutRate: instance.metrics.timeoutRate
      },
      config: {
        taskTimeout: instance.config.taskTimeout,
        workFolder: instance.config.workFolder,
        maxTasks: instance.config.maxTasks,
        maxMemory: instance.config.maxMemory,
        defaultModel: instance.config.defaultModel
      },
      createdAt: this.formatDate(instance.createdAt),
      lastUsedAt: this.formatDate(instance.lastUsedAt),
      lastHeartbeatAt: this.formatDate(instance.lastHeartbeatAt),
      updatedAt: this.formatDate(instance.updatedAt),
      heartbeatAge: instance.heartbeatAge
    };
  }
}

/**
 * TaskResult JSON formatter
 */
export class TaskResultJsonFormatter extends BaseJsonFormatter<TaskResult> {
  /**
   * Prepare task result for JSON serialization
   */
  protected prepareItem(result: TaskResult): any {
    return {
      id: result.id,
      taskId: result.taskId,
      instanceId: result.instanceId,
      status: result.status,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime,
      timestamp: this.formatDate(result.timestamp),
      metadata: result.metadata
    };
  }
}

/**
 * TaskLog JSON formatter
 */
export class TaskLogJsonFormatter extends BaseJsonFormatter<TaskLog> {
  /**
   * Prepare task log for JSON serialization
   */
  protected prepareItem(log: TaskLog): any {
    return {
      id: log.id,
      taskId: log.taskId,
      instanceId: log.instanceId,
      type: log.type,
      level: log.level,
      message: log.message,
      progress: log.progress,
      status: log.status,
      timestamp: this.formatDate(log.timestamp),
      metadata: log.metadata,
      elapsedTime: log.elapsedTime
    };
  }
}

/**
 * InstanceTelemetry JSON formatter
 */
export class InstanceTelemetryJsonFormatter extends BaseJsonFormatter<InstanceTelemetry> {
  /**
   * Prepare instance telemetry for JSON serialization
   */
  protected prepareItem(telemetry: InstanceTelemetry): any {
    return {
      id: telemetry.id,
      instanceId: telemetry.instanceId,
      taskId: telemetry.taskId,
      type: telemetry.type,
      timestamp: this.formatDate(telemetry.timestamp),
      value: telemetry.value,
      metadata: telemetry.metadata,
      metricName: telemetry.metricName,
      metricUnit: telemetry.metricUnit,
      metricThreshold: telemetry.metricThreshold,
      exceededThreshold: telemetry.exceededThreshold
    };
  }
}

/**
 * TimeSeriesMetric JSON formatter
 */
export class TimeSeriesMetricJsonFormatter extends BaseJsonFormatter<TimeSeriesMetric> {
  /**
   * Prepare time series metric for JSON serialization
   */
  protected prepareItem(metric: TimeSeriesMetric): any {
    return {
      id: metric.id,
      type: metric.type,
      timestamp: this.formatDate(metric.timestamp),
      resolution: metric.resolution,
      value: metric.value,
      count: metric.count,
      min: metric.min,
      max: metric.max,
      avg: metric.avg,
      sum: metric.sum,
      metadata: metric.metadata,
      timeBucket: metric.timeBucket
    };
  }
}

// Export formatter instances
export const taskJsonFormatter = new TaskJsonFormatter();
export const instanceJsonFormatter = new InstanceJsonFormatter();
export const taskResultJsonFormatter = new TaskResultJsonFormatter();
export const taskLogJsonFormatter = new TaskLogJsonFormatter();
export const instanceTelemetryJsonFormatter = new InstanceTelemetryJsonFormatter();
export const timeSeriesMetricJsonFormatter = new TimeSeriesMetricJsonFormatter();