/**
 * Task Repository
 * 
 * Manages persistence operations for tasks.
 */

import { BaseRepository } from './base-repository';
import { Task, TaskStatus, TaskPriority, TaskExecutionMode, TaskMetadata, SubTask } from '../models/task';
import { DatabaseManager, database } from '../database';

/**
 * Search options for tasks
 */
export interface TaskSearchOptions {
  query?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  executionMode?: TaskExecutionMode;
  instanceId?: string;
  parentTaskId?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
  completedDateFrom?: Date;
  completedDateTo?: Date;
  offset?: number;
  limit?: number;
  includeSubtasks?: boolean;
  orderBy?: 'created_at' | 'updated_at' | 'priority' | 'status';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Task repository interface
 */
export interface ITaskRepository {
  /**
   * Find task by ID
   */
  findById(id: string, includeSubtasks?: boolean): Promise<Task | null>;

  /**
   * Find all tasks with optional pagination
   */
  findAll(options?: { offset?: number; limit?: number; includeSubtasks?: boolean }): Promise<Task[]>;

  /**
   * Search tasks with various criteria
   */
  search(options: TaskSearchOptions): Promise<Task[]>;

  /**
   * Full-text search tasks
   */
  searchFullText(query: string, options?: { offset?: number; limit?: number }): Promise<Task[]>;

  /**
   * Find tasks by status
   */
  findByStatus(status: TaskStatus | TaskStatus[], options?: { offset?: number; limit?: number }): Promise<Task[]>;

  /**
   * Find tasks by instance ID
   */
  findByInstanceId(instanceId: string, options?: { offset?: number; limit?: number }): Promise<Task[]>;

  /**
   * Find tasks by parent task ID
   */
  findByParentTaskId(parentTaskId: string, options?: { offset?: number; limit?: number }): Promise<Task[]>;

  /**
   * Find tasks that have timed out
   */
  findTimedOutTasks(): Promise<Task[]>;

  /**
   * Create a new task
   */
  create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;

  /**
   * Update task status
   */
  updateStatus(id: string, status: TaskStatus, progress?: number): Promise<boolean>;

  /**
   * Update task progress
   */
  updateProgress(id: string, progress: number): Promise<boolean>;

  /**
   * Assign task to instance
   */
  assignToInstance(id: string, instanceId: string): Promise<boolean>;

  /**
   * Mark task as started
   */
  markAsStarted(id: string, instanceId: string): Promise<boolean>;

  /**
   * Mark task as completed
   */
  markAsCompleted(id: string, progress?: number): Promise<boolean>;

  /**
   * Mark task as failed
   */
  markAsFailed(id: string, error?: string): Promise<boolean>;

  /**
   * Mark task as timed out
   */
  markAsTimedOut(id: string): Promise<boolean>;

  /**
   * Find subtasks by task ID
   */
  findSubtasks(taskId: string): Promise<SubTask[]>;

  /**
   * Create a subtask
   */
  createSubtask(subtask: Omit<SubTask, 'createdAt' | 'updatedAt'>): Promise<SubTask>;

  /**
   * Update subtask status
   */
  updateSubtaskStatus(taskId: string, subtaskId: string, status: TaskStatus, progress?: number): Promise<boolean>;
}

/**
 * Task repository implementation
 */
export class TaskRepository extends BaseRepository<Task, string> implements ITaskRepository {
  constructor(db: DatabaseManager = database) {
    super(db, 'tasks');
  }

  /**
   * Find task by ID
   */
  async findById(id: string, includeSubtasks: boolean = false): Promise<Task | null> {
    const task = await this.db.queryOne<any>(
      `SELECT * FROM tasks WHERE id = ?`,
      [id]
    );

    if (!task) {
      return null;
    }

    const result = this.mapTaskFromDb(task);

    if (includeSubtasks) {
      result.subtasks = await this.findSubtasks(id);
    }

    return result;
  }

  /**
   * Find all tasks with optional pagination
   */
  async findAll(options?: { offset?: number; limit?: number; includeSubtasks?: boolean }): Promise<Task[]> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    const includeSubtasks = options?.includeSubtasks || false;

