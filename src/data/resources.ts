import { pool } from "../db";

export type UserRole = "admin" | "member";

export interface FindResourcesOpts {
  ownerId: number;
  role: UserRole;
  limit?: number;
  last?: number;
  orderBy?: string;
  type?: string;
  status?: string;
}

export interface ResourceRow {
  id: string;
  owner_id: string;
  type: string;
  status: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  shared_user_id: string | null;
}

export const DEFAULT_LIMIT = 10;

export async function findResources(
  opts: FindResourcesOpts,
): Promise<ResourceRow[]> {
  const params: unknown[] = [];
  let sql = "";

  // Admin Role — High-performance UNION to pull owned AND shared items
  if (opts.role === "admin") {
    // Resources owned by the user
    params.push(opts.ownerId);
    let ownedQuery = `
      SELECT r.id, r.owner_id, r.type, r.status, r.title, r.created_at, r.updated_at, rs.user_id AS shared_user_id
      FROM resources r
      LEFT JOIN resource_shares rs ON r.id = rs.resource_id
      WHERE r.owner_id = $${params.length}
    `;
    ownedQuery += buildSharedFilters(opts, params);

    // Resources shared with the user
    params.push(opts.ownerId);
    let sharedQuery = `
      SELECT r.id, r.owner_id, r.type, r.status, r.title, r.created_at, r.updated_at, rs.user_id AS shared_user_id
      FROM resources r
      INNER JOIN resource_shares rs ON r.id = rs.resource_id
      WHERE rs.user_id = $${params.length}
    `;
    sharedQuery += buildSharedFilters(opts, params);

    sql = `(${ownedQuery}) UNION (${sharedQuery})`;
  } else {
    // Member Role — Original simple query. Can only fetch owned items.
    params.push(opts.ownerId);
    sql = `
      SELECT r.id, r.owner_id, r.type, r.status, r.title, r.created_at, r.updated_at, NULL AS shared_user_id
      FROM resources r
      WHERE r.owner_id = $${params.length}
    `;
    sql += buildSharedFilters(opts, params);
  }

  if (opts.orderBy) {
    sql += ` ORDER BY ${opts.orderBy}`;
  }

  if (opts.last !== undefined || opts.limit !== undefined) {
    params.push(opts?.limit || DEFAULT_LIMIT);
    sql += ` LIMIT $${params.length}`;
  }

  const result = await pool.query<ResourceRow>(sql, params);

  return result.rows;
}

/* Helper to build the filters for the WHERE clause */
const buildSharedFilters = (opts: FindResourcesOpts, params: unknown[]) => {
  let filters = "";

  if (opts.last !== undefined && opts.last !== null) {
    params.push(opts.last);
    filters += ` AND r.id > $${params.length}`;
  }

  if (opts.type !== undefined && opts.type !== null) {
    params.push(opts.type);
    filters += ` AND r.type = $${params.length}`;
  }

  if (opts.status !== undefined && opts.status !== null) {
    params.push(opts.status);
    filters += ` AND r.status = $${params.length}`;
  }

  return filters;
};
