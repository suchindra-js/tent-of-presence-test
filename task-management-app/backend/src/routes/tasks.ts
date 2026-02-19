import { Router, Response } from "express";
import pool from "../db";
import { authenticate } from "../middleware/auth";
import { AuthenticatedRequest } from "../types/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate);

const STATUSES = ["todo", "in_progress", "done"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

function rowToTask(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_id: row.user_id,
  };
}

router.get(
  "/",
  asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user.userId;
      const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(String(req.query.limit), 10) || 20),
      );
      const offset = (page - 1) * limit;
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;

      if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      if (
        priority &&
        !PRIORITIES.includes(priority as (typeof PRIORITIES)[number])
      ) {
        res.status(400).json({ error: "Invalid priority" });
        return;
      }

      const conditions: string[] = ["user_id = $1"];
      const values: unknown[] = [userId];
      let paramIndex = 2;
      if (status) {
        conditions.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex += 1;
      }
      if (priority) {
        conditions.push(`priority = $${paramIndex}`);
        values.push(priority);
        paramIndex += 1;
      }

      const whereClause = conditions.join(" AND ");

      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM tasks WHERE ${whereClause}`,
        values,
      );
      const total = countResult.rows[0].total;

      const listValues = [...values, limit, offset];
      const listResult = await pool.query(
        `SELECT * FROM tasks WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        listValues,
      );

      res.json({
        data: listResult.rows.map(rowToTask),
        total,
        page,
        limit,
      });
    },
  ),
);

router.post(
  "/",
  asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user.userId;
      const { title, description, status, priority, due_date } = req.body as {
        title?: string;
        description?: string;
        status?: string;
        priority?: string;
        due_date?: string | null;
      };

      if (!title || typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "Title is required" });
        return;
      }

      const taskStatus = (status?.trim() ||
        "todo") as (typeof STATUSES)[number];
      const taskPriority = (priority?.trim() ||
        "medium") as (typeof PRIORITIES)[number];

      if (!STATUSES.includes(taskStatus)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      if (!PRIORITIES.includes(taskPriority)) {
        res.status(400).json({ error: "Invalid priority" });
        return;
      }

      const dueDate = due_date === null || due_date === "" ? null : due_date;

      const result = await pool.query(
        `INSERT INTO tasks (user_id, title, description, status, priority, due_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
        [
          userId,
          title.trim(),
          description?.trim() || null,
          taskStatus,
          taskPriority,
          dueDate || null,
        ],
      );

      res.status(201).json(rowToTask(result.rows[0]));
    },
  ),
);

router.get(
  "/:id",
  asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user.userId;
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
        [id, userId],
      );

      const row = result.rows[0];
      if (!row) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      res.json(rowToTask(row));
    },
  ),
);

router.patch(
  "/:id",
  asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user.userId;
      const { id } = req.params;
      const { title, description, status, priority, due_date } = req.body as {
        title?: string;
        description?: string;
        status?: string;
        priority?: string;
        due_date?: string | null;
      };

      if (
        status !== undefined &&
        !STATUSES.includes(status as (typeof STATUSES)[number])
      ) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      if (
        priority !== undefined &&
        !PRIORITIES.includes(priority as (typeof PRIORITIES)[number])
      ) {
        res.status(400).json({ error: "Invalid priority" });
        return;
      }

      const updates: string[] = ["updated_at = now()"];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        values.push(typeof title === "string" ? title.trim() : title);
        paramIndex += 1;
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(
          typeof description === "string" ? description.trim() : description,
        );
        paramIndex += 1;
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex += 1;
      }
      if (priority !== undefined) {
        updates.push(`priority = $${paramIndex}`);
        values.push(priority);
        paramIndex += 1;
      }
      if (due_date !== undefined) {
        updates.push(`due_date = $${paramIndex}`);
        values.push(due_date === null || due_date === "" ? null : due_date);
        paramIndex += 1;
      }

      if (values.length === 0) {
        const existing = await pool.query(
          "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
          [id, userId],
        );
        if (!existing.rows[0]) {
          res.status(404).json({ error: "Task not found" });
          return;
        }
        res.json(rowToTask(existing.rows[0]));
        return;
      }

      values.push(id, userId);
      const result = await pool.query(
        `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING *`,
        values,
      );

      const row = result.rows[0];
      if (!row) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      res.json(rowToTask(row));
    },
  ),
);

router.delete(
  "/:id",
  asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user.userId;
      const { id } = req.params;

      const result = await pool.query(
        "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
        [id, userId],
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      res.status(204).send();
    },
  ),
);

export default router;
