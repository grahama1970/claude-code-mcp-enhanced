/**
 * Instance Repository
 * 
 * Manages persistence operations for Claude instances.
 */

import { BaseRepository } from './base-repository';
import { Instance, InstanceStatus, InstanceMetrics, InstanceConfig } from '../models/instance';
import { DatabaseManager, database } from '../database';

/**
 * Instance repository interface
 */
export interface IInstanceRepository {
  /**
   * Find instance by ID
   */
  findById(id: string): Promise<Instance | null>;

  /**
   * Find all instances with optional pagination
   */
  findAll(options?: { offset?: number; limit?: number }): Promise<Instance[]>;

  /**
   * Find instances by status
   */
  findByStatus(status: InstanceStatus, options?: { offset?: number; limit?: number }): Promise<Instance[]>;

  /**
   * Find instances with missed heartbeats (potential timeouts)
   */
  findWithMissedHeartbeats(thresholdSeconds: number): Promise<Instance[]>;

  /**
   * Find instance by task ID
   */
  findByTaskId(taskId: string): Promise<Instance | null>;

  /**
   * Create a new instance
   */
  create(instance: Omit<Instance, 'createdAt' | 'updatedAt'>): Promise<Instance>;

  /**
   * Update instance status
   */
  updateStatus(id: string, status: InstanceStatus): Promise<boolean>;

  /**
   * Update instance task
   */
  updateTask(id: string, taskId: string | null): Promise<boolean>;

  /**
   * Update instance metrics
   */
  updateMetrics(id: string, metrics: Partial<InstanceMetrics>): Promise<boolean>;

  /**
   * Update instance heartbeat
   */
  updateHeartbeat(id: string): Promise<boolean>;

  /**
   * Mark instance as idle
   */
  markAsIdle(id: string): Promise<boolean>;

  /**
   * Mark instance as terminated
   */
  markAsTerminated(id: string): Promise<boolean>;
}

/**
 * Instance repository implementation
 */
export class InstanceRepository extends BaseRepository<Instance, string> implements IInstanceRepository {
  constructor(db: DatabaseManager = database) {
    super(db, 'instances');
  }

  /**
   * Find instance by ID
   */
  async findById(id: string): Promise<Instance | null> {
    const instance = await this.db.queryOne<any>(
      `SELECT * FROM instances WHERE id = ?`,
      [id]
    );

    if (!instance) {
      return null;
    }

    return this.mapInstanceFromDb(instance);
  }

  /**
   * Find all instances with optional pagination
   */
  async findAll(options?: { offset?: number; limit?: number }): Promise<Instance[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const instances = await this.db.query<any>(
      `SELECT * FROM instances ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return instances.map(instance => this.mapInstanceFromDb(instance));
  }

  /**
   * Find instances by status
   */
  async findByStatus(status: InstanceStatus, options?: { offset?: number; limit?: number }): Promise<Instance[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const instances = await this.db.query<any>(
      `
      SELECT * FROM instances 
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [status, limit, offset]
    );

    return instances.map(instance => this.mapInstanceFromDb(instance));
  }

  /**
   * Find instances with missed heartbeats (potential timeouts)
   */
  async findWithMissedHeartbeats(thresholdSeconds: number): Promise<Instance[]> {
    // Calculate the threshold timestamp
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - (thresholdSeconds * 1000));
    const thresholdTimestamp = thresholdDate.toISOString();

    const instances = await this.db.query<any>(
      `
      SELECT * FROM instances 
      WHERE status = ? 
      AND last_heartbeat_at < ?
      ORDER BY last_heartbeat_at ASC
      `,
      [InstanceStatus.RUNNING, thresholdTimestamp]
    );