    const tasks = await this.db.query<any>(
      `SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const result = tasks.map(task => this.mapTaskFromDb(task));

    if (includeSubtasks && result.length > 0) {
      const taskIds = result.map(task => task.id);
      const allSubtasks = await this.findSubtasksByTaskIds(taskIds);

      // Group subtasks by task ID
      const subtasksByTaskId = allSubtasks.reduce((acc, subtask) => {
        if (!acc[subtask.taskId]) {
          acc[subtask.taskId] = [];
        }
        acc[subtask.taskId].push(subtask);
        return acc;
      }, {} as Record<string, SubTask[]>);

      // Assign subtasks to tasks
      result.forEach(task => {
        task.subtasks = subtasksByTaskId[task.id] || [];
      });
    }

    return result;
  }

  /**
   * Search tasks with various criteria
   */
  async search(options: TaskSearchOptions): Promise<Task[]> {
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

    if (options.priority) {
      if (Array.isArray(options.priority)) {
        conditions.push(`priority IN (${this.generatePlaceholders(options.priority.length)})`);
        params.push(...options.priority);
      } else {
        conditions.push('priority = ?');
        params.push(options.priority);
      }
    }

    if (options.executionMode) {
      conditions.push('execution_mode = ?');
      params.push(options.executionMode);
    }

    if (options.instanceId) {
      conditions.push('instance_id = ?');
      params.push(options.instanceId);
    }

    if (options.parentTaskId) {
      conditions.push('parent_task_id = ?');
      params.push(options.parentTaskId);
    }

    if (options.startDateFrom) {
      conditions.push('started_at >= ?');
      params.push(options.startDateFrom.toISOString());
    }

    if (options.startDateTo) {
      conditions.push('started_at <= ?');
      params.push(options.startDateTo.toISOString());
    }

    if (options.completedDateFrom) {
      conditions.push('completed_at >= ?');
      params.push(options.completedDateFrom.toISOString());
    }

    if (options.completedDateTo) {
      conditions.push('completed_at <= ?');
      params.push(options.completedDateTo.toISOString());
    }

    let sql = 'SELECT * FROM tasks';

    if (options.query && options.query.trim() !== '') {
      // Use FTS5 for text search
      const ftsQuery = options.query.trim()
        .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
        .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
        .trim();
      
      if (ftsQuery !== '') {
        sql = `
          SELECT tasks.* FROM tasks
          JOIN tasks_fts ON tasks.rowid = tasks_fts.rowid
          WHERE tasks_fts MATCH ?
        `;
        params.unshift(ftsQuery);
        
        if (conditions.length > 0) {
          sql += ` AND ${conditions.join(' AND ')}`;
        }
      }
    } else if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add order by clause
    const orderBy = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'desc';
    sql += ` ORDER BY ${orderBy} ${orderDirection}`;

    // Add pagination
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const tasks = await this.db.query<any>(sql, params);
    const result = tasks.map(task => this.mapTaskFromDb(task));

    if (options.includeSubtasks && result.length > 0) {
      const taskIds = result.map(task => task.id);
      const allSubtasks = await this.findSubtasksByTaskIds(taskIds);

      // Group subtasks by task ID
      const subtasksByTaskId = allSubtasks.reduce((acc, subtask) => {
        if (!acc[subtask.taskId]) {
          acc[subtask.taskId] = [];
        }
        acc[subtask.taskId].push(subtask);
        return acc;
      }, {} as Record<string, SubTask[]>);

      // Assign subtasks to tasks
      result.forEach(task => {
        task.subtasks = subtasksByTaskId[task.id] || [];
      });
    }

    return result;
  }

  /**
   * Full-text search tasks
   */
  async searchFullText(query: string, options?: { offset?: number; limit?: number }): Promise<Task[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    // Clean the query for FTS5
    const cleanQuery = query.trim()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
      .trim();

    if (cleanQuery === '') {
      return [];
    }

    const tasks = await this.db.query<any>(
      `
      SELECT tasks.*, tasks_fts.rank
      FROM tasks_fts
      JOIN tasks ON tasks_fts.rowid = tasks.rowid
      WHERE tasks_fts MATCH ?
      ORDER BY tasks_fts.rank
      LIMIT ? OFFSET ?
      `,
      [cleanQuery, limit, offset]
    );

    return tasks.map(task => this.mapTaskFromDb(task));
  }

  /**
   * Find tasks by status
   */
  async findByStatus(status: TaskStatus | TaskStatus[], options?: { offset?: number; limit?: number }): Promise<Task[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let sql: string;
    let params: any[];

    if (Array.isArray(status)) {
      sql = `
        SELECT * FROM tasks 
        WHERE status IN (${this.generatePlaceholders(status.length)})
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [...status, limit, offset];
    } else {
      sql = `
        SELECT * FROM tasks 
        WHERE status = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [status, limit, offset];
    }

    const tasks = await this.db.query<any>(sql, params);
    return tasks.map(task => this.mapTaskFromDb(task));
  }

  /**
   * Find tasks by instance ID
   */
  async findByInstanceId(instanceId: string, options?: { offset?: number; limit?: number }): Promise<Task[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const tasks = await this.db.query<any>(
      `
      SELECT * FROM tasks 
      WHERE instance_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [instanceId, limit, offset]
    );

