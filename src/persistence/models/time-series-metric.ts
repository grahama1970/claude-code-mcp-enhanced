/**
 * Time Series Metric Model
 * 
 * Represents a time series metric for analytics and reporting.
 */

export enum MetricType {
  TASK_DURATION = 'task_duration',
  TASK_COUNT = 'task_count',
  INSTANCE_COUNT = 'instance_count',
  TIMEOUT_COUNT = 'timeout_count',
  ERROR_COUNT = 'error_count',
  RESOURCE_USAGE = 'resource_usage',
  QUEUE_LENGTH = 'queue_length',
  CPU_USAGE = 'cpu_usage',
  MEMORY_USAGE = 'memory_usage',
  CUSTOM = 'custom'
}

export enum MetricResolution {
  MINUTE = 'minute', // 1-minute resolution for last 24 hours
  HOUR = 'hour',     // Hourly resolution for last 30 days
  DAY = 'day',       // Daily resolution for last year
  MONTH = 'month'    // Monthly resolution for long-term
}

export interface TimeSeriesMetric {
  id: number;
  type: MetricType;
  timestamp: string;
  resolution: MetricResolution;
  value: number;
  count: number;
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  sum?: number | null;
  metadata?: { [key: string]: any } | null;
  // Time bucket (calculated field)
  timeBucket?: string;
}