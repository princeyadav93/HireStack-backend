import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import mongoose from 'mongoose';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { HTTP_STATUS } from '../constants';
import { logger } from '../config/logger';

interface NormalisedError {
    statusCode: number;
    message: string;
    errors?: string[];
}

/**
 * Map a thrown error onto an HTTP response.
 *
 * Anything not recognised here becomes a 500, so every error type the app can
 * realistically throw needs a branch — otherwise a user typo reads as a server
 * crash and the client cannot tell "fix your request" from "try again later".
 */
const normalise = (err: any): NormalisedError => {
    // Validation failures from any DTO.parse()
    if (err instanceof ZodError) {
        return {
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Validation failed',
            errors: err.issues.map((issue) => {
                const path = issue.path.join('.');
                return path ? `${path}: ${issue.message}` : issue.message;
            }),
        };
    }

    // File upload failures (size, unexpected field, too many files)
    if (err instanceof MulterError) {
        return {
            statusCode:
                err.code === 'LIMIT_FILE_SIZE'
                    ? HTTP_STATUS.PAYLOAD_TOO_LARGE
                    : HTTP_STATUS.BAD_REQUEST,
            message:
                err.code === 'LIMIT_FILE_SIZE'
                    ? 'File is too large. Maximum size is 2MB.'
                    : `Upload failed: ${err.message}`,
        };
    }

    // Malformed ObjectId reaching a query
    if (err instanceof mongoose.Error.CastError) {
        return {
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: `Invalid value for ${err.path}`,
        };
    }

    // Schema validation on save()/runValidators
    if (err instanceof mongoose.Error.ValidationError) {
        return {
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Validation failed',
            errors: Object.values(err.errors).map((e) => e.message),
        };
    }

    // Unique index violation — e.g. duplicate email
    if (err?.code === 11000) {
        const field = Object.keys(err.keyPattern ?? {})[0] ?? 'value';
        return {
            statusCode: HTTP_STATUS.ALREADY_EXISTS,
            message: `This ${field} is already in use`,
        };
    }

    if (err instanceof TokenExpiredError) {
        return {
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            message: 'Session expired, please login again',
        };
    }

    if (err instanceof JsonWebTokenError) {
        return {
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            message: 'Invalid token',
        };
    }

    // ApiError and anything else that carries an explicit status
    if (typeof err?.statusCode === 'number') {
        return {
            statusCode: err.statusCode,
            message: err.message || 'Something went wrong',
            errors:
                Array.isArray(err.error) && err.error.length
                    ? err.error
                    : undefined,
        };
    }

    return {
        statusCode: HTTP_STATUS.INTERNAL_SERVER,
        message: err?.message || 'Internal Server Error',
    };
};

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    _next: NextFunction,
) => {
    const { statusCode, message, errors } = normalise(err);
    const isProduction = process.env.NODE_ENV === 'production';

    // `req.log` is the per-request child logger, so this line carries the same
    // `req.id` as the access-log line for the request that failed — which is
    // what makes a stack trace traceable to the call that produced it. The
    // fallback only matters if the app is assembled without httpLogger.
    const log = req.log ?? logger;

    // Server-side faults are always logged; client mistakes are noise. The
    // method and path are already on the request log line, so only what is
    // genuinely new gets repeated here.
    if (statusCode >= HTTP_STATUS.INTERNAL_SERVER) {
        log.error({ err, statusCode }, message);
    } else if (!isProduction) {
        log.debug({ statusCode }, message);
    }

    // An unexpected 500 message can carry internal detail (driver errors, file
    // paths). Everything below 500 is a message we wrote deliberately.
    const clientMessage =
        isProduction && statusCode >= HTTP_STATUS.INTERNAL_SERVER
            ? 'Internal Server Error'
            : message;

    res.status(statusCode).json({
        success: false,
        message: clientMessage,
        ...(errors && { errors }),
    });
};
