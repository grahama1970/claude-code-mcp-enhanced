/**
 * Task Result Repository
 * 
 * Manages persistence operations for task results.
 */

import { BaseRepository } from './base-repository';
import { TaskResult, ResultStatus } from '../models/task-result';
import { DatabaseManager, database } from '../database';

/**
 * Task result repository interface
 */
export interface ITaskResultRepository {
  /**
   * Find result by ID
   */
  findById(id: number): Promise<TaskResult | null>;

  /**
   * Find result by task ID
   */
  findByTaskId(taskId: string): Promise<TaskResult | null>;

  /**
   * Create a new result
   */
  create(result: Omit<TaskResult, 'id'>): Promise<TaskResult>;

  /**
   * Search for results with specified criteria
   */
  search(options: {
    status?: ResultStatus | ResultStatus[];
    instanceId?: string;
    minExecutionTime?: number;
    maxExecutionTime?: number;
    fromTimestamp?: Date;
    toTimestamp?: Date;
    offset?: number;
    limit?: number;
  }): Promise<TaskResult[]>;

  /**
   * Get success rate for instance
   */
  getSuccessRateForInstance(instanceId: string): Promise<number>;

  /**
   * Create success result
   */
  createSuccess(
    taskId: string,
    output: string,
    executionTime: number,
    instanceId?: string,
    metadata?: any
  ): Promise<TaskResult>;

  /**
   * Create error result
   */
  createError(
    taskId: string,
    error: string,
    executionTime: number,
    instanceId?: string,
    metadata?: any
  ): Promise<TaskResult>;

  /**
   * Create timeout result
   */
  createTimeout(
    taskId: string,
    executionTime: number,
    instanceId?: string,
    metadata?: any
  ): Promise<TaskResult>;

  /**
   * Create cancelled result
   */
  createCancelled(
    taskId: string,
    executionTime: number,
    instanceId?: string,
    metadata?: any
  ): Promise<TaskResult>;
}

/**
 * Task result repository implementation
 */
export class TaskResultRepository extends BaseRepository<TaskResult, number> implements ITaskResultRepository {
  constructor(db: DatabaseManager = database) {
    super(db, 'task_results');
  }

  /**
   * Find result by ID
   */
  async findById(id: number): Promise<TaskResult | null> {
    const result = await this.db.queryOne<any>(
      `SELECT * FROM task_results WHERE id = ?`,
      [id]
    );

    if (!result) {
      return null;
    }

    return this.mapResultFromDb(result);
  }

  /**
   * Find result by task ID
   */
  async findByTaskId(taskId: string): Promise<TaskResult | null> {
    const result = await this.db.queryOne<any>(
      `SELECT * FROM task_results WHERE task_id = ?`,
      [taskId]
    );

    if (!result) {
      return null;
    }

    return this.mapResultFromDb(result);
  }

