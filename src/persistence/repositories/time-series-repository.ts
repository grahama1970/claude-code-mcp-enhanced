/**
 * Time Series Repository
 * 
 * Manages persistence operations for time series metrics.
 */

import { BaseRepository } from './base-repository';
import { TimeSeriesMetric, MetricType, MetricResolution } from '../models/time-series-metric';
import { DatabaseManager, database } from '../database';

/**
 * Time series search options
 */
export interface TimeSeriesSearchOptions {
  type?: MetricType | MetricType[];
  resolution?: MetricResolution | MetricResolution[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
  minValue?: number;
  maxValue?: number;
  metadataFilters?: Record<string, any>;
  offset?: number;
  limit?: number;
  groupBy?: string;
  orderBy?: 'timestamp' | 'value' | 'id';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Time series aggregation options
 */
export interface TimeSeriesAggregationOptions {
  type: MetricType | MetricType[];
  resolution: MetricResolution;
  fromTimestamp: Date;
  toTimestamp: Date;
  aggregation: 'avg' | 'min' | 'max' | 'sum' | 'count';
  groupByTime?: string; // e.g., 'hour', 'day', 'week', 'month'
  metadataFilters?: Record<string, any>;
}

/**
 * Time series repository interface
 */
export interface ITimeSeriesRepository {
  /**
   * Find metric by ID
   */
  findById(id: number): Promise<TimeSeriesMetric | null>;

  /**
   * Find metrics by type with optional pagination
   */
  findByType(type: MetricType, options?: { offset?: number; limit?: number }): Promise<TimeSeriesMetric[]>;

  /**
   * Find metrics for a specific time range
   */
  findByTimeRange(
    fromTimestamp: Date,
    toTimestamp: Date,
    options?: { type?: MetricType; resolution?: MetricResolution; offset?: number; limit?: number }
  ): Promise<TimeSeriesMetric[]>;

  /**
   * Search metrics with various criteria
   */
  search(options: TimeSeriesSearchOptions): Promise<TimeSeriesMetric[]>;

  /**
   * Get time-bucketed aggregations of metrics
   */
  getAggregations(options: TimeSeriesAggregationOptions): Promise<any[]>;

  /**
   * Create a new metric
   */
  create(metric: Omit<TimeSeriesMetric, 'id'>): Promise<TimeSeriesMetric>;

  /**
   * Record a metric value (creates or updates existing)
   */
  recordMetric(
    type: MetricType,
    value: number,
    resolution: MetricResolution,
    timestamp?: Date,
    metadata?: any
  ): Promise<TimeSeriesMetric>;

  /**
   * Rollup metrics to a higher resolution
   */
  rollupMetrics(
    type: MetricType,
    fromResolution: MetricResolution,
    toResolution: MetricResolution,
    fromTimestamp: Date,
    toTimestamp: Date
  ): Promise<number>;

  /**
   * Record task duration metric
   */
  recordTaskDuration(
    duration: number,
    metadata: { taskId: string; status: string; instanceId?: string },
    timestamp?: Date
  ): Promise<TimeSeriesMetric>;

  /**
   * Get average task duration for a time period
   */
  getAverageTaskDuration(
    fromTimestamp: Date,
    toTimestamp: Date,
    metadataFilters?: Record<string, any>
  ): Promise<number | null>;

  /**
   * Get trend data for a metric type
   */
  getTrendData(
    type: MetricType,
    resolution: MetricResolution,
    fromTimestamp: Date,
    toTimestamp: Date,
    metadataFilters?: Record<string, any>
  ): Promise<any[]>;
}

/**
 * Time series bucket mapping
 */
interface TimeBucketMapping {
  resolution: MetricResolution;
  formatString: string;
}

/**
 * Time series repository implementation
 */
export class TimeSeriesRepository extends BaseRepository<TimeSeriesMetric, number> implements ITimeSeriesRepository {
  private static readonly RESOLUTION_FORMATS: Record<MetricResolution, string> = {
    [MetricResolution.MINUTE]: '%Y-%m-%dT%H:%M:00Z',
    [MetricResolution.HOUR]: '%Y-%m-%dT%H:00:00Z',
    [MetricResolution.DAY]: '%Y-%m-%dT00:00:00Z',
    [MetricResolution.MONTH]: '%Y-%m-01T00:00:00Z'
  };

  private static readonly TIME_BUCKET_MAPPINGS: Record<string, TimeBucketMapping> = {
    'minute': { resolution: MetricResolution.MINUTE, formatString: '%Y-%m-%dT%H:%M:00Z' },
    'hour': { resolution: MetricResolution.HOUR, formatString: '%Y-%m-%dT%H:00:00Z' },
    'day': { resolution: MetricResolution.DAY, formatString: '%Y-%m-%dT00:00:00Z' },
    'month': { resolution: MetricResolution.MONTH, formatString: '%Y-%m-01T00:00:00Z' }
  };

  constructor(db: DatabaseManager = database) {
    super(db, 'time_series_metrics');
  }

  /**
   * Find metric by ID
   */
  async findById(id: number): Promise<TimeSeriesMetric | null> {
    const metric = await this.db.queryOne<any>(
      `SELECT * FROM time_series_metrics WHERE id = ?`,
      [id]
    );

    if (!metric) {
      return null;
    }

    return this.mapMetricFromDb(metric);
  }

  /**
   * Find metrics by type with optional pagination
   */
  async findByType(type: MetricType, options?: { offset?: number; limit?: number }): Promise<TimeSeriesMetric[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const metrics = await this.db.query<any>(
      `
      SELECT * FROM time_series_metrics 
      WHERE type = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
      `,
      [type, limit, offset]
    );

    return metrics.map(metric => this.mapMetricFromDb(metric));
  }

  /**
   * Find metrics for a specific time range
   */
  async findByTimeRange(
    fromTimestamp: Date,
    toTimestamp: Date,
    options?: { type?: MetricType; resolution?: MetricResolution; offset?: number; limit?: number }
  ): Promise<TimeSeriesMetric[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    
    const conditions: string[] = ['timestamp >= ? AND timestamp <= ?'];
    const params: any[] = [fromTimestamp.toISOString(), toTimestamp.toISOString()];
    
    if (options?.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }
    
    if (options?.resolution) {
      conditions.push('resolution = ?');
      params.push(options.resolution);
    }
    
    const metrics = await this.db.query<any>(
      `
      SELECT * FROM time_series_metrics 
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return metrics.map(metric => this.mapMetricFromDb(metric));
  }

  /**
   * Search metrics with various criteria
   */
  async search(options: TimeSeriesSearchOptions): Promise<TimeSeriesMetric[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.type) {
      if (Array.isArray(options.type)) {
        conditions.push(`type IN (${this.generatePlaceholders(options.type.length)})`);
        params.push(...options.type);
      } else {
        conditions.push('type = ?');
        params.push(options.type);
      }
    }

    if (options.resolution) {
      if (Array.isArray(options.resolution)) {
        conditions.push(`resolution IN (${this.generatePlaceholders(options.resolution.length)})`);
        params.push(...options.resolution);
      } else {
        conditions.push('resolution = ?');
        params.push(options.resolution);
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

    // Add metadata filters as JSON conditions
    if (options.metadataFilters) {
      Object.entries(options.metadataFilters).forEach(([key, value]) => {
        conditions.push(`EXISTS (
          SELECT 1 FROM json_each(metadata) 
          WHERE key = ? AND value = ?
        )`);
        params.push(key, JSON.stringify(value));
      });
    }

    let sql = 'SELECT * FROM time_series_metrics';

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add group by clause if specified
    if (options.groupBy) {
      sql += ` GROUP BY ${options.groupBy}`;
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

    const metrics = await this.db.query<any>(sql, params);
    return metrics.map(metric => this.mapMetricFromDb(metric));
  }

  /**
   * Get time-bucketed aggregations of metrics
   */
  async getAggregations(options: TimeSeriesAggregationOptions): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.type) {
      if (Array.isArray(options.type)) {
        conditions.push(`type IN (${this.generatePlaceholders(options.type.length)})`);
        params.push(...options.type);
      } else {
        conditions.push('type = ?');
        params.push(options.type);
      }
    }

    conditions.push('resolution = ?');
    params.push(options.resolution);

    conditions.push('timestamp >= ?');
    params.push(options.fromTimestamp.toISOString());

    conditions.push('timestamp <= ?');
    params.push(options.toTimestamp.toISOString());

    // Add metadata filters as JSON conditions
    if (options.metadataFilters) {
      Object.entries(options.metadataFilters).forEach(([key, value]) => {
        conditions.push(`EXISTS (
          SELECT 1 FROM json_each(metadata) 
          WHERE key = ? AND value = ?
        )`);
        params.push(key, JSON.stringify(value));
      });
    }

    // Determine the aggregation function to use
    let aggregationFn = '';
    switch (options.aggregation) {
      case 'avg':
        aggregationFn = 'AVG(value)';
        break;
      case 'min':
        aggregationFn = 'MIN(value)';
        break;
      case 'max':
        aggregationFn = 'MAX(value)';
        break;
      case 'sum':
        aggregationFn = 'SUM(value)';
        break;
      case 'count':
        aggregationFn = 'COUNT(*)';
        break;
      default:
        aggregationFn = 'AVG(value)';
    }

    let sql = '';

    if (options.groupByTime) {
      // Get the time bucket mapping
      const mapping = TimeSeriesRepository.TIME_BUCKET_MAPPINGS[options.groupByTime];
      
      if (!mapping) {
        throw new Error(`Invalid groupByTime value: ${options.groupByTime}`);
      }
      
      // Use SQLite's strftime function to format the timestamp for grouping
      sql = `
        SELECT 
          strftime('${mapping.formatString}', timestamp) as time_bucket,
          ${aggregationFn} as value,
          COUNT(*) as count,
          MIN(value) as min,
          MAX(value) as max
        FROM time_series_metrics
        WHERE ${conditions.join(' AND ')}
        GROUP BY time_bucket
        ORDER BY time_bucket
      `;
    } else {
      // No time grouping, just return the aggregation over all matching metrics
      sql = `
        SELECT 
          ${aggregationFn} as value,
          COUNT(*) as count,
          MIN(value) as min,
          MAX(value) as max
        FROM time_series_metrics
        WHERE ${conditions.join(' AND ')}
      `;
    }

    return this.db.query<any>(sql, params);
  }

  /**
   * Create a new metric
   */
  async create(metric: Omit<TimeSeriesMetric, 'id'>): Promise<TimeSeriesMetric> {
    const timestamp = metric.timestamp || new Date().toISOString();
    
    // Calculate the time bucket for the metric based on its resolution
    const formatString = TimeSeriesRepository.RESOLUTION_FORMATS[metric.resolution];
    const timeBucket = await this.db.queryOne<{ time_bucket: string }>(
      `SELECT strftime(?, ?) as time_bucket`,
      [formatString, timestamp]
    );

    const result = await this.db.execute(
      `
      INSERT INTO time_series_metrics (
        type, timestamp, resolution, value, 
        count, min, max, avg, sum, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        metric.type,
        timestamp,
        metric.resolution,
        metric.value,
        metric.count || 1,
        metric.min !== undefined ? metric.min : metric.value,
        metric.max !== undefined ? metric.max : metric.value,
        metric.avg !== undefined ? metric.avg : metric.value,
        metric.sum !== undefined ? metric.sum : metric.value,
        this.serialize(metric.metadata)
      ]
    );

    return {
      id: result.lastID,
      ...metric,
      timestamp,
      count: metric.count || 1,
      min: metric.min !== undefined ? metric.min : metric.value,
      max: metric.max !== undefined ? metric.max : metric.value,
      avg: metric.avg !== undefined ? metric.avg : metric.value,
      sum: metric.sum !== undefined ? metric.sum : metric.value,
      timeBucket: timeBucket?.time_bucket
    };
  }

  /**
   * Record a metric value (creates or updates existing)
   */
  async recordMetric(
    type: MetricType,
    value: number,
    resolution: MetricResolution,
    timestamp?: Date,
    metadata?: any
  ): Promise<TimeSeriesMetric> {
    const now = timestamp || new Date();
    const isoTimestamp = now.toISOString();
    
    // Calculate the time bucket for the metric based on its resolution
    const formatString = TimeSeriesRepository.RESOLUTION_FORMATS[resolution];
    const timeBucketResult = await this.db.queryOne<{ time_bucket: string }>(
      `SELECT strftime(?, ?) as time_bucket`,
      [formatString, isoTimestamp]
    );
    const timeBucket = timeBucketResult?.time_bucket;
    
    // Check if a metric exists for this time bucket and type
    const existingMetric = await this.db.queryOne<any>(
      `
      SELECT * FROM time_series_metrics 
      WHERE type = ? AND resolution = ? AND strftime(?, timestamp) = ?
      LIMIT 1
      `,
      [type, resolution, formatString, timeBucket]
    );
    
    if (existingMetric) {
      // Update the existing metric with the new value
      const newCount = existingMetric.count + 1;
      const newSum = existingMetric.sum + value;
      const newAvg = newSum / newCount;
      const newMin = Math.min(existingMetric.min, value);
      const newMax = Math.max(existingMetric.max, value);
      
      // Merge the metadata
      const existingMetadata = this.deserialize(existingMetric.metadata) || {};
      const updatedMetadata = { ...existingMetadata, ...metadata };
      
      await this.db.execute(
        `
        UPDATE time_series_metrics 
        SET count = ?, sum = ?, avg = ?, min = ?, max = ?, metadata = ?
        WHERE id = ?
        `,
        [newCount, newSum, newAvg, newMin, newMax, this.serialize(updatedMetadata), existingMetric.id]
      );
      
      return {
        id: existingMetric.id,
        type,
        timestamp: existingMetric.timestamp,
        resolution,
        value: existingMetric.value, // Keep the original value
        count: newCount,
        min: newMin,
        max: newMax,
        avg: newAvg,
        sum: newSum,
        metadata: updatedMetadata,
        timeBucket
      };
    } else {
      // Create a new metric
      return this.create({
        type,
        timestamp: isoTimestamp,
        resolution,
        value,
        count: 1,
        min: value,
        max: value,
        avg: value,
        sum: value,
        metadata
      });
    }
  }

  /**
   * Rollup metrics to a higher resolution
   */
  async rollupMetrics(
    type: MetricType,
    fromResolution: MetricResolution,
    toResolution: MetricResolution,
    fromTimestamp: Date,
    toTimestamp: Date
  ): Promise<number> {
    // Validate resolution order
    const resolutions = [MetricResolution.MINUTE, MetricResolution.HOUR, MetricResolution.DAY, MetricResolution.MONTH];
    const fromIndex = resolutions.indexOf(fromResolution);
    const toIndex = resolutions.indexOf(toResolution);
    
    if (fromIndex === -1 || toIndex === -1) {
      throw new Error('Invalid resolution');
    }
    
    if (fromIndex >= toIndex) {
      throw new Error('Cannot rollup to a lower or same resolution');
    }
    
    // Get the format string for the target resolution
    const formatString = TimeSeriesRepository.RESOLUTION_FORMATS[toResolution];
    
    // Perform the rollup
    const result = await this.db.transaction(async (db) => {
      // Find existing metrics to rollup
      const existingMetrics = await db.all(
        `
        SELECT 
          type, 
          strftime(?, timestamp) as time_bucket, 
          COUNT(*) as count, 
          SUM(value * count) as total_value, 
          MIN(min) as min, 
          MAX(max) as max, 
          SUM(sum) as sum
        FROM time_series_metrics 
        WHERE type = ? AND resolution = ? AND timestamp >= ? AND timestamp <= ?
        GROUP BY type, time_bucket
        `,
        [formatString, type, fromResolution, fromTimestamp.toISOString(), toTimestamp.toISOString()]
      );
      
      if (!existingMetrics || existingMetrics.length === 0) {
        return 0; // No metrics to rollup
      }
      
      // Track the number of rollups created
      let rollupsCreated = 0;
      
      for (const metric of existingMetrics) {
        // Calculate ISO timestamp for the bucket
        const bucketDate = new Date(metric.time_bucket);
        const bucketTimestamp = bucketDate.toISOString();
        
        // Check if a rollup metric already exists for this bucket
        const existingRollup = await db.get(
          `
          SELECT id, count, sum, min, max
          FROM time_series_metrics 
          WHERE type = ? AND resolution = ? AND strftime(?, timestamp) = ?
          LIMIT 1
          `,
          [type, toResolution, formatString, metric.time_bucket]
        );
        
        if (existingRollup) {
          // Update the existing rollup
          const newCount = existingRollup.count + metric.count;
          const newSum = existingRollup.sum + metric.sum;
          const newAvg = newSum / newCount;
          const newMin = Math.min(existingRollup.min, metric.min);
          const newMax = Math.max(existingRollup.max, metric.max);
          
          await db.run(
            `
            UPDATE time_series_metrics 
            SET count = ?, sum = ?, avg = ?, min = ?, max = ?
            WHERE id = ?
            `,
            [newCount, newSum, newAvg, newMin, newMax, existingRollup.id]
          );
        } else {
          // Create a new rollup
          const avgValue = metric.total_value / metric.count;
          
          await db.run(
            `
            INSERT INTO time_series_metrics (
              type, timestamp, resolution, value, 
              count, min, max, avg, sum, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              type,
              bucketTimestamp,
              toResolution,
              avgValue,
              metric.count,
              metric.min,
              metric.max,
              avgValue,
              metric.sum,
              JSON.stringify({ rollup: true, from_resolution: fromResolution })
            ]
          );
          
          rollupsCreated++;
        }
      }
      
      return rollupsCreated;
    });
    
    return result;
  }

  /**
   * Record task duration metric
   */
  async recordTaskDuration(
    duration: number,
    metadata: { taskId: string; status: string; instanceId?: string },
    timestamp?: Date
  ): Promise<TimeSeriesMetric> {
    return this.recordMetric(
      MetricType.TASK_DURATION,
      duration,
      MetricResolution.MINUTE,
      timestamp,
      metadata
    );
  }

  /**
   * Get average task duration for a time period
   */
  async getAverageTaskDuration(
    fromTimestamp: Date,
    toTimestamp: Date,
    metadataFilters?: Record<string, any>
  ): Promise<number | null> {
    const options: TimeSeriesAggregationOptions = {
      type: MetricType.TASK_DURATION,
      resolution: MetricResolution.MINUTE,
      fromTimestamp,
      toTimestamp,
      aggregation: 'avg',
      metadataFilters
    };
    
    const result = await this.getAggregations(options);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0].value;
  }

  /**
   * Get trend data for a metric type
   */
  async getTrendData(
    type: MetricType,
    resolution: MetricResolution,
    fromTimestamp: Date,
    toTimestamp: Date,
    metadataFilters?: Record<string, any>
  ): Promise<any[]> {
    // Determine appropriate time grouping based on the date range and resolution
    const timeRange = toTimestamp.getTime() - fromTimestamp.getTime();
    const days = timeRange / (1000 * 60 * 60 * 24);
    
    let groupByTime: string;
    
    if (days <= 1) {
      // Less than 1 day - group by minute if resolution is MINUTE
      groupByTime = resolution === MetricResolution.MINUTE ? 'minute' : 'hour';
    } else if (days <= 7) {
      // 1-7 days - group by hour
      groupByTime = 'hour';
    } else if (days <= 31) {
      // 8-31 days - group by day
      groupByTime = 'day';
    } else {
      // More than 31 days - group by month
      groupByTime = 'month';
    }
    
    const options: TimeSeriesAggregationOptions = {
      type,
      resolution,
      fromTimestamp,
      toTimestamp,
      aggregation: 'avg',
      groupByTime,
      metadataFilters
    };
    
    return this.getAggregations(options);
  }

  /**
   * Map database metric row to TimeSeriesMetric model
   */
  private mapMetricFromDb(row: any): TimeSeriesMetric {
    // Calculate the time bucket
    const formatString = TimeSeriesRepository.RESOLUTION_FORMATS[row.resolution as MetricResolution];
    const timeBucket = row.time_bucket; // If already provided in the query
    
    return {
      id: row.id,
      type: row.type as MetricType,
      timestamp: row.timestamp,
      resolution: row.resolution as MetricResolution,
      value: row.value,
      count: row.count,
      min: row.min,
      max: row.max,
      avg: row.avg,
      sum: row.sum,
      metadata: this.deserialize(row.metadata),
      timeBucket: timeBucket || row.time_bucket
    };
  }

  /**
   * Count all metrics
   */
  async count(): Promise<number> {
    const result = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM time_series_metrics'
    );
    
    return result ? result.count : 0;
  }

  /**
   * Update is not supported for time series metrics
   */
  async update(id: number, entity: Partial<TimeSeriesMetric>): Promise<boolean> {
    // Time series data should be immutable, so updates are not supported directly
    // Use recordMetric instead for new readings
    return false;
  }
}

// Export singleton instance
export const timeSeriesRepository = new TimeSeriesRepository(database);