import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate } from "../scripts/migrate";
import { seed } from "../scripts/seed";
import { pool } from "../src/db";
import { buildResourcesUri } from "./utils";
import { DEFAULT_LIMIT } from "../src/data/resources";

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

describe("GET /resources", () => {
  it.each([
    { role: "admin", result: 9 },
    { role: "member", result: 8 },
  ])(
    "returns the full seeded set of resources for role=$role",
    async ({ role, result }) => {
      const res = await request(app).get("/resources").set(headers[role]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(result);
    },
  );

  describe("Paginated resources", () => {
    it.each([
      { limit: 10, last: 10, result: 5, role: "admin" },
      { limit: "10", last: "10", result: 5, role: "admin" },
      { limit: 11, result: 9, role: "admin" },
      { last: 29, result: 1, role: "admin" },
      { last: 1, result: 8, role: "admin" },
      { limit: 10, last: 29, result: 1, role: "admin" },
      { last: 31, result: 0, role: "admin" },
      { limit: undefined, last: undefined, result: 9, role: "admin" },
    ])(
      "returns a paginated set of $result resources",
      async ({ limit, last, result, role }) => {
        const uri = buildResourcesUri({ limit, last });
        const res = await request(app).get(uri).set(headers[role]);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(result);
      },
    );
    it.each([
      { limit: 50, last: undefined, role: "admin" },
      { limit: "hello", last: "world", role: "admin" },
      { limit: undefined, last: "DROP%20TABLE%20users;", role: "admin" },
    ])(
      "returns an error for a bad input. Limit: %s, Last: %s",
      async ({ limit, last, role }) => {
        const uri = buildResourcesUri({ limit, last });
        const res = await request(app).get(uri).set(headers[role]);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("errors");
      },
    );
  });

  describe("Filtered resources", () => {
    it.each([
      { status: undefined, type: undefined, result: 9, role: "admin" },
      { type: "sheet", result: 3, role: "admin" },
      { type: "doc", result: 3, role: "admin" },
      { type: "slide", result: 3, role: "admin" },
      { status: "archived", result: 3, role: "admin" },
      { status: "draft", result: 3, role: "admin" },
      { status: "published", result: 3, role: "admin" },
      { status: "published", type: "doc", result: 0, role: "admin" },
      { type: "doc", last: 16, result: 1, role: "admin" },
    ])(
      "returns $result resources for filters status:$status and type:$type",
      async ({ status, type, last, result, role }) => {
        const uri = buildResourcesUri({ status, type, last });
        const res = await request(app).get(uri).set(headers[role]);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(result);
      },
    );
  });
});

describe("GET /resources/recent", () => {
  it("returns the full seeded set of resources", async () => {
    const res = await request(app).get("/resources/recent");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(DEFAULT_LIMIT);
    // checks the values come DESC
    expect(parseInt(res.body[0].id)).toBeGreaterThan(
      parseInt(res.body[DEFAULT_LIMIT - 1].id),
    );
  });
});

describe("GET /users/:userId/resources", () => {
  it("returns the a set of resources for a user", async () => {
    const res = await request(app).get("/users/4/resources");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