    return tasks.map(task => this.mapTaskFromDb(task));
  }

  /**
   * Find tasks by parent task ID
   */
  async findByParentTaskId(parentTaskId: string, options?: { offset?: number; limit?: number }): Promise<Task[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const tasks = await this.db.query<any>(
      `
      SELECT * FROM tasks 
      WHERE parent_task_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [parentTaskId, limit, offset]
    );

    return tasks.map(task => this.mapTaskFromDb(task));
  }

  /**
   * Find tasks that have timed out
   */
  async findTimedOutTasks(): Promise<Task[]> {
    const now = new Date().toISOString();

    const tasks = await this.db.query<any>(
      `
      SELECT * FROM tasks 
      WHERE status = ? 
      AND timeout_at IS NOT NULL 
      AND timeout_at <= ? 
      AND timeout_handled = 0
      `,
      [TaskStatus.RUNNING, now]
    );

    return tasks.map(task => this.mapTaskFromDb(task));
  }

  /**
   * Create a new task
   */
  async create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    // Generate a unique task ID if not provided
    const taskId = task.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    // Calculate timeout_at if timeout is provided
    let timeoutAt = null;
    if (task.timeout) {
      const timeoutDate = new Date();
      timeoutDate.setMilliseconds(timeoutDate.getMilliseconds() + task.timeout);
      timeoutAt = timeoutDate.toISOString();
    }

    const result = await this.db.execute(
      `
      INSERT INTO tasks (
        id, parent_task_id, status, progress, priority, execution_mode,
        name, description, prompt, work_folder, return_mode, mode,
        metadata, created_at, updated_at, instance_id, timeout, timeout_at,
        timeout_handled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        task.parentTaskId || null,
        task.status || TaskStatus.PENDING,
        task.progress || 0,
        task.priority || TaskPriority.MEDIUM,
        task.executionMode || TaskExecutionMode.SEQUENTIAL,
        task.name || null,
        task.description || null,
        task.prompt,
        task.workFolder || null,
        task.returnMode || null,
        task.mode || null,
        this.serialize(task.metadata) || null,
        now,
        now,
        task.instanceId || null,
        task.timeout || null,
        timeoutAt,
        this.boolToInt(task.timeoutHandled) || 0
      ]
    );

    return {
      id: taskId,
      parentTaskId: task.parentTaskId || null,
      status: task.status || TaskStatus.PENDING,
      progress: task.progress || 0,
      priority: task.priority || TaskPriority.MEDIUM,
      executionMode: task.executionMode || TaskExecutionMode.SEQUENTIAL,
      name: task.name,
      description: task.description,
      prompt: task.prompt,
      workFolder: task.workFolder || null,
      returnMode: task.returnMode || null,
      mode: task.mode || null,
      metadata: task.metadata || null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      updatedAt: now,
      instanceId: task.instanceId || null,
      timeout: task.timeout || null,
      timeoutAt: timeoutAt,
      timeoutHandled: task.timeoutHandled || false,
      subtasks: []
    };
  }

