/**
 * Task Log Model
 * 
 * Represents a log entry for a task, including progress updates,
 * status changes, and other events.
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export enum LogType {
  PROGRESS = 'progress',
  STATUS = 'status',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
  MESSAGE = 'message',
  SYSTEM = 'system'
}

export interface TaskLog {
  id: number;
  taskId: string;
  instanceId?: string | null;
  type: LogType;
  level: LogLevel;
  message: string;
  progress?: number | null;
  status?: string | null;
  timestamp: string;
  metadata?: { [key: string]: any } | null;
  // Duration since task start in milliseconds (calculated field)
  elapsedTime?: number;
}