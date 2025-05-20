/**
 * SQLite Database Manager for Claude Code MCP
 * 
 * Handles SQLite database connections, schema initialization, and migrations.
 * Provides a thread-safe interface for database operations.
 */

import sqlite3 from 'sqlite3';
import { open, Database as SQLiteDatabase } from 'sqlite';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

// Enable verbose mode for debugging in development
if (process.env.NODE_ENV === 'development') {
  sqlite3.verbose();
}

// Database pool size limits
const DEFAULT_MIN_CONNECTIONS = 2;
const DEFAULT_MAX_CONNECTIONS = 10;

// Connection configuration
const DEFAULT_CONNECTION_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_BUSY_TIMEOUT_MS = 5000; // 5 seconds

// Database configuration options
export interface DatabaseConfig {
  // Database file path (defaults to ~/.claude/claude-mcp.db)
  dbPath?: string;
  // Minimum connections in the pool
  minConnections?: number;
  // Maximum connections in the pool
  maxConnections?: number;
  // Connection timeout in milliseconds
  connectionTimeoutMs?: number;
  // Busy timeout in milliseconds
  busyTimeoutMs?: number;
  // Whether to log SQL queries (development only)
  logQueries?: boolean;
  // Whether to enable verbose error messages
  verbose?: boolean;
  // Schema version (used for migrations)
  schemaVersion?: number;
}

// Database connection status
enum ConnectionStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  CLOSED = 'closed'
}

// Connection pool entry
interface PoolEntry {
  db: SQLiteDatabase;
  status: ConnectionStatus;
  lastUsed: Date;
  createdAt: Date;
  transactionCount: number;
}

/**
 * Manages SQLite database connections and schema migrations
 */
export class DatabaseManager {
  private config: Required<DatabaseConfig>;
  private connections: PoolEntry[] = [];
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private static instance: DatabaseManager | null = null;

