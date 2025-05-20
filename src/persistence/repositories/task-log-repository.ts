/**
 * Task Log Repository
 * 
 * Manages persistence operations for task logs.
 */

import { BaseRepository } from './base-repository';
import { TaskLog, LogLevel, LogType } from '../models/task-log';
import { DatabaseManager, database } from '../database';

/**
 * Log search options
 */
export interface LogSearchOptions {
  taskId?: string;
  instanceId?: string;
  type?: LogType | LogType[];
  level?: LogLevel | LogLevel[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
  message?: string;
  offset?: number;
  limit?: number;
  orderBy?: 'timestamp' | 'id';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Task log repository interface
 */
export interface ITaskLogRepository {
  /**
   * Find log by ID
   */
  findById(id: number): Promise<TaskLog | null>;

  /**
   * Find logs for a task with optional pagination
   */
  findByTaskId(taskId: string, options?: { offset?: number; limit?: number }): Promise<TaskLog[]>;

  /**
   * Find logs for an instance with optional pagination
   */
  findByInstanceId(instanceId: string, options?: { offset?: number; limit?: number }): Promise<TaskLog[]>;

  /**
   * Find logs for a task with a specific log type
   */
  findByTaskIdAndType(taskId: string, type: LogType, options?: { offset?: number; limit?: number }): Promise<TaskLog[]>;

  /**
   * Search logs with various criteria
   */
  search(options: LogSearchOptions): Promise<TaskLog[]>;

  /**
   * Create a new log entry
   */
  create(log: Omit<TaskLog, 'id'>): Promise<TaskLog>;

  /**
   * Log progress update
   */
  logProgress(taskId: string, progress: number, message: string, instanceId?: string): Promise<TaskLog>;

  /**
   * Log status update
   */
  logStatus(taskId: string, status: string, message: string, instanceId?: string): Promise<TaskLog>;

  /**
   * Log error message
   */
  logError(taskId: string, message: string, metadata?: any, instanceId?: string): Promise<TaskLog>;

  /**
   * Log heartbeat
   */
  logHeartbeat(taskId: string, instanceId: string, message?: string): Promise<TaskLog>;

  /**
   * Get total elapsed time for a task
   */
  getTaskElapsedTime(taskId: string): Promise<number | null>;
}

/**
 * Task log repository implementation
 */
export class TaskLogRepository extends BaseRepository<TaskLog, number> implements ITaskLogRepository {
  constructor(db: DatabaseManager = database) {
    super(db, 'task_logs');
  }

  /**
   * Find log by ID
   */
  async findById(id: number): Promise<TaskLog | null> {
    const log = await this.db.queryOne<any>(
      `SELECT * FROM task_logs WHERE id = ?`,
      [id]
    );

    if (!log) {
      return null;
    }

    return this.mapLogFromDb(log);
  }

  /**
   * Find logs for a task with optional pagination
   */
  async findByTaskId(taskId: string, options?: { offset?: number; limit?: number }): Promise<TaskLog[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const logs = await this.db.query<any>(
      `
      SELECT * FROM task_logs 
      WHERE task_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
      `,
      [taskId, limit, offset]
    );

    return this.mapLogsWithElapsedTime(logs, taskId);
  }

  /**
   * Find logs for an instance with optional pagination
   */
  async findByInstanceId(instanceId: string, options?: { offset?: number; limit?: number }): Promise<TaskLog[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const logs = await this.db.query<any>(
      `
      SELECT * FROM task_logs 
      WHERE instance_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
      `,
      [instanceId, limit, offset]
    );

    return logs.map(log => this.mapLogFromDb(log));
  }

  /**
   * Find logs for a task with a specific log type
   */
  async findByTaskIdAndType(taskId: string, type: LogType, options?: { offset?: number; limit?: number }): Promise<TaskLog[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const logs = await this.db.query<any>(
      `
      SELECT * FROM task_logs 
      WHERE task_id = ? AND type = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
      `,
      [taskId, type, limit, offset]
    );

    return this.mapLogsWithElapsedTime(logs, taskId);
  }

  /**
   * Search logs with various criteria
   */
  async search(options: LogSearchOptions): Promise<TaskLog[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.taskId) {
      conditions.push('task_id = ?');
      params.push(options.taskId);
    }

    if (options.instanceId) {
      conditions.push('instance_id = ?');
      params.push(options.instanceId);
    }

    if (options.type) {
      if (Array.isArray(options.type)) {
        conditions.push(`type IN (${this.generatePlaceholders(options.type.length)})`);
        params.push(...options.type);
      } else {
        conditions.push('type = ?');
        params.push(options.type);
      }
    }

    if (options.level) {
      if (Array.isArray(options.level)) {
        conditions.push(`level IN (${this.generatePlaceholders(options.level.length)})`);
        params.push(...options.level);
      } else {
        conditions.push('level = ?');
        params.push(options.level);
      }
    }

    if (options.fromTimestamp) {
      conditions.push('timestamp >= ?');
      params.push(options.fromTimestamp.toISOString());
    }

    if (options.toTimestamp) {
      conditions.push('timestamp <= ?');
      params.push(options.toTimestamp.toISOString());
    }

    if (options.message) {
      conditions.push('message LIKE ?');
      params.push(`%${options.message}%`);
    }

    let sql = 'SELECT * FROM task_logs';

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add order by clause
    const orderBy = options.orderBy || 'timestamp';
    const orderDirection = options.orderDirection || 'desc';
    sql += ` ORDER BY ${orderBy} ${orderDirection}`;

    // Add pagination
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const logs = await this.db.query<any>(sql, params);
    
    if (options.taskId) {
      return this.mapLogsWithElapsedTime(logs, options.taskId);
    }
    
    return logs.map(log => this.mapLogFromDb(log));
  }

  /**
   * Create a new log entry
   */
  async create(log: Omit<TaskLog, 'id'>): Promise<TaskLog> {
    const timestamp = log.timestamp || new Date().toISOString();

    const result = await this.db.execute(
      `
      INSERT INTO task_logs (
        task_id, instance_id, type, level, message, 
        progress, status, timestamp, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        log.taskId,
        log.instanceId || null,
        log.type,
        log.level,
        log.message,
        log.progress || null,
        log.status || null,
        timestamp,
        this.serialize(log.metadata)
      ]
    );

    // Return the created log with ID
    return {
      id: result.lastID,
      ...log,
      timestamp
    };
  }

  /**
   * Log progress update
   */
  async logProgress(taskId: string, progress: number, message: string, instanceId?: string): Promise<TaskLog> {
    return this.create({
      taskId,
      instanceId,
      type: LogType.PROGRESS,
      level: LogLevel.INFO,
      message,
      progress,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log status update
   */
  async logStatus(taskId: string, status: string, message: string, instanceId?: string): Promise<TaskLog> {
    return this.create({
      taskId,
      instanceId,
      type: LogType.STATUS,
      level: LogLevel.INFO,
      message,
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log error message
   */
  async logError(taskId: string, message: string, metadata?: any, instanceId?: string): Promise<TaskLog> {
    return this.create({
      taskId,
      instanceId,
      type: LogType.ERROR,
      level: LogLevel.ERROR,
      message,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log heartbeat
   */
  async logHeartbeat(taskId: string, instanceId: string, message?: string): Promise<TaskLog> {
    return this.create({
      taskId,
      instanceId,
      type: LogType.HEARTBEAT,
      level: LogLevel.DEBUG,
      message: message || 'Instance heartbeat',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get total elapsed time for a task
   */
  async getTaskElapsedTime(taskId: string): Promise<number | null> {
    // Get the task's start time from the logs
    const startLog = await this.db.queryOne<any>(
      `
      SELECT * FROM task_logs 
      WHERE task_id = ? AND type = ? AND status = ?
      ORDER BY timestamp ASC
      LIMIT 1
      `,
      [taskId, LogType.STATUS, 'running']
    );

    if (!startLog) {
      return null;
    }

    // Get the task's end time from the logs or use current time if task is still running
    const endLog = await this.db.queryOne<any>(
      `
      SELECT * FROM task_logs 
      WHERE task_id = ? AND type = ? AND status IN ('completed', 'failed', 'cancelled', 'timeout')
      ORDER BY timestamp DESC
      LIMIT 1
      `,
      [taskId, LogType.STATUS]
    );

    const startTime = new Date(startLog.timestamp).getTime();
    const endTime = endLog
      ? new Date(endLog.timestamp).getTime()
      : new Date().getTime();

    return endTime - startTime;
  }

  /**
   * Count logs
   */
  async count(): Promise<number> {
    const result = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM task_logs'
    );
    
    return result ? result.count : 0;
  }

  /**
   * Map database log row to TaskLog model
   */
  private mapLogFromDb(row: any): TaskLog {
    return {
      id: row.id,
      taskId: row.task_id,
      instanceId: row.instance_id,
      type: row.type as LogType,
      level: row.level as LogLevel,
      message: row.message,
      progress: row.progress,
      status: row.status,
      timestamp: row.timestamp,
      metadata: this.deserialize(row.metadata)
    };
  }

  /**
   * Map logs and add elapsed time
   */
  private async mapLogsWithElapsedTime(logs: any[], taskId: string): Promise<TaskLog[]> {
    // Get the task's start time from the logs
    const startLog = await this.db.queryOne<any>(
      `
      SELECT * FROM task_logs 
      WHERE task_id = ? AND type = ? AND status = ?
      ORDER BY timestamp ASC
      LIMIT 1
      `,
      [taskId, LogType.STATUS, 'running']
    );

    if (!startLog) {
      return logs.map(log => this.mapLogFromDb(log));
    }

    const startTime = new Date(startLog.timestamp).getTime();

    return logs.map(log => {
      const mappedLog = this.mapLogFromDb(log);
      const logTime = new Date(mappedLog.timestamp).getTime();
      mappedLog.elapsedTime = logTime - startTime;
      return mappedLog;
    });
  }

  /**
   * Update is not supported for logs
   */
  async update(id: number, entity: Partial<TaskLog>): Promise<boolean> {
    // Logs are immutable, so no update is supported
    return false;
  }
}

// Export singleton instance
export const taskLogRepository = new TaskLogRepository(database);