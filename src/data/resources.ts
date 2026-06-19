import { pool } from "../db";

export interface FindResourcesOpts {
  ownerId?: number;
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
}

export const DEFAULT_LIMIT = 10;

// SHARED PATH — used by multiple endpoints. Changing this affects all callers.
//
// There is NO access control here: every caller sees every resource it asks
// for, regardless of who is making the request. The auth stub populates
// req.userId but it never reaches this function.
export async function findResources(
  opts: FindResourcesOpts = {},
): Promise<ResourceRow[]> {
  const params: unknown[] = [];
  let sql = `
    SELECT id, owner_id, type, status, title, created_at, updated_at
    FROM resources
  `;

  if (
    opts.ownerId !== undefined ||
    opts.last !== undefined ||
    opts.type !== undefined ||
    opts.status !== undefined
  ) {
    let where = "";

    if (opts.ownerId !== undefined) {
      params.push(opts.ownerId);
      where += ` owner_id = $${params.length}`;
    }

    if (opts.last !== undefined) {
      if (where !== "") {
        where += " AND";
      }
      params.push(opts.last);
      where += ` id > $${params.length}`;
    }

    if (opts.type !== undefined) {
      if (where !== "") {
        where += " AND";
      }
      params.push(opts.type);
      where += ` type = $${params.length}`;
    }

    if (opts.status !== undefined) {
      if (where !== "") {
        where += " AND";
      }
      params.push(opts.status);
      where += ` status = $${params.length}`;
    }

    sql += " WHERE " + where;
  }

  // orderBy is only ever passed internally (never from request input).
  if (opts.orderBy) {
    params.push(opts.orderBy);
    sql += ` ORDER BY $${params.length}`;
  }

  if (opts.last !== undefined || opts.limit !== undefined) {
    params.push(opts?.limit || DEFAULT_LIMIT);
    sql += ` LIMIT $${params.length}`;
  }

  const result = await pool.query<ResourceRow>(sql, params);
  return result.rows;
}
