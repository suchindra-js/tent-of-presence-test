import { Request, Response, NextFunction } from "express";

export function asyncHandler<R extends Request>(
  fn: (req: R, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req as R, res, next)).catch(next);
  };
}