  /**
   * Update task status
   */
  async updateStatus(id: string, status: TaskStatus, progress?: number): Promise<boolean> {
    const now = new Date().toISOString();
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const params: any[] = [status, now];

    if (progress !== undefined) {
      updates.push('progress = ?');
      params.push(progress);
    }

    // Update started_at if moving to RUNNING status
    if (status === TaskStatus.RUNNING) {
      updates.push('started_at = COALESCE(started_at, ?)');
      params.push(now);
    }

    // Update completed_at if moving to a terminal status
    if ([TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED, TaskStatus.TIMEOUT].includes(status)) {
      updates.push('completed_at = COALESCE(completed_at, ?)');
      params.push(now);
    }

    // Add task ID to params
    params.push(id);

    const result = await this.db.execute(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return result.changes > 0;
  }

  /**
   * Update task progress
   */
  async updateProgress(id: string, progress: number): Promise<boolean> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      'UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?',
      [progress, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Assign task to instance
   */
  async assignToInstance(id: string, instanceId: string): Promise<boolean> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      'UPDATE tasks SET instance_id = ?, updated_at = ? WHERE id = ?',
      [instanceId, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Mark task as started
   */
  async markAsStarted(id: string, instanceId: string): Promise<boolean> {
    const now = new Date().toISOString();

    // Calculate timeout_at if task has a timeout
    const task = await this.findById(id);
    let timeoutAt = null;
    
    if (task?.timeout) {
      const timeoutDate = new Date();
      timeoutDate.setMilliseconds(timeoutDate.getMilliseconds() + task.timeout);
      timeoutAt = timeoutDate.toISOString();
    }

    const updates = [
      'status = ?',
      'instance_id = ?',
      'started_at = ?',
      'updated_at = ?'
    ];
    
    const params: any[] = [
      TaskStatus.RUNNING,
      instanceId,
      now,
      now
    ];

    if (timeoutAt) {
      updates.push('timeout_at = ?');
      params.push(timeoutAt);
    }

    // Add task ID to params
    params.push(id);

    const result = await this.db.execute(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return result.changes > 0;
  }

  /**
   * Mark task as completed
   */
  async markAsCompleted(id: string, progress?: number): Promise<boolean> {
    const now = new Date().toISOString();
    const prog = progress !== undefined ? progress : 100;

    const result = await this.db.execute(
      'UPDATE tasks SET status = ?, progress = ?, completed_at = ?, updated_at = ? WHERE id = ?',
      [TaskStatus.COMPLETED, prog, now, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Mark task as failed
   */
  async markAsFailed(id: string, error?: string): Promise<boolean> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      'UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
      [TaskStatus.FAILED, now, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Mark task as timed out
   */
  async markAsTimedOut(id: string): Promise<boolean> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      'UPDATE tasks SET status = ?, timeout_handled = ?, completed_at = ?, updated_at = ? WHERE id = ?',
      [TaskStatus.TIMEOUT, 1, now, now, id]
    );

    return result.changes > 0;
  }

  /**
   * Find subtasks by task ID
   */
  async findSubtasks(taskId: string): Promise<SubTask[]> {
    const subtasks = await this.db.query<any>(
      'SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC',
      [taskId]
    );

    return subtasks.map(subtask => this.mapSubtaskFromDb(subtask));
  }

  /**
   * Find subtasks by multiple task IDs
   */
  private async findSubtasksByTaskIds(taskIds: string[]): Promise<SubTask[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const subtasks = await this.db.query<any>(
      `SELECT * FROM subtasks WHERE task_id IN (${this.generatePlaceholders(taskIds.length)}) ORDER BY created_at ASC`,
      taskIds
    );

    return subtasks.map(subtask => this.mapSubtaskFromDb(subtask));
  }

  /**
   * Create a subtask
   */
  async createSubtask(subtask: Omit<SubTask, 'createdAt' | 'updatedAt'>): Promise<SubTask> {
    const now = new Date().toISOString();

    await this.db.execute(
      `
      INSERT INTO subtasks (
        id, task_id, status, progress, name, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        subtask.id,
        subtask.taskId,
        subtask.status,
        subtask.progress || 0,
        subtask.name || null,
        subtask.description || null,
        now,
        now
      ]
    );

    return {
      ...subtask,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Update subtask status
   */
  async updateSubtaskStatus(taskId: string, subtaskId: string, status: TaskStatus, progress?: number): Promise<boolean> {
    const now = new Date().toISOString();
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const params: any[] = [status, now];

    if (progress !== undefined) {
      updates.push('progress = ?');
      params.push(progress);
    }

    // Add task ID and subtask ID to params
    params.push(taskId, subtaskId);

    const result = await this.db.execute(
      `UPDATE subtasks SET ${updates.join(', ')} WHERE task_id = ? AND id = ?`,
      params
    );

    return result.changes > 0;
  }

  /**
   * Map database task row to Task model
   */
  private mapTaskFromDb(row: any): Task {
    const task: Task = {
      id: row.id,
      parentTaskId: row.parent_task_id,
      status: row.status as TaskStatus,
      progress: row.progress,
      priority: row.priority as TaskPriority,
      executionMode: row.execution_mode as TaskExecutionMode,
      name: row.name,
      description: row.description,
      prompt: row.prompt,
      workFolder: row.work_folder,
      returnMode: row.return_mode as 'summary' | 'full' | null,
      mode: row.mode,
      metadata: this.deserialize<TaskMetadata>(row.metadata),
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
      instanceId: row.instance_id,
      timeout: row.timeout,
      timeoutAt: row.timeout_at,
      timeoutHandled: this.intToBool(row.timeout_handled) || false,
      subtasks: [],
    };

    // Calculate duration if start and complete times are available
    if (task.startedAt && task.completedAt) {
      const start = new Date(task.startedAt).getTime();
      const end = new Date(task.completedAt).getTime();
      task.duration = end - start;
    }

    return task;
  }

  /**
   * Map database subtask row to SubTask model
   */
  private mapSubtaskFromDb(row: any): SubTask {
    return {
      id: row.id,
      taskId: row.task_id,
      status: row.status as TaskStatus,
      progress: row.progress,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Count all tasks
   */
  async count(): Promise<number> {
    const result = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM tasks'
    );
    
    return result ? result.count : 0;
  }

  /**
   * Update a task
   */
  async update(id: string, entity: Partial<Task>): Promise<boolean> {
    const now = new Date().toISOString();
    
    // Convert entity to DB columns
    const updates: string[] = [];
    const params: any[] = [];
    
    // Handle regular fields
    if (entity.parentTaskId !== undefined) {
      updates.push('parent_task_id = ?');
      params.push(entity.parentTaskId);
    }
    
    if (entity.status !== undefined) {
      updates.push('status = ?');
      params.push(entity.status);
    }
    
    if (entity.progress !== undefined) {
      updates.push('progress = ?');
      params.push(entity.progress);
    }
    
    if (entity.priority !== undefined) {
      updates.push('priority = ?');
      params.push(entity.priority);
    }
    
    if (entity.executionMode !== undefined) {
      updates.push('execution_mode = ?');
      params.push(entity.executionMode);
    }
    
    if (entity.name !== undefined) {
      updates.push('name = ?');
      params.push(entity.name);
    }
    
    if (entity.description !== undefined) {
      updates.push('description = ?');
      params.push(entity.description);
    }
    
    if (entity.prompt !== undefined) {
      updates.push('prompt = ?');
      params.push(entity.prompt);
    }
    
    if (entity.workFolder !== undefined) {
      updates.push('work_folder = ?');
      params.push(entity.workFolder);
    }
    
    if (entity.returnMode !== undefined) {
      updates.push('return_mode = ?');
      params.push(entity.returnMode);
    }
    
    if (entity.mode !== undefined) {
      updates.push('mode = ?');
      params.push(entity.mode);
    }
    
    if (entity.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(this.serialize(entity.metadata));
    }
    
    if (entity.startedAt !== undefined) {
      updates.push('started_at = ?');
      params.push(entity.startedAt);
    }
    
    if (entity.completedAt !== undefined) {
      updates.push('completed_at = ?');
      params.push(entity.completedAt);
    }
    
    if (entity.instanceId !== undefined) {
      updates.push('instance_id = ?');
      params.push(entity.instanceId);
    }
    
    if (entity.timeout !== undefined) {
      updates.push('timeout = ?');
      params.push(entity.timeout);
    }
    
    if (entity.timeoutAt !== undefined) {
      updates.push('timeout_at = ?');
      params.push(entity.timeoutAt);
    }
    
    if (entity.timeoutHandled !== undefined) {
      updates.push('timeout_handled = ?');
      params.push(this.boolToInt(entity.timeoutHandled));
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
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return result.changes > 0;
  }
}

// Export singleton instance
export const taskRepository = new TaskRepository(database);