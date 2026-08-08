import { createHash, timingSafeEqual } from 'crypto';

/**
 * Hash a token for storage.
 *
 * SHA-256 rather than bcrypt, deliberately.
 *
 * bcrypt reads at most the first 72 bytes of its input and silently ignores the
 * rest. Every refresh token issued to a given user shares a far longer prefix
 * than that — the payload is only `{ userId, type, iat, exp, jti }`, so the JWT
 * header plus the start of the payload runs to ~128 identical characters and
 * everything that actually differs sits past the cutoff. The consequence was
 * that `bcrypt.compare` returned true for *any* of that user's tokens against
 * *any* stored hash, so the stored value bound nothing and rotation never
 * revoked the token it replaced.
 *
 * A slow KDF buys nothing here in any case. bcrypt's work factor exists to make
 * guessing a low-entropy human password expensive; a signed JWT is already
 * high-entropy and cannot be brute-forced from its hash. Passwords still use
 * bcrypt — that is the right tool for those.
 */
export const hashToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

/**
 * Compare a token against a stored hash in constant time.
 *
 * timingSafeEqual throws when the two buffers differ in length, so the length
 * check has to come first. It also covers hashes written by the previous bcrypt
 * scheme: those are not hex, so they decode to a short buffer and fail here
 * rather than throwing. Sessions predating this change are rejected once and the
 * user logs in again.
 */
export const tokenMatchesHash = (
    token: string,
    storedHash: string,
): boolean => {
    const candidate = Buffer.from(hashToken(token), 'hex');
    const stored = Buffer.from(storedHash, 'hex');

    if (candidate.length !== stored.length) {
        return false;
    }

    return timingSafeEqual(candidate, stored);
};
