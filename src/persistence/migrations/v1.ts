/**
 * Initial Database Schema Migration
 * 
 * Creates the initial tables for the Claude Code MCP database.
 */

import { Database as SQLiteDatabase } from 'sqlite';

export async function up(db: SQLiteDatabase): Promise<void> {
  // Create tables in a transaction
  await db.exec('BEGIN TRANSACTION');

  try {
    // Tasks table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        parent_task_id TEXT,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium',
        execution_mode TEXT NOT NULL DEFAULT 'sequential',
        name TEXT,
        description TEXT,
        prompt TEXT NOT NULL,
        work_folder TEXT,
        return_mode TEXT,
        mode TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL,
        instance_id TEXT,
        timeout INTEGER,
        timeout_at TEXT,
        timeout_handled INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE SET NULL
      )
    `);

    // Sub-tasks table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        name TEXT,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (id, task_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // Instances table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        current_task_id TEXT,
        metrics TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        last_heartbeat_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (current_task_id) REFERENCES tasks(id) ON DELETE SET NULL
      )
    `);

    // Task logs table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        instance_id TEXT,
        type TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        progress INTEGER,
        status TEXT,
        timestamp TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE SET NULL
      )
    `);

    // Task results table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS task_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL UNIQUE,
        instance_id TEXT,
        status TEXT NOT NULL,
        output TEXT NOT NULL,
        error TEXT,
        execution_time INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE SET NULL
      )
    `);

    // Instance telemetry table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS instance_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instance_id TEXT NOT NULL,
        task_id TEXT,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        value REAL NOT NULL,
        metadata TEXT,
        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // Time series metrics table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS time_series_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        resolution TEXT NOT NULL,
        value REAL NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        min REAL,
        max REAL,
        avg REAL,
        sum REAL,
        metadata TEXT
      )
    `);

    // Create indexes for performance
    
    // Indexes for tasks table
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_instance_id ON tasks(instance_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_timeout_at ON tasks(timeout_at);
    `);

    // Indexes for subtasks table
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
      CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status);
    `);

    // Indexes for instances table
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
      CREATE INDEX IF NOT EXISTS idx_instances_current_task_id ON instances(current_task_id);
      CREATE INDEX IF NOT EXISTS idx_instances_last_heartbeat_at ON instances(last_heartbeat_at);
    `);

    // Indexes for task_logs table
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_logs_instance_id ON task_logs(instance_id);
      CREATE INDEX IF NOT EXISTS idx_task_logs_timestamp ON task_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_task_logs_type ON task_logs(type);
    `);

    // Indexes for task_results table
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_results_task_id ON task_results(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_results_instance_id ON task_results(instance_id);
      CREATE INDEX IF NOT EXISTS idx_task_results_status ON task_results(status);
    `);

    // Indexes for instance_telemetry table
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_instance_telemetry_instance_id ON instance_telemetry(instance_id);
      CREATE INDEX IF NOT EXISTS idx_instance_telemetry_task_id ON instance_telemetry(task_id);
      CREATE INDEX IF NOT EXISTS idx_instance_telemetry_type ON instance_telemetry(type);
      CREATE INDEX IF NOT EXISTS idx_instance_telemetry_timestamp ON instance_telemetry(timestamp);
    `);

    // Indexes for time_series_metrics table
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_time_series_metrics_type ON time_series_metrics(type);
      CREATE INDEX IF NOT EXISTS idx_time_series_metrics_timestamp ON time_series_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_time_series_metrics_resolution ON time_series_metrics(resolution);
      CREATE INDEX IF NOT EXISTS idx_time_series_metrics_type_timestamp_resolution ON time_series_metrics(type, timestamp, resolution);
    `);

    // Create FTS5 virtual tables for searching
    
    // FTS5 for tasks content search
    await db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
        name, 
        description, 
        prompt,
        content='tasks', 
        content_rowid='rowid',
        tokenize='porter unicode61'
      )
    `);

    // Create triggers to keep FTS5 tables in sync
    
    // Triggers for tasks_fts
    await db.exec(`
      -- Insert trigger
      CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
        INSERT INTO tasks_fts(rowid, name, description, prompt)
        VALUES (new.rowid, new.name, new.description, new.prompt);
      END;
      
      -- Update trigger
      CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, name, description, prompt)
        VALUES ('delete', old.rowid, old.name, old.description, old.prompt);
        INSERT INTO tasks_fts(rowid, name, description, prompt)
        VALUES (new.rowid, new.name, new.description, new.prompt);
      END;
      
      -- Delete trigger
      CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, name, description, prompt)
        VALUES ('delete', old.rowid, old.name, old.description, old.prompt);
      END;
    `);

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Rollback the migration in a transaction
  await db.exec('BEGIN TRANSACTION');

  try {
    // Drop triggers
    await db.exec('DROP TRIGGER IF EXISTS tasks_ai');
    await db.exec('DROP TRIGGER IF EXISTS tasks_au');
    await db.exec('DROP TRIGGER IF EXISTS tasks_ad');
    
    // Drop FTS5 virtual tables
    await db.exec('DROP TABLE IF EXISTS tasks_fts');

    // Drop regular tables
    await db.exec('DROP TABLE IF EXISTS time_series_metrics');
    await db.exec('DROP TABLE IF EXISTS instance_telemetry');
    await db.exec('DROP TABLE IF EXISTS task_results');
    await db.exec('DROP TABLE IF EXISTS task_logs');
    await db.exec('DROP TABLE IF EXISTS subtasks');
    await db.exec('DROP TABLE IF EXISTS instances');
    await db.exec('DROP TABLE IF EXISTS tasks');
    
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}