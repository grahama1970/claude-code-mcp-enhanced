/**
 * Instance Telemetry Model
 * 
 * Represents telemetry data collected from Claude instances,
 * including timeouts, performance metrics, and resource usage.
 */

export enum TelemetryType {
  HEARTBEAT = 'heartbeat',
  TIMEOUT = 'timeout',
  PERFORMANCE = 'performance',
  RESOURCE = 'resource',
  ERROR = 'error'
}

export interface InstanceTelemetry {
  id: number;
  instanceId: string;
  taskId?: string | null;
  type: TelemetryType;
  timestamp: string;
  value: number;
  metadata?: { [key: string]: any } | null;
  // Additional computed values (calculated fields)
  metricName?: string;
  metricUnit?: string;
  metricThreshold?: number;
  exceededThreshold?: boolean;
}