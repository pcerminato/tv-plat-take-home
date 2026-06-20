import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate } from "../scripts/migrate";
import { seed } from "../scripts/seed";
import { pool } from "../src/db";
import { buildResourcesUri } from "./utils";
import { DEFAULT_LIMIT, ResourceRow } from "../src/data/resources";

const app = createApp();

const headers: Record<string, { "x-user-id": string; "x-user-role": string }> =
  {
    admin: { "x-user-id": "2", "x-user-role": "admin" },
    member: { "x-user-id": "2", "x-user-role": "member" },
  };

beforeAll(async () => {
  // Boot against the docker Postgres: apply migrations, then reset + seed.
  await migrate();
  await seed();
});

afterAll(async () => {
  await pool.end();
});

describe("role:admin", () => {
  it("Should have access to /user/:ownerId/resources", async () => {
    const res = await request(app)
      .get("/users/2/resources")
      .set(headers["admin"]);

    expect(res.status).toBe(200);
  });
  it("Should have authorization failed for a missing role", async () => {
    const res = await request(app).get("/users/2/resources");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe(
      "Unauthorized: invalid or expired authentication",
    );
  });
});

describe("role:member", () => {
  it("Should have access denied to /user/:ownerId/resources", async () => {
    const res = await request(app)
      .get("/users/2/resources")
      .set(headers["member"]);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Forbiden: admin role required.");
  });

  it("Should have visibility only of owned resources", async () => {
    const response = await request(app)
      .get("/resources")
      .set(headers["member"]);
    const ownerId = headers["member"]["x-user-id"];

    expect(response.status).toBe(200);
    expect(
      (response.body as ResourceRow[]).every((r) => {
        return r.owner_id === ownerId && r.shared_user_id === null;
      }),
    ).toBe(true);
  });
});
