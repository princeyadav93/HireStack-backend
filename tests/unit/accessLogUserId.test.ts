import { Writable } from 'stream';
import express, { type Request } from 'express';
import { Types } from 'mongoose';
import pino from 'pino';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { httpLoggerOptions } from '../../src/config/logger';

/**
 * The access log names whoever caused the line.
 *
 * This is tested because the obvious implementation is wrong in a way nothing
 * reports. Reading the user off the `req` serializer looks correct and yields
 * a field that is undefined on every single request: pino-http serialises the
 * request on the way in — before verifyJWT has attached anything — and reuses
 * that snapshot when the response finishes. No error, no warning, just an
 * attribute that is never present. Reading a real line back is the only thing
 * that catches it.
 */

type LogLine = { req: { url: string }; userId?: string };

const userId = new Types.ObjectId();

/** The real logger options with only the destination swapped for a readable one. */
const probe = () => {
    const lines: LogLine[] = [];

    const sink = new Writable({
        write(chunk, _encoding, callback) {
            lines.push(JSON.parse(chunk.toString()) as LogLine);
            callback();
        },
    });

    const app = express();

    app.use(
        pinoHttp({
            ...httpLoggerOptions,
            // The exported `logger` is silent under NODE_ENV=test and writes to
            // a file descriptor otherwise, which is why the options are split
            // out from it in the first place.
            logger: pino({ level: 'info' }, sink),
        }),
    );

    // Stands in for verifyJWT, which app.ts mounts *after* httpLogger. That
    // ordering is the entire difficulty being tested.
    app.use((req, _res, next) => {
        if (req.path === '/private') {
            // Only _id is read, so a fragment of a user document is enough.
            req.user = { _id: userId } as unknown as Request['user'];
        }
        next();
    });

    app.get('/private', (_req, res) => {
        res.json({ ok: true });
    });

    app.get('/public', (_req, res) => {
        res.json({ ok: true });
    });

    return { app, lines };
};

/** pino writes on the response's finish event, which lands a tick behind supertest. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('access log attribution', () => {
    it('records the id of the authenticated caller', async () => {
        const { app, lines } = probe();

        await request(app).get('/private');
        await flush();

        expect(lines).toHaveLength(1);
        expect(lines[0].userId).toBe(userId.toString());
    });

    it('omits the field for an anonymous request', async () => {
        const { app, lines } = probe();

        await request(app).get('/public');
        await flush();

        expect(lines).toHaveLength(1);
        expect(lines[0].userId).toBeUndefined();
    });

    it('still carries the request id and path the line is useless without', async () => {
        const { app, lines } = probe();

        await request(app).get('/private');
        await flush();

        expect(lines[0].req.url).toBe('/private');
    });
});
