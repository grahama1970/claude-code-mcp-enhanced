/**
 * Task Result Model
 * 
 * Represents the result of a completed task.
 */

export enum ResultStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

export interface TaskResult {
  id: number;
  taskId: string;
  instanceId?: string | null;
  status: ResultStatus;
  output: string;
  error?: string | null;
  executionTime: number; // in milliseconds
  timestamp: string;
  metadata?: { [key: string]: any } | null;
}