  /**
   * Create a new result
   */
  async create(result: Omit<TaskResult, 'id'>): Promise<TaskResult> {
    const timestamp = result.timestamp || new Date().toISOString();

    // Task results have a UNIQUE constraint on task_id, so we need to
    // handle the case where a result already exists
    const existingResult = await this.findByTaskId(result.taskId);
    
    if (existingResult) {
      // Update the existing result
      await this.db.execute(
        `
        UPDATE task_results SET
        status = ?, output = ?, error = ?, execution_time = ?, 
        instance_id = ?, timestamp = ?, metadata = ?
        WHERE task_id = ?
        `,
        [
          result.status,
          result.output,
          result.error || null,
          result.executionTime,
          result.instanceId || null,
          timestamp,
          this.serialize(result.metadata),
          result.taskId
        ]
      );
      
      return {
        id: existingResult.id,
        ...result,
        timestamp
      };
    } else {
      // Create a new result
      const insertResult = await this.db.execute(
        `
        INSERT INTO task_results (
          task_id, instance_id, status, output, 
          error, execution_time, timestamp, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          result.taskId,
          result.instanceId || null,
          result.status,
          result.output,
          result.error || null,
          result.executionTime,
          timestamp,
          this.serialize(result.metadata)
        ]
      );
      
      return {
        id: insertResult.lastID,
        ...result,
        timestamp
      };
    }
  }

  /**
   * Search for results with specified criteria
   */
  async search(options: {
    status?: ResultStatus | ResultStatus[];
    instanceId?: string;
    minExecutionTime?: number;
    maxExecutionTime?: number;
    fromTimestamp?: Date;
    toTimestamp?: Date;
    offset?: number;
    limit?: number;
  }): Promise<TaskResult[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.status) {
      if (Array.isArray(options.status)) {
        conditions.push(`status IN (${this.generatePlaceholders(options.status.length)})`);
        params.push(...options.status);
      } else {
        conditions.push('status = ?');
        params.push(options.status);
      }
    }

    if (options.instanceId) {
      conditions.push('instance_id = ?');
      params.push(options.instanceId);
    }

    if (options.minExecutionTime !== undefined) {
      conditions.push('execution_time >= ?');
      params.push(options.minExecutionTime);
    }

    if (options.maxExecutionTime !== undefined) {
      conditions.push('execution_time <= ?');
      params.push(options.maxExecutionTime);
    }

    if (options.fromTimestamp) {
      conditions.push('timestamp >= ?');
      params.push(options.fromTimestamp.toISOString());
    }

    if (options.toTimestamp) {
      conditions.push('timestamp <= ?');
      params.push(options.toTimestamp.toISOString());
    }

    let sql = 'SELECT * FROM task_results';

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add order by timestamp desc
    sql += ' ORDER BY timestamp DESC';

    // Add pagination
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const results = await this.db.query<any>(sql, params);
    return results.map(result => this.mapResultFromDb(result));
  }

  /**
   * Get success rate for instance
   */
  async getSuccessRateForInstance(instanceId: string): Promise<number> {
    const result = await this.db.queryOne<{ 
      total: number; 
      success: number; 
    }>(
      `
      SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as success
      FROM task_results 
      WHERE instance_id = ?
      `,
      [ResultStatus.SUCCESS, instanceId]
    );

    if (!result || result.total === 0) {
      return 0;
    }

    return result.success / result.total;
  }

  /**
   * Create success result
   */
  async createSuccess(
    taskId: string,
    output: string,
    executionTime: number,
    instanceId?: string,
    metadata?: any
  ): Promise<TaskResult> {
    return this.create({
      taskId,
      instanceId,
      status: ResultStatus.SUCCESS,
      output,
      executionTime,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  /**
   * Create error result
   */
  async createError(
    taskId: string,
    error: string,
    executionTime: number,
    instanceId?: string,
    metadata?: any
  ): Promise<TaskResult> {
    return this.create({
      taskId,
      instanceId,
      status: ResultStatus.ERROR,
      output: '', // No output for error results
      error,
      executionTime,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  /**
   * Create timeout result
   */
  async createTimeout(
    taskId: string,
    executionTime: number,
    instanceId?: string,
    metadata?: any
  ): Promise<TaskResult> {
    return this.create({
      taskId,
      instanceId,
      status: ResultStatus.TIMEOUT,
      output: '', // No output for timeout results
      error: 'Task execution timed out',
      executionTime,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  /**
   * Create cancelled result
   */
  async createCancelled(
    taskId: string,
    executionTime: number,
    instanceId?: string,
    metadata?: any
  ): Promise<TaskResult> {
    return this.create({
      taskId,
      instanceId,
      status: ResultStatus.CANCELLED,
      output: '', // No output for cancelled results
      error: 'Task was cancelled',
      executionTime,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  /**
   * Map database result row to TaskResult model
   */
  private mapResultFromDb(row: any): TaskResult {
    return {
      id: row.id,
      taskId: row.task_id,
      instanceId: row.instance_id,
      status: row.status as ResultStatus,
      output: row.output,
      error: row.error,
      executionTime: row.execution_time,
      timestamp: row.timestamp,
      metadata: this.deserialize(row.metadata)
    };
  }

  /**
   * Count all results
   */
  async count(): Promise<number> {
    const result = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM task_results'
    );
    
    return result ? result.count : 0;
  }

  /**
   * Update a result
   */
  async update(id: number, entity: Partial<TaskResult>): Promise<boolean> {
    const now = new Date().toISOString();
    
    // Convert entity to DB columns
    const updates: string[] = [];
    const params: any[] = [];
    
    // Handle regular fields
    if (entity.status !== undefined) {
      updates.push('status = ?');
      params.push(entity.status);
    }
    
    if (entity.output !== undefined) {
      updates.push('output = ?');
      params.push(entity.output);
    }
    
    if (entity.error !== undefined) {
      updates.push('error = ?');
      params.push(entity.error);
    }
    
    if (entity.executionTime !== undefined) {
      updates.push('execution_time = ?');
      params.push(entity.executionTime);
    }
    
    if (entity.instanceId !== undefined) {
      updates.push('instance_id = ?');
      params.push(entity.instanceId);
    }
    
    if (entity.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(this.serialize(entity.metadata));
    }
    
    // Always update the timestamp
    updates.push('timestamp = ?');
    params.push(entity.timestamp || now);
    
    // Don't update if no fields were specified
    if (updates.length === 0) {
      return false;
    }
    
    // Add the ID parameter
    params.push(id);
    
    const result = await this.db.execute(
      `UPDATE task_results SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return result.changes > 0;
  }
}

// Export singleton instance
export const taskResultRepository = new TaskResultRepository(database);