    return instances.map(instance => {
      const mappedInstance = this.mapInstanceFromDb(instance);
      
      // Calculate heartbeat age in seconds
      const lastHeartbeat = new Date(mappedInstance.lastHeartbeatAt).getTime();
      const nowTime = now.getTime();
      mappedInstance.heartbeatAge = Math.floor((nowTime - lastHeartbeat) / 1000);
      
      return mappedInstance;
    });
  }

  /**
   * Find instance by task ID
   */
  async findByTaskId(taskId: string): Promise<Instance | null> {
    const instance = await this.db.queryOne<any>(
      `SELECT * FROM instances WHERE current_task_id = ?`,
      [taskId]
    );

    if (!instance) {
      return null;
    }

    return this.mapInstanceFromDb(instance);
  }

  /**
   * Create a new instance
   */
  async create(instance: Omit<Instance, 'createdAt' | 'updatedAt'>): Promise<Instance> {
    const now = new Date().toISOString();

    // Ensure required fields
    if (!instance.metrics) {
      instance.metrics = {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        timeoutTasks: 0,
        cancelledTasks: 0,
        totalTaskTime: 0,
        errorRate: 0,
        timeoutRate: 0
      };
    }

    if (!instance.config) {
      instance.config = {
        taskTimeout: 300000 // 5 minutes default
      };
    }

    await this.db.execute(
      `
      INSERT INTO instances (
        id, status, current_task_id, metrics, config, 
        created_at, last_used_at, last_heartbeat_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        instance.id,
        instance.status,
        instance.currentTaskId || null,
        this.serialize(instance.metrics),
        this.serialize(instance.config),
        now,
        now,
        now,
        now
      ]
    );

    return {
      ...instance,
      createdAt: now,
      lastUsedAt: now,
      lastHeartbeatAt: now,
      updatedAt: now
    };
  }

  /**
   * Update instance status
   */
  async updateStatus(id: string, status: InstanceStatus): Promise<boolean> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      'UPDATE instances SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Update instance task
   */
  async updateTask(id: string, taskId: string | null): Promise<boolean> {
    const now = new Date().toISOString();

    // If setting a task, update status to RUNNING, otherwise to IDLE
    const status = taskId ? InstanceStatus.RUNNING : InstanceStatus.IDLE;

    const result = await this.db.execute(
      'UPDATE instances SET current_task_id = ?, status = ?, last_used_at = ?, updated_at = ? WHERE id = ?',
      [taskId, status, now, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Update instance metrics
   */
  async updateMetrics(id: string, metrics: Partial<InstanceMetrics>): Promise<boolean> {
    const now = new Date().toISOString();

    // Get current metrics
    const instance = await this.findById(id);
    if (!instance) {
      return false;
    }

    // Merge existing metrics with updates
    const updatedMetrics = {
      ...instance.metrics,
      ...metrics
    };

    // Update error and timeout rates
    if (updatedMetrics.totalTasks > 0) {
      updatedMetrics.errorRate = updatedMetrics.failedTasks / updatedMetrics.totalTasks;
      updatedMetrics.timeoutRate = updatedMetrics.timeoutTasks / updatedMetrics.totalTasks;
    }

    const result = await this.db.execute(
      'UPDATE instances SET metrics = ?, updated_at = ? WHERE id = ?',
      [this.serialize(updatedMetrics), now, id]
    );

    return result.changes > 0;
  }

  /**
   * Update instance heartbeat
   */
  async updateHeartbeat(id: string): Promise<boolean> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      'UPDATE instances SET last_heartbeat_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Mark instance as idle
   */
  async markAsIdle(id: string): Promise<boolean> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      'UPDATE instances SET status = ?, current_task_id = NULL, last_used_at = ?, updated_at = ? WHERE id = ?',
      [InstanceStatus.IDLE, now, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Mark instance as terminated
   */
  async markAsTerminated(id: string): Promise<boolean> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      'UPDATE instances SET status = ?, updated_at = ? WHERE id = ?',
      [InstanceStatus.TERMINATED, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Map database instance row to Instance model
   */
  private mapInstanceFromDb(row: any): Instance {
    const now = new Date();
    const lastHeartbeat = new Date(row.last_heartbeat_at);
    
    // Calculate heartbeat age in seconds
    const heartbeatAge = Math.floor((now.getTime() - lastHeartbeat.getTime()) / 1000);

    return {
      id: row.id,
      status: row.status as InstanceStatus,
      currentTaskId: row.current_task_id,
      metrics: this.deserialize<InstanceMetrics>(row.metrics) || {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        timeoutTasks: 0,
        cancelledTasks: 0,
        totalTaskTime: 0,
        errorRate: 0,
        timeoutRate: 0
      },
      config: this.deserialize<InstanceConfig>(row.config) || {
        taskTimeout: 300000
      },
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      lastHeartbeatAt: row.last_heartbeat_at,
      updatedAt: row.updated_at,
      heartbeatAge
    };
  }

  /**
   * Count all instances
   */
  async count(): Promise<number> {
    const result = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM instances'
    );
    
    return result ? result.count : 0;
  }

  /**
   * Update an instance
   */
  async update(id: string, entity: Partial<Instance>): Promise<boolean> {
    const now = new Date().toISOString();
    
    // Convert entity to DB columns
    const updates: string[] = [];
    const params: any[] = [];
    
    // Handle regular fields
    if (entity.status !== undefined) {
      updates.push('status = ?');
      params.push(entity.status);
    }
    
    if (entity.currentTaskId !== undefined) {
      updates.push('current_task_id = ?');
      params.push(entity.currentTaskId);
    }
    
    if (entity.metrics !== undefined) {
      updates.push('metrics = ?');
      params.push(this.serialize(entity.metrics));
    }
    
    if (entity.config !== undefined) {
      updates.push('config = ?');
      params.push(this.serialize(entity.config));
    }
    
    if (entity.lastUsedAt !== undefined) {
      updates.push('last_used_at = ?');
      params.push(entity.lastUsedAt);
    }
    
    if (entity.lastHeartbeatAt !== undefined) {
      updates.push('last_heartbeat_at = ?');
      params.push(entity.lastHeartbeatAt);
    }
    
    // Always update the updated_at timestamp
    updates.push('updated_at = ?');
    params.push(now);
    
    // Don't update if no fields were specified
    if (updates.length === 0) {
      return false;
    }
    
    // Add the ID parameter
    params.push(id);
    
    const result = await this.db.execute(
      `UPDATE instances SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return result.changes > 0;
  }
}

// Export singleton instance
export const instanceRepository = new InstanceRepository(database);