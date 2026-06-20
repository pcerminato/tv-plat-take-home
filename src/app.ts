import express from "express";
import { NextFunction, Request, Response } from "express";
import { authStub } from "./middleware/auth";
import { findResources, UserRole } from "./data/resources";
import { inputSanitizer } from "./middleware/input-sanitizer";
import { errorHandler } from "./middleware/errors-handler";
import { authorizeAdmin } from "./middleware/authorize-admin";

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
        const { userId: ownerId, role } = req;
        if (role === undefined || ownerId === undefined) {
          throw Error("Authorization failed");
        }
        const resources = await findResources({
          last,
          limit,
          status,
          type,
          ownerId,
          role: role as UserRole,
        });

        res.json(resources);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /resources/recent
  // Caller #2 of the shared findResources path.
  app.get("/resources/recent", async (req, res, next) => {
    try {
      const { userId: ownerId, role } = req;

      if (role === undefined || ownerId === undefined) {
        throw Error("Authorization failed");
      }

      const resources = await findResources({
        limit: 10,
        orderBy: "created_at desc",
        ownerId: ownerId as number,
        role: role as UserRole,
      });
      res.json(resources);
    } catch (err) {
      next(err);
    }
  });

  // GET /users/:userId/resources
  // Caller #3 of the shared findResources path.
  app.get(
    "/users/:userId/resources",
    authorizeAdmin,
    async (req, res, next) => {
      try {
        const ownerId = Number(req.params.userId);
        const { role } = req;
        const resources = await findResources({
          ownerId,
          role: role as UserRole,
        });
        res.json(resources);
      } catch (err) {
        next(err);
      }
    },
  );

  app.use(errorHandler);

  return app;
}
