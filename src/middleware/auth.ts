import { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
      role?: string;
    }
  }
}

// Auth STUB — there is no real authentication here. It simply reads the
// `x-user-id` header and attaches it to the request.
//
// NOTE: the data layer currently IGNORES req.userId. Wiring it into access
// control is intentionally left undone (see CHALLENGE.md, task 2).
export function authStub(req: Request, res: Response, next: NextFunction) {
  const xUserId = req.header("x-user-id");
  const xUserRole = req.header("x-user-role");

  const userId = xUserId ? Number(xUserId) : undefined;
  const userRole = xUserRole ? xUserRole : undefined;

  if (userId === undefined || userRole === undefined) {
    return res.status(401).json({
      message: "Unauthorized: invalid or expired authentication",
    });
  }

  req.userId = userId;
  req.role = userRole;

  next();
}
