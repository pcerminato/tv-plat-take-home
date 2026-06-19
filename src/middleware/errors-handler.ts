import { NextFunction, Request, Response } from "express";

type AppError = Error & {
  status?: number;
};

const defaultError = {
  status: 500,
  message: "Internal Server Error",
};

export const errorHandler = (
  err: AppError,
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err.stack);

  res.status(err.status || defaultError.status).json({
    message: err.message || defaultError.message,
  });
};
