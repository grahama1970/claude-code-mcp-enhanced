/**
 * Base Repository Interface
 * 
 * Defines the common operations for all repositories.
 */

import { DatabaseManager } from '../database';

/**
 * Base repository interface for CRUD operations
 */
export interface Repository<T, ID> {
  /**
   * Find a single entity by ID
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Find all entities (with optional pagination)
   */
  findAll(options?: { offset?: number; limit?: number }): Promise<T[]>;

  /**
   * Count all entities
   */
  count(): Promise<number>;

  /**
   * Create a new entity
   */
  create(entity: Omit<T, 'id'>): Promise<T>;

  /**
   * Update an existing entity
   */
  update(id: ID, entity: Partial<T>): Promise<boolean>;

  /**
   * Delete an entity
   */
  delete(id: ID): Promise<boolean>;
}

/**
 * Base repository implementation with common functionality
 */
export abstract class BaseRepository<T, ID> implements Repository<T, ID> {
  protected db: DatabaseManager;
  protected tableName: string;
  protected idField: string;

  constructor(db: DatabaseManager, tableName: string, idField: string = 'id') {
    this.db = db;
    this.tableName = tableName;
    this.idField = idField;
  }

  abstract findById(id: ID): Promise<T | null>;
  abstract findAll(options?: { offset?: number; limit?: number }): Promise<T[]>;
  abstract count(): Promise<number>;
  abstract create(entity: Omit<T, 'id'>): Promise<T>;
  abstract update(id: ID, entity: Partial<T>): Promise<boolean>;
  
  /**
   * Delete an entity by ID
   */
  async delete(id: ID): Promise<boolean> {
    const result = await this.db.execute(
      `DELETE FROM ${this.tableName} WHERE ${this.idField} = ?`,
      [id]
    );
    
    return result.changes > 0;
  }

  /**
   * Convert date object to ISO string for storage
   */
  protected toIsoString(date?: Date | null): string | null {
    return date ? date.toISOString() : null;
  }

  /**
   * Parse ISO string to Date
   */
  protected fromIsoString(isoString?: string | null): Date | null {
    return isoString ? new Date(isoString) : null;
  }

  /**
   * Serialize an object to JSON string
   */
  protected serialize<T>(obj?: T | null): string | null {
    return obj ? JSON.stringify(obj) : null;
  }

  /**
   * Deserialize a JSON string to an object
   */
  protected deserialize<T>(json?: string | null): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch (e) {
      console.error(`Failed to deserialize JSON: ${json}`, e);
      return null;
    }
  }

  /**
   * Convert boolean to integer for SQLite storage
   */
  protected boolToInt(value?: boolean | null): number | null {
    return value === undefined || value === null ? null : value ? 1 : 0;
  }

  /**
   * Convert integer from SQLite to boolean
   */
  protected intToBool(value?: number | null): boolean | null {
    return value === undefined || value === null ? null : value !== 0;
  }

  /**
   * Map snake_case column names to camelCase properties
   */
  protected mapColumnsToCamelCase<T extends Record<string, any>>(row: Record<string, any>): T {
    const result: Record<string, any> = {};
    
    Object.entries(row).forEach(([key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    });
    
    return result as T;
  }

  /**
   * Map camelCase properties to snake_case column names
   */
  protected mapCamelCaseToColumns(entity: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    Object.entries(entity).forEach(([key, value]) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    });
    
    return result;
  }

  /**
   * Generate SQL placeholders for an array (?, ?, ?)
   */
  protected generatePlaceholders(count: number): string {
    return Array(count).fill('?').join(', ');
  }
}