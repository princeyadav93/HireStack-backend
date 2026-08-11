import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * TRUST_PROXY validation.
 *
 * The value decides which address in X-Forwarded-For the rate limiters treat as
 * the client, and a wrong one fails silently — every user lands in a single
 * bucket, or a caller gets to forge their own address. `true` is the dangerous
 * value: Express accepts it and it trusts the entire caller-supplied chain, so
 * it has to be rejected at boot rather than discovered in production.
 *
 * env.ts validates at import time, so each case re-imports the module with a
 * different environment.
 */

const ORIGINAL = process.env.TRUST_PROXY;

const loadEnv = async (value?: string) => {
    if (value === undefined) {
        delete process.env.TRUST_PROXY;
    } else {
        process.env.TRUST_PROXY = value;
    }

    vi.resetModules();
    return import('../../src/config/env');
};

afterEach(() => {
    if (ORIGINAL === undefined) {
        delete process.env.TRUST_PROXY;
    } else {
        process.env.TRUST_PROXY = ORIGINAL;
    }
    vi.resetModules();
});

describe('TRUST_PROXY', () => {
    it('defaults to one hop', async () => {
        const { ENV } = await loadEnv(undefined);

        expect(ENV.TRUST_PROXY).toBe(1);
    });

    it('accepts a hop count', async () => {
        const { ENV } = await loadEnv('2');

        expect(ENV.TRUST_PROXY).toBe(2);
    });

    it('accepts zero, for running with no proxy at all', async () => {
        const { ENV } = await loadEnv('0');

        expect(ENV.TRUST_PROXY).toBe(0);
    });

    it('refuses to boot on `true`', async () => {
        // The whole reason this validation exists: `true` trusts the entire
        // forwarded chain, so anyone can send a header and get a fresh rate
        // limit bucket per request.
        await expect(loadEnv('true')).rejects.toThrow(/hop count/);
    });

    it('refuses to boot on a non-numeric value', async () => {
        await expect(loadEnv('yes')).rejects.toThrow(/hop count/);
    });

    it('refuses to boot on a negative or fractional value', async () => {
        await expect(loadEnv('-1')).rejects.toThrow(/hop count/);
        await expect(loadEnv('1.5')).rejects.toThrow(/hop count/);
    });
});
