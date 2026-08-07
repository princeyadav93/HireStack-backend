import { Request } from 'express';
import { ApiError } from './ApiError';
import { HTTP_STATUS } from '../constants';

/**
 * Read a route parameter as a single string.
 *
 * Express types params as `string | string[]` because a pattern can repeat a
 * name; this collapses that to the first value and rejects a missing one.
 */
export const getParam = (req: Request, name: string): string => {
    const raw = req.params[name];
    const value = Array.isArray(raw) ? raw[0] : raw;

    if (!value) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${name} is required`);
    }

    return value;
};
