import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { MulterError } from 'multer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/error.middleware';
import { ApiError } from '../../src/utils/ApiError';
import { LoginDTO } from '../../src/dtos/user.dto';
import { HTTP_STATUS } from '../../src/constants';

/**
 * Every route funnels its failures here, so this middleware decides whether a
 * caller sees "fix your request" or "the server is broken". No database — a
 * throwaway app whose only job is to hand the middleware one error.
 */

const throwing = (err: unknown) => {
    const app = express();
    app.get('/boom', (_req, _res, next) => next(err));
    app.use(errorHandler);
    return app;
};

// The middleware logs every error it handles; that is correct behaviour and
// pure noise in test output.
beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
    vi.restoreAllMocks();
});

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('errorHandler', () => {
    it('turns a Zod failure into a 400 listing each invalid field', async () => {
        const parsed = LoginDTO.safeParse({ email: 'not-an-email', password: '' });
        expect(parsed.success).toBe(false);

        const res = await request(throwing(parsed.error)).get('/boom');

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Validation failed');
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.stringContaining('email')]),
        );
    });

    it('turns an unrecognised error into a 500', async () => {
        const res = await request(throwing(new Error('something exploded'))).get(
            '/boom',
        );

        expect(res.status).toBe(HTTP_STATUS.INTERNAL_SERVER);
        expect(res.body.success).toBe(false);
    });

    it('honours the status carried by an ApiError', async () => {
        const res = await request(
            throwing(new ApiError(HTTP_STATUS.NOT_FOUND, 'Job not found')),
        ).get('/boom');

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
        expect(res.body.message).toBe('Job not found');
    });

    it('passes through the detail list on an ApiError that has one', async () => {
        const res = await request(
            throwing(
                new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid input', [
                    'skills: required',
                ]),
            ),
        ).get('/boom');

        expect(res.body.errors).toEqual(['skills: required']);
    });

    it('omits the errors key entirely when there is no detail', async () => {
        const res = await request(
            throwing(new ApiError(HTTP_STATUS.FORBIDDEN, 'Nope')),
        ).get('/boom');

        expect(res.body).not.toHaveProperty('errors');
    });

    it('reports a duplicate key as a 409 naming the field', async () => {
        const duplicate = Object.assign(new Error('E11000'), {
            code: 11000,
            keyPattern: { email: 1 },
        });

        const res = await request(throwing(duplicate)).get('/boom');

        expect(res.status).toBe(HTTP_STATUS.ALREADY_EXISTS);
        expect(res.body.message).toContain('email');
    });

    it('reports a malformed ObjectId as a 400, not a 500', async () => {
        const res = await request(
            throwing(
                new mongoose.Error.CastError('ObjectId', 'not-an-id', 'jobId'),
            ),
        ).get('/boom');

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(res.body.message).toContain('jobId');
    });

    it('reports an oversized upload as a 413', async () => {
        const res = await request(
            throwing(new MulterError('LIMIT_FILE_SIZE', 'resume')),
        ).get('/boom');

        expect(res.status).toBe(HTTP_STATUS.PAYLOAD_TOO_LARGE);
    });

    it('reports other upload failures as a 400', async () => {
        const res = await request(
            throwing(new MulterError('LIMIT_UNEXPECTED_FILE', 'resume')),
        ).get('/boom');

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it.each([
        ['an expired token', new TokenExpiredError('jwt expired', new Date())],
        ['an invalid token', new JsonWebTokenError('invalid signature')],
    ])('reports %s as a 401', async (_label, err) => {
        const res = await request(throwing(err)).get('/boom');

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    describe('in production', () => {
        it('hides the detail of a 500', async () => {
            process.env.NODE_ENV = 'production';

            const res = await request(
                throwing(
                    new Error(
                        'connect ECONNREFUSED 10.0.0.4:27017 — mongodb://admin:hunter2@…',
                    ),
                ),
            ).get('/boom');

            expect(res.status).toBe(HTTP_STATUS.INTERNAL_SERVER);
            expect(res.body.message).toBe('Internal Server Error');
            expect(JSON.stringify(res.body)).not.toContain('hunter2');
        });

        it('still returns messages we wrote ourselves', async () => {
            process.env.NODE_ENV = 'production';

            const res = await request(
                throwing(new ApiError(HTTP_STATUS.NOT_FOUND, 'Job not found')),
            ).get('/boom');

            expect(res.body.message).toBe('Job not found');
        });
    });
});
