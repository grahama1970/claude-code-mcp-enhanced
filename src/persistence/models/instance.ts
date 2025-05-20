/**
 * Instance Model
 * 
 * Represents a Claude instance that can execute tasks.
 */

export enum InstanceStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  ERROR = 'error',
  TERMINATED = 'terminated'
}

export interface InstanceMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  timeoutTasks: number;
  cancelledTasks: number;
  avgTaskTime?: number;
  lastTaskTime?: number;
  totalTaskTime: number;
  errorRate: number;
  timeoutRate: number;
}

export interface InstanceConfig {
  taskTimeout: number;
  workFolder?: string;
  maxTasks?: number;
  maxMemory?: number;
  defaultModel?: string;
}

export interface Instance {
  id: string;
  status: InstanceStatus;
  currentTaskId?: string | null;
  metrics: InstanceMetrics;
  config: InstanceConfig;
  createdAt: string;
  lastUsedAt: string;
  lastHeartbeatAt: string;
  updatedAt: string;
  // Time since last heartbeat in seconds (calculated field)
  heartbeatAge?: number;
}