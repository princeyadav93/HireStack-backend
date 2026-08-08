import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { hashToken, tokenMatchesHash } from '../../src/utils/hashToken';

/**
 * Regression tests for the bcrypt 72-byte truncation bug.
 *
 * bcrypt hashes only the first 72 bytes of its input. Refresh tokens for one
 * user share ~128 identical leading characters, so every one of them matched
 * every stored hash and rotation revoked nothing. These tests pin the property
 * that broke, using real JWTs rather than contrived strings.
 */

const SECRET = 'test-secret';
const USER_ID = '68a1f2c3d4e5f60718293a4b';

const refreshTokenLike = () =>
    jwt.sign({ userId: USER_ID, type: 'refresh' }, SECRET, {
        expiresIn: '10d',
        jwtid: Math.random().toString(36).slice(2),
    });

describe('hashToken', () => {
    it('produces a 64-character hex digest', () => {
        expect(hashToken('anything')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
        expect(hashToken('same input')).toBe(hashToken('same input'));
    });

    it('distinguishes inputs that differ only past byte 72', () => {
        // The exact shape bcrypt could not see. 72 shared bytes, then a
        // difference — which is where every meaningful part of a JWT lives.
        const prefix = 'x'.repeat(72);

        expect(hashToken(`${prefix}A`)).not.toBe(hashToken(`${prefix}B`));
    });

    it('distinguishes two real refresh tokens for the same user', () => {
        const a = refreshTokenLike();
        const b = refreshTokenLike();

        expect(a).not.toBe(b);
        expect(a.slice(0, 72)).toBe(b.slice(0, 72)); // the trap
        expect(hashToken(a)).not.toBe(hashToken(b));
    });
});

describe('tokenMatchesHash', () => {
    it('accepts the token it was derived from', () => {
        const token = refreshTokenLike();

        expect(tokenMatchesHash(token, hashToken(token))).toBe(true);
    });

    it('rejects a different token for the same user', () => {
        const stored = hashToken(refreshTokenLike());

        // This is the assertion that failed under bcrypt.
        expect(tokenMatchesHash(refreshTokenLike(), stored)).toBe(false);
    });

    it('rejects a token that differs only past byte 72', () => {
        const prefix = 'y'.repeat(72);

        expect(tokenMatchesHash(`${prefix}A`, hashToken(`${prefix}B`))).toBe(
            false,
        );
    });

    it('rejects a legacy bcrypt hash without throwing', () => {
        // Sessions that predate the change. timingSafeEqual throws on a length
        // mismatch, so this has to be handled rather than blow up as a 500.
        const legacy = bcrypt.hashSync(refreshTokenLike(), 4);

        expect(() => tokenMatchesHash(refreshTokenLike(), legacy)).not.toThrow();
        expect(tokenMatchesHash(refreshTokenLike(), legacy)).toBe(false);
    });

    it.each([
        ['empty', ''],
        ['not hex', 'zzzz'],
        ['too short', 'abcd'],
    ])('rejects a %s stored value without throwing', (_label, stored) => {
        expect(() => tokenMatchesHash('token', stored)).not.toThrow();
        expect(tokenMatchesHash('token', stored)).toBe(false);
    });
});
