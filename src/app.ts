import express from "express";
import { NextFunction, Request, Response } from "express";
import { authStub } from "./middleware/auth";
import { findResources } from "./data/resources";
import { inputSanitizer } from "./middleware/input-sanitizer";
import { errorHandler } from "./middleware/errors-handler";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(authStub);

  // GET /resources
  // Caller #1 of the shared findResources path.
  // Returns ALL resources — no filtering, no pagination, no input validation.
  // (See CHALLENGE.md, task 1.)
  app.get(
    "/resources",
    inputSanitizer,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { limit, last, status, type } = req.sanitized;
        const resources = await findResources({
          last,
          limit,
          status,
          type,
        });
        res.json(resources);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /resources/recent
  // Caller #2 of the shared findResources path.
  app.get("/resources/recent", async (_req, res, next) => {
    try {
      const resources = await findResources({
        limit: 10,
        orderBy: "created_at desc",
      });
      res.json(resources);
    } catch (err) {
      next(err);
    }
  });

  // GET /users/:userId/resources
  // Caller #3 of the shared findResources path.
  app.get("/users/:userId/resources", async (req, res, next) => {
    try {
      const ownerId = Number(req.params.userId);
      const resources = await findResources({ ownerId });
      res.json(resources);
    } catch (err) {
      next(err);
    }
  });

  app.use(errorHandler);

  return app;
}
