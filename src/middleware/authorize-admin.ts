import { NextFunction, Request, Response } from "express";

export function authorizeAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { role } = req;

  if (role !== "admin") {
    return res.status(403).json({
      message: "Forbiden: admin role required.",
    });
  }
  next();
}
