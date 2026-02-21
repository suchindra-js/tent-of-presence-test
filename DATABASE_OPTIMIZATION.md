# Database Optimization & Design

---

## A. Query Optimization

### Report: Top 10 Users by Total Spending (Last 30 Days)

#### SQL Query

```sql
SELECT
    u.id AS user_id,
    u.username,
    u.email,
    u.created_at,
    COUNT(DISTINCT o.id) AS total_orders,
    COALESCE(SUM(o.total_amount), 0) AS total_spent
FROM users u
INNER JOIN orders o ON o.user_id = u.id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.username, u.email, u.created_at
ORDER BY total_spent DESC
LIMIT 10;
```

---

### Indexes to Optimize This Query

1. `**orders(user_id, created_at)**`
  - Supports the join and the 30-day filter; allows index-only or very selective scans on `orders`.
2. `**orders(created_at)**`
  - Alternative or complement if the planner prefers a range scan on time first, then join to users.
3. `**orders(status)**` or `**orders(created_at, status)**`
  - If you filter by `status`, a composite index with `created_at` can help.
4. `**users(id)**`
  - Usually already present as primary key; needed for the join.
5. **For the order_items variant:**
  - `**order_items(order_id)`** — for the join from `orders` to `order_items`.

**Example DDL:**

```sql
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX idx_orders_created_status ON orders (created_at DESC, status);
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
```

---

### If the Query Is Still Slow with Millions of Rows

1. **Materialized view / summary table**
  - Pre-aggregate “spending in last 30 days” per user (e.g. nightly or hourly).  
  - Query the summary table and join to `users` for details.  
  - Refresh strategy: full refresh or incremental (e.g. only users with recent orders).
2. **Partitioning `orders` by time**
  - Range-partition by `created_at` (e.g. by month).  
  - The 30-day query hits at most 1–2 partitions, reducing scan size.
3. **Covering index**
  - Include `total_amount` (and optionally `status`) in the index so the 30-day query rarely touches the heap:  
   `CREATE INDEX idx_orders_user_created_covering ON orders (user_id, created_at DESC) INCLUDE (total_amount, status);`
4. **Approximate / sampling**
  - For dashboards, use a materialized view or sample for “good enough” top 10 and refresh periodically.
5. **Caching**
  - Cache the report result (e.g. Redis or app cache) with a short TTL (e.g. 5–15 minutes).
6. **Query tuning**
  - Ensure `work_mem` is sufficient for the hash aggregate; check `EXPLAIN (ANALYZE, BUFFERS)` for bottlenecks.

---

## B. Design Challenge: Recently Viewed Products

---

### 1. Database Schema Changes

**Option A: Single table in PostgreSQL**

```sql
CREATE TABLE user_product_views (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, product_id)
);

-- Optional: add ordering for “last viewed” and limit in app or via window functions
CREATE INDEX idx_user_product_views_user_viewed
ON user_product_views (user_id, viewed_at DESC);
```

**Semantics:** One row per (user, product); update `viewed_at` on each view. Application keeps only the 50 most recent per user (e.g. delete older after insert/update).

**Option B: Append-only with row limit per user**

```sql
CREATE TABLE user_product_views (
    id BIGSERIAL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_product_views_user_viewed
ON user_product_views (user_id, viewed_at DESC);
```

**Semantics:** Every view inserts a row. To get “last 50” you use `DISTINCT ON (product_id)` or similar, ordered by `viewed_at`, then limit; and a periodic job (or trigger) deletes excess rows per user (e.g. keep last 50 distinct products or last N rows).

---

### 2. SQL vs NoSQL (or Both)

- **PostgreSQL only:**  
  - Good for consistency, joins with `users`/`products`, and if view volume is moderate.  
  - Use a compact schema (e.g. one row per user-product with latest `viewed_at`) and a small index so “last 50” is a single index range on `(user_id, viewed_at DESC)`.
- **Redis (or similar) for “last 50”:**  
  - **Use case:** Very high view rate and need for sub-millisecond reads on homepage.  
  - **Model:** Per-user sorted set: key `user:{user_id}:recent_views`, member `product_id`, score = timestamp.  
  - `ZADD` on each view, then `ZREMRANGEBYRANK` to keep only top 50 (or 50 by recency).  
  - **Pros:** Very fast, simple retention (keep last 50). **Cons:** Another store; need sync or ETL if you want analytics in Postgres.
- **Hybrid:**  
  - Redis for low-latency “recently viewed” on homepage.  
  - Async write to Postgres (or a log) for analytics and reporting.  
  - Best when you need both speed and analytics.

