import { Request, Response, NextFunction } from 'express';

/**
 * Async handler wrapper to catch errors from async route handlers
 * Eliminates the need for repeated try-catch blocks
 */
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
