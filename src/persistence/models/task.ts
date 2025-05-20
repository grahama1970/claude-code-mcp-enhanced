/**
 * Task Model
 * 
 * Represents a task that can be executed by a Claude instance.
 */

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum TaskExecutionMode {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel'
}

export interface TaskMetadata {
  [key: string]: string | number | boolean | null;
}

export interface SubTask {
  id: string;
  taskId: string;
  status: TaskStatus;
  progress: number;
  name?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  parentTaskId?: string | null;
  status: TaskStatus;
  progress: number;
  priority: TaskPriority;
  executionMode: TaskExecutionMode;
  name?: string;
  description?: string;
  prompt: string;
  workFolder?: string | null;
  returnMode?: 'summary' | 'full' | null;
  mode?: string | null;
  metadata?: TaskMetadata | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt: string;
  instanceId?: string | null;
  timeout?: number | null;
  timeoutAt?: string | null;
  timeoutHandled?: boolean;
  subtasks?: SubTask[];
  // Duration in milliseconds (calculated field)
  duration?: number;
}