import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate } from "../scripts/migrate";
import { seed } from "../scripts/seed";
import { pool } from "../src/db";
import { buildResourcesUri } from "./utils";
import { DEFAULT_LIMIT } from "../src/data/resources";

const app = createApp();

beforeAll(async () => {
  // Boot against the docker Postgres: apply migrations, then reset + seed.
  await migrate();
  await seed();
});

afterAll(async () => {
  await pool.end();
});

describe("GET /resources", () => {
  it("returns the full seeded set of resources", async () => {
    const res = await request(app).get("/resources");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(30);
  });

  it.each([
    { limit: 10, last: 10, result: 10 },
    { limit: "10", last: "10", result: 10 },
    { limit: 11, last: undefined, result: 11 },
    { limit: undefined, last: 29, result: 1 },
    { limit: undefined, last: 1, result: DEFAULT_LIMIT },
    { limit: 10, last: 29, result: 1 }, // limit beyound available results
    { limit: undefined, last: 31, result: 0 }, // last higher that available
    { limit: undefined, last: undefined, result: 30 }, // expect the full set
  ])(
    "returns a paginated set of $result resources",
    async ({ limit, last, result }) => {
      const uri = buildResourcesUri(limit, last);
      const res = await request(app).get(uri);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(result);
    },
  );

  it.each([
    [50, undefined],
    ["hello", "world"],
    [undefined, "DROP%20TABLE%20users;"],
  ])(
    "returns an error for a bad input. Limit: %s, Last: %s",
    async (limit, last) => {
      const uri = buildResourcesUri(limit, last);
      const res = await request(app).get(uri);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("errors");
    },
  );
});
