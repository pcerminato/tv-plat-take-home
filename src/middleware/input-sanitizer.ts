import { NextFunction, Request, Response } from "express";
import { query, validationResult, matchedData } from "express-validator";

declare global {
  namespace Express {
    interface Request {
      sanitized: Record<string, any>;
    }
  }
}

function validateReq(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  req.sanitized = matchedData(req, {
    locations: ["query"],
  });

  next();
}

export const inputSanitizer = [
  query("limit").optional().toInt().isInt({ min: 1, max: 20 }).default(10),
  query("last").optional().toInt().isInt({ min: 0 }).default(0),
  query("type").optional().trim().escape(),
  query("status").optional().trim().escape(),
  validateReq,
];
