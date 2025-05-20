/**
 * Instance Telemetry Repository
 * 
 * Manages persistence operations for instance telemetry data.
 */

import { BaseRepository } from './base-repository';
import { InstanceTelemetry, TelemetryType } from '../models/instance-telemetry';
import { DatabaseManager, database } from '../database';

/**
 * Telemetry search options
 */
export interface TelemetrySearchOptions {
  instanceId?: string;
  taskId?: string;
  type?: TelemetryType | TelemetryType[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
  minValue?: number;
  maxValue?: number;
  metricName?: string;
  offset?: number;
  limit?: number;
  orderBy?: 'timestamp' | 'value' | 'id';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Instance telemetry repository interface
 */
export interface IInstanceTelemetryRepository {
  /**
   * Find telemetry by ID
   */
  findById(id: number): Promise<InstanceTelemetry | null>;

  /**
   * Find telemetry for an instance with optional pagination
   */
  findByInstanceId(instanceId: string, options?: { offset?: number; limit?: number }): Promise<InstanceTelemetry[]>;

  /**
   * Find telemetry for a task with optional pagination
   */
  findByTaskId(taskId: string, options?: { offset?: number; limit?: number }): Promise<InstanceTelemetry[]>;

  /**
   * Find telemetry with a specific type
   */
  findByType(type: TelemetryType, options?: { offset?: number; limit?: number }): Promise<InstanceTelemetry[]>;

  /**
   * Find telemetry for a specific time range
   */
  findByTimeRange(fromTimestamp: Date, toTimestamp: Date, options?: { offset?: number; limit?: number }): Promise<InstanceTelemetry[]>;

  /**
   * Search telemetry with various criteria
   */
  search(options: TelemetrySearchOptions): Promise<InstanceTelemetry[]>;

  /**
   * Create new telemetry data
   */
  create(telemetry: Omit<InstanceTelemetry, 'id'>): Promise<InstanceTelemetry>;

  /**
   * Record instance heartbeat
   */
  recordHeartbeat(instanceId: string, taskId?: string, metadata?: any): Promise<InstanceTelemetry>;

  /**
   * Record instance timeout
   */
  recordTimeout(instanceId: string, taskId?: string, timeoutDuration?: number, metadata?: any): Promise<InstanceTelemetry>;

  /**
   * Record performance metric
   */
  recordPerformanceMetric(
    instanceId: string,
    metricName: string,
    value: number,
    taskId?: string,
    metadata?: any
  ): Promise<InstanceTelemetry>;

  /**
   * Record resource usage
   */
  recordResourceUsage(
    instanceId: string,
    resourceType: string,
    value: number,
    taskId?: string,
    metadata?: any
  ): Promise<InstanceTelemetry>;

  /**
   * Get average value for a metric
   */
  getAverageMetric(
    instanceId: string,
    metricName: string,
    fromTimestamp?: Date,
    toTimestamp?: Date
  ): Promise<number | null>;

  /**
   * Check if instance missed heartbeats
   */
  hasMissedHeartbeats(instanceId: string, thresholdSeconds: number): Promise<boolean>;
}

/**
 * Instance telemetry repository implementation
 */
export class InstanceTelemetryRepository extends BaseRepository<InstanceTelemetry, number> implements IInstanceTelemetryRepository {
  constructor(db: DatabaseManager = database) {
    super(db, 'instance_telemetry');
  }

  /**
   * Find telemetry by ID
   */
  async findById(id: number): Promise<InstanceTelemetry | null> {
    const telemetry = await this.db.queryOne<any>(
      `SELECT * FROM instance_telemetry WHERE id = ?`,
      [id]
    );

    if (!telemetry) {
      return null;
    }

    return this.mapTelemetryFromDb(telemetry);
  }

  /**
   * Find telemetry for an instance with optional pagination
   */
  async findByInstanceId(instanceId: string, options?: { offset?: number; limit?: number }): Promise<InstanceTelemetry[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const telemetry = await this.db.query<any>(
      `
      SELECT * FROM instance_telemetry 
      WHERE instance_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
      `,
      [instanceId, limit, offset]
    );

    return telemetry.map(t => this.mapTelemetryFromDb(t));
  }

  /**
   * Find telemetry for a task with optional pagination
   */
  async findByTaskId(taskId: string, options?: { offset?: number; limit?: number }): Promise<InstanceTelemetry[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const telemetry = await this.db.query<any>(
      `
      SELECT * FROM instance_telemetry 
      WHERE task_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
      `,
      [taskId, limit, offset]
    );

    return telemetry.map(t => this.mapTelemetryFromDb(t));
  }

  /**
   * Find telemetry with a specific type
   */
  async findByType(type: TelemetryType, options?: { offset?: number; limit?: number }): Promise<InstanceTelemetry[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const telemetry = await this.db.query<any>(
      `
      SELECT * FROM instance_telemetry 
      WHERE type = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
      `,
      [type, limit, offset]
    );

    return telemetry.map(t => this.mapTelemetryFromDb(t));
  }

  /**
   * Find telemetry for a specific time range
   */
  async findByTimeRange(fromTimestamp: Date, toTimestamp: Date, options?: { offset?: number; limit?: number }): Promise<InstanceTelemetry[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const telemetry = await this.db.query<any>(
      `
      SELECT * FROM instance_telemetry 
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
      `,
      [fromTimestamp.toISOString(), toTimestamp.toISOString(), limit, offset]
    );

    return telemetry.map(t => this.mapTelemetryFromDb(t));
  }

  /**
   * Search telemetry with various criteria
   */
  async search(options: TelemetrySearchOptions): Promise<InstanceTelemetry[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.instanceId) {
      conditions.push('instance_id = ?');
      params.push(options.instanceId);
    }

    if (options.taskId) {
      conditions.push('task_id = ?');
      params.push(options.taskId);
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

    if (options.fromTimestamp) {
      conditions.push('timestamp >= ?');
      params.push(options.fromTimestamp.toISOString());
    }

    if (options.toTimestamp) {
      conditions.push('timestamp <= ?');
      params.push(options.toTimestamp.toISOString());
    }

    if (options.minValue !== undefined) {
      conditions.push('value >= ?');
      params.push(options.minValue);
    }

    if (options.maxValue !== undefined) {
      conditions.push('value <= ?');
      params.push(options.maxValue);
    }

    if (options.metricName) {
      conditions.push(`EXISTS (
        SELECT 1 FROM json_each(metadata) 
        WHERE key = 'metricName' AND value = ?
      )`);
      params.push(options.metricName);
    }

    let sql = 'SELECT * FROM instance_telemetry';

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
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const telemetry = await this.db.query<any>(sql, params);
    return telemetry.map(t => this.mapTelemetryFromDb(t));
  }

  /**
   * Create new telemetry data
   */
  async create(telemetry: Omit<InstanceTelemetry, 'id'>): Promise<InstanceTelemetry> {
    const timestamp = telemetry.timestamp || new Date().toISOString();

    // Get telemetry metadata with computed fields
    const metadata = this.extractTelemetryMetadata(telemetry);

    const result = await this.db.execute(
      `
      INSERT INTO instance_telemetry (
        instance_id, task_id, type, timestamp, value, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        telemetry.instanceId,
        telemetry.taskId || null,
        telemetry.type,
        timestamp,
        telemetry.value,
        this.serialize(metadata)
      ]
    );

    return {
      id: result.lastID,
      ...telemetry,
      timestamp,
      metadata,
      // Add computed fields based on metadata
      metricName: metadata?.metricName,
      metricUnit: metadata?.metricUnit,
      metricThreshold: metadata?.metricThreshold,
      exceededThreshold: metadata?.exceededThreshold
    };
  }

  /**
   * Record instance heartbeat
   */
  async recordHeartbeat(instanceId: string, taskId?: string, metadata?: any): Promise<InstanceTelemetry> {
    const now = new Date();
    const combinedMetadata = {
      ...metadata,
      metricName: 'heartbeat',
      timestamp: now.toISOString()
    };
    
    return this.create({
      instanceId,
      taskId,
      type: TelemetryType.HEARTBEAT,
      timestamp: now.toISOString(),
      value: 1, // 1 = heartbeat received
      metadata: combinedMetadata
    });
  }

  /**
   * Record instance timeout
   */
  async recordTimeout(instanceId: string, taskId?: string, timeoutDuration?: number, metadata?: any): Promise<InstanceTelemetry> {
    const now = new Date();
    const combinedMetadata = {
      ...metadata,
      metricName: 'timeout',
      timeoutDuration,
      timestamp: now.toISOString()
    };
    
    return this.create({
      instanceId,
      taskId,
      type: TelemetryType.TIMEOUT,
      timestamp: now.toISOString(),
      value: timeoutDuration || 0,
      metadata: combinedMetadata
    });
  }

  /**
   * Record performance metric
   */
  async recordPerformanceMetric(
    instanceId: string,
    metricName: string,
    value: number,
    taskId?: string,
    metadata?: any
  ): Promise<InstanceTelemetry> {
    const now = new Date();
    
    // Get threshold from metadata or default values
    const metricThreshold = metadata?.threshold;
    const exceededThreshold = metricThreshold !== undefined && value > metricThreshold;
    
    // Get unit from metadata
    const metricUnit = metadata?.unit;
    
    const combinedMetadata = {
      ...metadata,
      metricName,
      metricUnit,
      metricThreshold,
      exceededThreshold,
      timestamp: now.toISOString()
    };
    
    return this.create({
      instanceId,
      taskId,
      type: TelemetryType.PERFORMANCE,
      timestamp: now.toISOString(),
      value,
      metadata: combinedMetadata
    });
  }

  /**
   * Record resource usage
   */
  async recordResourceUsage(
    instanceId: string,
    resourceType: string,
    value: number,
    taskId?: string,
    metadata?: any
  ): Promise<InstanceTelemetry> {
    const now = new Date();
    
    // Get threshold from metadata or default values
    const metricThreshold = metadata?.threshold;
    const exceededThreshold = metricThreshold !== undefined && value > metricThreshold;
    
    // Get unit from metadata
    const metricUnit = metadata?.unit || resourceType === 'memory' ? 'MB' : 'percent';
    
    const combinedMetadata = {
      ...metadata,
      metricName: `${resourceType}_usage`,
      resourceType,
      metricUnit,
      metricThreshold,
      exceededThreshold,
      timestamp: now.toISOString()
    };
    
    return this.create({
      instanceId,
      taskId,
      type: TelemetryType.RESOURCE,
      timestamp: now.toISOString(),
      value,
      metadata: combinedMetadata
    });
  }

  /**
   * Get average value for a metric
   */
  async getAverageMetric(
    instanceId: string,
    metricName: string,
    fromTimestamp?: Date,
    toTimestamp?: Date
  ): Promise<number | null> {
    // Build conditions for the query
    const conditions: string[] = [
      'instance_id = ?',
      `EXISTS (
        SELECT 1 FROM json_each(metadata) 
        WHERE key = 'metricName' AND value = ?
      )`
    ];
    
    const params: any[] = [instanceId, metricName];
    
    if (fromTimestamp) {
      conditions.push('timestamp >= ?');
      params.push(fromTimestamp.toISOString());
    }
    
    if (toTimestamp) {
      conditions.push('timestamp <= ?');
      params.push(toTimestamp.toISOString());
    }
    
    const result = await this.db.queryOne<{ avg_value: number }>(
      `
      SELECT AVG(value) as avg_value
      FROM instance_telemetry
      WHERE ${conditions.join(' AND ')}
      `,
      params
    );
    
    return result ? result.avg_value : null;
  }

  /**
   * Check if instance missed heartbeats
   */
  async hasMissedHeartbeats(instanceId: string, thresholdSeconds: number): Promise<boolean> {
    // Calculate the threshold timestamp
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - (thresholdSeconds * 1000));
    const thresholdTimestamp = thresholdDate.toISOString();
    
    // Get the latest heartbeat for the instance
    const latestHeartbeat = await this.db.queryOne<{ timestamp: string }>(
      `
      SELECT timestamp
      FROM instance_telemetry
      WHERE instance_id = ? AND type = ?
      ORDER BY timestamp DESC
      LIMIT 1
      `,
      [instanceId, TelemetryType.HEARTBEAT]
    );
    
    // If no heartbeat or the latest heartbeat is older than the threshold
    if (!latestHeartbeat || latestHeartbeat.timestamp < thresholdTimestamp) {
      return true;
    }
    
    return false;
  }

  /**
   * Map database telemetry row to InstanceTelemetry model
   */
  private mapTelemetryFromDb(row: any): InstanceTelemetry {
    const metadata = this.deserialize(row.metadata);
    
    return {
      id: row.id,
      instanceId: row.instance_id,
      taskId: row.task_id,
      type: row.type as TelemetryType,
      timestamp: row.timestamp,
      value: row.value,
      metadata,
      // Add computed fields based on metadata
      metricName: metadata?.metricName,
      metricUnit: metadata?.metricUnit,
      metricThreshold: metadata?.metricThreshold,
      exceededThreshold: metadata?.exceededThreshold
    };
  }

  /**
   * Extract telemetry metadata including computed fields
   */
  private extractTelemetryMetadata(telemetry: Partial<InstanceTelemetry>): any {
    const metadata = telemetry.metadata || {};
    
    // Add metricName if it exists in the telemetry object
    if (telemetry.metricName && !metadata.metricName) {
      metadata.metricName = telemetry.metricName;
    }
    
    // Add metricUnit if it exists in the telemetry object
    if (telemetry.metricUnit && !metadata.metricUnit) {
      metadata.metricUnit = telemetry.metricUnit;
    }
    
    // Add metricThreshold if it exists in the telemetry object
    if (telemetry.metricThreshold !== undefined && metadata.metricThreshold === undefined) {
      metadata.metricThreshold = telemetry.metricThreshold;
    }
    
    // Add exceededThreshold if it exists in the telemetry object
    if (telemetry.exceededThreshold !== undefined && metadata.exceededThreshold === undefined) {
      metadata.exceededThreshold = telemetry.exceededThreshold;
    } else if (metadata.metricThreshold !== undefined && telemetry.value !== undefined) {
      // Calculate exceededThreshold if not provided
      metadata.exceededThreshold = telemetry.value > metadata.metricThreshold;
    }
    
    return metadata;
  }

  /**
   * Count all telemetry records
   */
  async count(): Promise<number> {
    const result = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM instance_telemetry'
    );
    
    return result ? result.count : 0;
  }

  /**
   * Update is not supported for telemetry
   */
  async update(id: number, entity: Partial<InstanceTelemetry>): Promise<boolean> {
    // Telemetry data is immutable, so updates are not supported
    return false;
  }
}

// Export singleton instance
export const instanceTelemetryRepository = new InstanceTelemetryRepository(database);