/**
 * Formatter Factory
 * 
 * Factory for creating output formatters based on format type and model type.
 */

import { Task } from '../models/task';
import { Instance } from '../models/instance';
import { TaskResult } from '../models/task-result';
import { TaskLog } from '../models/task-log';
import { InstanceTelemetry } from '../models/instance-telemetry';
import { TimeSeriesMetric } from '../models/time-series-metric';

import {
  TaskJsonFormatter,
  InstanceJsonFormatter,
  TaskResultJsonFormatter,
  TaskLogJsonFormatter,
  InstanceTelemetryJsonFormatter,
  TimeSeriesMetricJsonFormatter,
  taskJsonFormatter,
  instanceJsonFormatter,
  taskResultJsonFormatter,
  taskLogJsonFormatter,
  instanceTelemetryJsonFormatter,
  timeSeriesMetricJsonFormatter
} from './json-formatter';

import {
  TaskTableFormatter,
  InstanceTableFormatter,
  TaskResultTableFormatter,
  TaskLogTableFormatter,
  InstanceTelemetryTableFormatter,
  TimeSeriesMetricTableFormatter,
  taskTableFormatter,
  instanceTableFormatter,
  taskResultTableFormatter,
  taskLogTableFormatter,
  instanceTelemetryTableFormatter,
  timeSeriesMetricTableFormatter
} from './table-formatter';

/**
 * Output format types
 */
export enum FormatType {
  JSON = 'json',
  TABLE = 'table',
  MARKDOWN = 'markdown'
}

/**
 * Formatter interface
 */
export interface Formatter<T> {
  formatItem(item: T): string;
  formatList(items: T[]): string;
}

/**
 * Factory for creating formatters
 */
export class FormatterFactory {
  /**
   * Create a formatter for a specific model and format type
   */
  static createFormatter<T>(
    modelType: string,
    formatType: FormatType = FormatType.TABLE
  ): Formatter<T> {
    // Use format type to choose between JSON and table
    if (formatType === FormatType.JSON) {
      return this.createJsonFormatter<T>(modelType);
    } else {
      return this.createTableFormatter<T>(modelType);
    }
  }

  /**
   * Create a JSON formatter for a specific model type
   */
  private static createJsonFormatter<T>(modelType: string): Formatter<T> {
    switch (modelType) {
      case 'task':
        return taskJsonFormatter as unknown as Formatter<T>;
      case 'instance':
        return instanceJsonFormatter as unknown as Formatter<T>;
      case 'taskResult':
        return taskResultJsonFormatter as unknown as Formatter<T>;
      case 'taskLog':
        return taskLogJsonFormatter as unknown as Formatter<T>;
      case 'instanceTelemetry':
        return instanceTelemetryJsonFormatter as unknown as Formatter<T>;
      case 'timeSeriesMetric':
        return timeSeriesMetricJsonFormatter as unknown as Formatter<T>;
      default:
        throw new Error(`Unknown model type: ${modelType}`);
    }
  }

  /**
   * Create a table formatter for a specific model type
   */
  private static createTableFormatter<T>(modelType: string): Formatter<T> {
    switch (modelType) {
      case 'task':
        return taskTableFormatter as unknown as Formatter<T>;
      case 'instance':
        return instanceTableFormatter as unknown as Formatter<T>;
      case 'taskResult':
        return taskResultTableFormatter as unknown as Formatter<T>;
      case 'taskLog':
        return taskLogTableFormatter as unknown as Formatter<T>;
      case 'instanceTelemetry':
        return instanceTelemetryTableFormatter as unknown as Formatter<T>;
      case 'timeSeriesMetric':
        return timeSeriesMetricTableFormatter as unknown as Formatter<T>;
      default:
        throw new Error(`Unknown model type: ${modelType}`);
    }
  }

  /**
   * Detect format type from request headers or query parameters
   */
  static detectFormatType(headers?: Record<string, string>, query?: Record<string, string>): FormatType {
    // Check query parameters first
    if (query?.format) {
      if (query.format.toLowerCase() === 'json') {
        return FormatType.JSON;
      } else if (query.format.toLowerCase() === 'markdown') {
        return FormatType.MARKDOWN;
      }
    }

    // Check accept header
    if (headers?.accept) {
      if (headers.accept.includes('application/json')) {
        return FormatType.JSON;
      } else if (headers.accept.includes('text/markdown')) {
        return FormatType.MARKDOWN;
      }
    }

    // Default to table format for terminal output
    return FormatType.TABLE;
  }

  /**
   * Format an item or list of items based on format type and model type
   */
  static format<T>(
    data: T | T[],
    modelType: string,
    formatType: FormatType = FormatType.TABLE
  ): string {
    const formatter = this.createFormatter<T>(modelType, formatType);
    
    if (Array.isArray(data)) {
      return formatter.formatList(data);
    } else {
      return formatter.formatItem(data);
    }
  }
}

// Export formatter factory and format types
export { FormatType };