  /**
   * Get singleton instance of DatabaseManager
   */
  public static getInstance(config?: DatabaseConfig): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config);
    }
    return DatabaseManager.instance;
  }

  /**
   * Create a new DatabaseManager
   * @param config Database configuration
   */
  private constructor(config?: DatabaseConfig) {
    // Set default configuration with overrides
    this.config = {
      dbPath: config?.dbPath || join(homedir(), '.claude', 'claude-mcp.db'),
      minConnections: config?.minConnections || DEFAULT_MIN_CONNECTIONS,
      maxConnections: config?.maxConnections || DEFAULT_MAX_CONNECTIONS,
      connectionTimeoutMs: config?.connectionTimeoutMs || DEFAULT_CONNECTION_TIMEOUT_MS,
      busyTimeoutMs: config?.busyTimeoutMs || DEFAULT_BUSY_TIMEOUT_MS,
      logQueries: config?.logQueries || process.env.NODE_ENV === 'development',
      verbose: config?.verbose || process.env.NODE_ENV === 'development',
      schemaVersion: config?.schemaVersion || 1
    };
  }

  /**
   * Initialize the database manager
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure only one initialization process runs at a time
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    
    try {
      await this.initPromise;
      this.initialized = true;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Internal initialization implementation
   */
  private async doInitialize(): Promise<void> {
    // Ensure the database directory exists
    await this.ensureDatabaseDirectory();

    // Create the initial connections
    await this.createInitialConnections();

    // Initialize schema
    await this.initializeSchema();

    // Start the connection cleanup job
    this.startConnectionCleanup();
  }

  /**
   * Ensure the database directory exists
   */
  private async ensureDatabaseDirectory(): Promise<void> {
    const dbDir = dirname(this.config.dbPath);
    
    try {
      await fs.mkdir(dbDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create database directory: ${dbDir}`, error);
      throw new Error(`Failed to create database directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create the initial database connections
   */
  private async createInitialConnections(): Promise<void> {
    const initPromises: Promise<PoolEntry>[] = [];
    
    for (let i = 0; i < this.config.minConnections; i++) {
      initPromises.push(this.createConnection());
    }
    
    try {
      this.connections = await Promise.all(initPromises);
    } catch (error) {
      console.error('Failed to create initial database connections', error);
      throw new Error(`Failed to create initial database connections: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<PoolEntry> {
    try {
      const db = await open({
        filename: this.config.dbPath,
        driver: sqlite3.Database
      });
      
      // Enable foreign keys
      await db.exec('PRAGMA foreign_keys = ON');
      
      // Set busy timeout
      await db.exec(`PRAGMA busy_timeout = ${this.config.busyTimeoutMs}`);
      
      // Use WAL mode for better concurrency
      await db.exec('PRAGMA journal_mode = WAL');
      
      // Set synchronous mode (normal provides good balance of safety and performance)
      await db.exec('PRAGMA synchronous = NORMAL');
      
      // Enable statement-level logging if configured
      if (this.config.logQueries) {
        db.on('trace', (sql: string) => {
          console.log(`[SQL] ${sql}`);
        });
      }
      
      return {
        db,
        status: ConnectionStatus.IDLE,
        lastUsed: new Date(),
        createdAt: new Date(),
        transactionCount: 0
      };
    } catch (error) {
      console.error('Failed to create database connection', error);
      throw new Error(`Failed to create database connection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize the database schema
   */
  private async initializeSchema(): Promise<void> {
    const db = await this.getConnection();
    
    try {
      // Start a transaction for schema initialization
      await db.exec('BEGIN TRANSACTION');
      
      // Create database_info table to track schema version
      await db.exec(`
        CREATE TABLE IF NOT EXISTS database_info (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      
      // Check current schema version
      const versionRow = await db.get(
        'SELECT value FROM database_info WHERE key = ?',
        'schema_version'
      );
      
      let currentVersion = 0;
      if (versionRow) {
        currentVersion = parseInt(versionRow.value, 10);
      } else {
        // Insert initial schema version
        await db.run(
          'INSERT INTO database_info (key, value) VALUES (?, ?)',
          'schema_version',
          '0'
        );
      }
      
      // Run migrations if needed
      if (currentVersion < this.config.schemaVersion) {
        await this.runMigrations(db, currentVersion, this.config.schemaVersion);
      }
      
      // Update schema version if changed
      if (currentVersion !== this.config.schemaVersion) {
        await db.run(
          'UPDATE database_info SET value = ? WHERE key = ?',
          String(this.config.schemaVersion),
          'schema_version'
        );
      }
      
      // Commit transaction
      await db.exec('COMMIT');
    } catch (error) {
      // Rollback on error
      await db.exec('ROLLBACK');
      console.error('Failed to initialize database schema', error);
      throw new Error(`Failed to initialize database schema: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await this.releaseConnection(db);
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(
    db: SQLiteDatabase,
    fromVersion: number,
    toVersion: number
  ): Promise<void> {
    console.log(`Running database migrations from version ${fromVersion} to ${toVersion}`);
    
    // Run each migration in sequence
    for (let version = fromVersion + 1; version <= toVersion; version++) {
      await this.runMigration(db, version);
    }
  }

  /**
   * Run a specific migration version
   */
  private async runMigration(db: SQLiteDatabase, version: number): Promise<void> {
    console.log(`Running migration to version ${version}`);
    
    // Import the migration file dynamically
    try {
      const migration = await import(`./migrations/v${version}`);
      
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration v${version} does not export an 'up' function`);
      }
      
      // Run the migration
      await migration.up(db);
      
      console.log(`Migration to version ${version} completed successfully`);
    } catch (error) {
      console.error(`Failed to run migration to version ${version}`, error);
      throw new Error(`Failed to run migration to version ${version}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start the connection cleanup job
   */
  private startConnectionCleanup(): void {
    // Check for idle connections every 60 seconds
    setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000);
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(): void {
    const now = new Date();
    const idleTimeout = 10 * 60 * 1000; // 10 minutes
    
    // Remove connections that have been idle for too long, but maintain the minimum
    const idleConnections = this.connections.filter(
      conn => conn.status === ConnectionStatus.IDLE &&
      now.getTime() - conn.lastUsed.getTime() > idleTimeout
    );
    
    // Keep at least minConnections connections
    const connectionsToRemove = Math.max(
      0,
      Math.min(
        idleConnections.length,
        this.connections.length - this.config.minConnections
      )
    );
    
    if (connectionsToRemove <= 0) {
      return;
    }
    
    // Close the idle connections
    for (let i = 0; i < connectionsToRemove; i++) {
      const conn = idleConnections[i];
      
      // Remove from pool
      const index = this.connections.indexOf(conn);
      if (index !== -1) {
        this.connections.splice(index, 1);
      }
      
      // Close the connection
      conn.db.close()
        .catch(err => {
          console.error('Failed to close idle database connection', err);
        });
      
      conn.status = ConnectionStatus.CLOSED;
    }
    
    console.log(`Closed ${connectionsToRemove} idle database connections`);
  }

  /**
   * Get a connection from the pool
   */
  public async getConnection(): Promise<SQLiteDatabase> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Find an idle connection
    const idleConnection = this.connections.find(
      conn => conn.status === ConnectionStatus.IDLE
    );
    
    if (idleConnection) {
      idleConnection.status = ConnectionStatus.BUSY;
      idleConnection.lastUsed = new Date();
      idleConnection.transactionCount++;
      return idleConnection.db;
    }
    
    // If the pool is not at max capacity, create a new connection
    if (this.connections.length < this.config.maxConnections) {
      const newConnection = await this.createConnection();
      newConnection.status = ConnectionStatus.BUSY;
      newConnection.transactionCount++;
      this.connections.push(newConnection);
      return newConnection.db;
    }
    
    // All connections are busy, wait for one to become available
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;
      
      // Set a timeout to fail if no connection becomes available
      timeoutId = setTimeout(() => {
        // Remove the event listener
        process.removeListener('connectionReleased', checkForConnection);
        
        reject(new Error(`Timeout waiting for database connection after ${this.config.connectionTimeoutMs}ms`));
      }, this.config.connectionTimeoutMs);
      
      // Function to check for an available connection
      const checkForConnection = () => {
        const idleConnection = this.connections.find(
          conn => conn.status === ConnectionStatus.IDLE
        );
        
        if (idleConnection) {
          clearTimeout(timeoutId);
          process.removeListener('connectionReleased', checkForConnection);
          
          idleConnection.status = ConnectionStatus.BUSY;
          idleConnection.lastUsed = new Date();
          idleConnection.transactionCount++;
          
          resolve(idleConnection.db);
        }
      };
      
      // Listen for connection released event
      process.on('connectionReleased', checkForConnection);
    });
  }

  /**
   * Release a connection back to the pool
   */
  public async releaseConnection(db: SQLiteDatabase): Promise<void> {
    // Find the connection in the pool
    const connection = this.connections.find(conn => conn.db === db);
    
    if (!connection) {
      console.warn('Attempting to release a connection that is not in the pool');
      return;
    }
    
    // Mark the connection as idle
    connection.status = ConnectionStatus.IDLE;
    connection.lastUsed = new Date();
    
    // Emit an event that a connection was released
    process.emit('connectionReleased');
  }

  /**
   * Close all database connections
   */
  public async close(): Promise<void> {
    // Close all connections
    for (const connection of this.connections) {
      try {
        await connection.db.close();
        connection.status = ConnectionStatus.CLOSED;
      } catch (error) {
        console.error('Failed to close database connection', error);
      }
    }
    
    // Clear the connections array
    this.connections = [];
    
    // Reset initialization state
    this.initialized = false;
    this.initPromise = null;
    
    // Clear the singleton instance
    DatabaseManager.instance = null;
  }

  /**
   * Execute a database transaction with automatic connection management
   */
  public async transaction<T>(
    callback: (db: SQLiteDatabase) => Promise<T>
  ): Promise<T> {
    const db = await this.getConnection();
    
    try {
      // Begin transaction
      await db.exec('BEGIN TRANSACTION');
      
      // Execute the callback
      const result = await callback(db);
      
      // Commit transaction
      await db.exec('COMMIT');
      
      return result;
    } catch (error) {
      // Rollback on error
      try {
        await db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to rollback transaction', rollbackError);
      }
      
      // Rethrow the original error
      throw error;
    } finally {
      // Release the connection
      await this.releaseConnection(db);
    }
  }

  /**
   * Execute a read-only query with automatic connection management
   */
  public async query<T>(
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    const db = await this.getConnection();
    
    try {
      return await db.all<T>(sql, params);
    } finally {
      await this.releaseConnection(db);
    }
  }

  /**
   * Execute a single-row query with automatic connection management
   */
  public async queryOne<T>(
    sql: string,
    params: any[] = []
  ): Promise<T | undefined> {
    const db = await this.getConnection();
    
    try {
      return await db.get<T>(sql, params);
    } finally {
      await this.releaseConnection(db);
    }
  }

  /**
   * Execute a write operation with automatic connection management
   */
  public async execute(
    sql: string,
    params: any[] = []
  ): Promise<{ changes: number; lastID: number }> {
    const db = await this.getConnection();
    
    try {
      const result = await db.run(sql, params);
      return {
        changes: result.changes,
        lastID: result.lastID
      };
    } finally {
      await this.releaseConnection(db);
    }
  }

  /**
   * Execute a batch of write operations in a transaction
   */
  public async executeBatch(
    statements: { sql: string; params: any[] }[]
  ): Promise<{ changes: number; lastID: number }> {
    return this.transaction(async (db) => {
      let totalChanges = 0;
      let lastID = 0;
      
      for (const stmt of statements) {
        const result = await db.run(stmt.sql, stmt.params);
        totalChanges += result.changes;
        
        // Update lastID only if it was set (indicating an INSERT)
        if (result.lastID) {
          lastID = result.lastID;
        }
      }
      
      return { changes: totalChanges, lastID };
    });
  }
}

// Export the singleton instance
export const database = DatabaseManager.getInstance();