**Recommendation:** Start with PostgreSQL if view volume is not huge; add Redis (or similar) if homepage latency or write throughput becomes a problem.

---

### 3. Data Retention: Only Last 50 Items

- **If one row per (user, product)**  
  - On each view: `INSERT ... ON CONFLICT (user_id, product_id) DO UPDATE SET viewed_at = NOW()`.  
  - Then delete “overflow”: e.g. for that `user_id`, delete rows that are not in the set of “current 50 most recent” (using a subquery with `viewed_at DESC` and `ROW_NUMBER()` or `ORDER BY viewed_at DESC LIMIT 50`).  
  - Or run a periodic job that, per user, deletes all but the 50 most recent.
- **If using Redis sorted set:**  
  - After each `ZADD`, call `ZREMRANGEBYRANK user:{user_id}:recent_views 0 -51` to keep only the newest 50 (assuming higher score = newer).
- **If append-only in Postgres:**  
  - Periodic job: for each user, keep only the last 50 (by `viewed_at`) or last 50 distinct products; delete the rest.  
  - Or use a trigger that runs after insert and deletes old rows for that user (can be heavy; job is often safer).

---

### 4. API Endpoint Design

**Record a view (idempotent or “upsert” semantics):**

```http
POST /api/users/me/recent-views
Content-Type: application/json

{ "product_id": "uuid" }
```

- Response: `204 No Content` or `200` with optional body (e.g. current list).
- Backend: update (or insert) view for current user and enforce “last 50” retention.

**Get recently viewed (for homepage):**

```http
GET /api/users/me/recent-views?limit=20
```

- Response: list of products (with minimal fields: id, name, image, price, etc.) ordered by `viewed_at` descending.
- Default `limit=20`; cap at 50.

---

## C. Real-World Problem: Orders Table at 10M Rows

### 1. Improve Query Performance

- **Indexing:**  
  - Add indexes aligned to access patterns (e.g. `user_id`, `created_at`, `status`, and composites like `(user_id, created_at)`).  
  - Use `EXPLAIN (ANALYZE, BUFFERS)` to validate.
- **Partitioning:**  
  - Range-partition `orders` by `created_at` (e.g. monthly).  
  - Keeps hot queries on recent partitions; older data can be compressed or moved to archive.
- **Query and schema tuning:**  
  - Avoid `SELECT `*; select only needed columns.  
  - Ensure filters use indexed columns.  
  - Use covering indexes where beneficial.
- **Archiving (see below):**  
  - Move cold data out of the main table so the “hot” table stays small and fast.
- **Read replicas:**  
  - Offload reporting and heavy reads to replicas so the primary stays responsive.
- **Caching:**  
  - Cache frequent reads (e.g. order by ID, recent orders per user) in the app or Redis.

---

### 2. Archive Old Data While Keeping It Accessible

- **Same DB, separate table:**  
  - Create `orders_archive` (same schema).  
  - Periodically move rows older than N months from `orders` to `orders_archive` (in batches, by `created_at`).  
  - Application or a read-only reporting path queries `orders_archive` when needed (e.g. “order history” or exports).
- **Partitioning + detach:**  
  - If `orders` is range-partitioned by month, “archiving” can mean detaching an old partition and moving it to an archive schema or table.  
  - Queries that need old data can hit the archive table/schema.
- **Separate archive DB / cold storage:**  
  - Export old orders to an archive database or data lake; keep a thin “index” in the main DB (e.g. order_id → archive_location) if you need to find and then fetch from archive.
- **Visibility:**  
  - API or BFF can query main table first; if not found, query archive (or a unified view that unions both with a timeout for archive).

---

### 3. Ensure Minimal Downtime During Optimization

- **Indexes:**  
  - Use `CREATE INDEX CONCURRENTLY` so the table remains writable.  
  - Avoid long-running transactions; create one index at a time and monitor replication lag if using replicas.
- **Partitioning from a large table:**  
  - Create a new partitioned table, backfill in batches (e.g. by `id` or `created_at`), then switch:  
    - Use a short maintenance window to rename tables and swap, or  
    - Use a view or synonym so the application points to the new table after backfill.
  - Double-write during migration if you need zero-downtime cutover.
- **Archiving:**  
  - Move data in small batches (e.g. by date range) and delete from main table in the same transaction (or in batches) to avoid long locks.  
  - Run during low traffic; monitor lock wait and replication.
- **Application:**  
  - Feature flags or config to switch between “main only” and “main + archive” so you can roll out and roll back without code deploys.
- **Monitoring:**  
  - Track query latency, lock waits, replication lag, and table sizes before and after each change.

---

