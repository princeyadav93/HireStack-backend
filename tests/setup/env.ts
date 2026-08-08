/**
 * Test environment variables.
 *
 * src/config/env.ts validates on import and throws if anything required is
 * missing, so these have to be in place before any src module is loaded. This
 * file deliberately imports nothing — an import would be hoisted above the
 * assignments below and defeat the point.
 *
 * `??=` rather than `=`: a value already exported by the shell wins, so CI can
 * override without editing this file. dotenv does not overwrite what is already
 * set, so a developer's .env cannot clobber these either.
 */

process.env.NODE_ENV ??= 'test';

// Both of these are checked together before rate limiting is skipped, so a
// stray NODE_ENV=test in production cannot switch it off on its own.
process.env.DISABLE_RATE_LIMIT ??= 'true';

// Never connected to. Tests talk to the in-memory replica set from
// globalSetup; this only exists to satisfy the boot-time check.
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/hirestack-unused';

process.env.JWT_SECRET ??= 'test-jwt-secret';

// Deliberately the same value as JWT_SECRET. env.ts falls back to exactly this
// when REFRESH_TOKEN_SECRET is unset, so it is the configuration most
// deployments actually run — and the only one where a refresh token's
// signature verifies as an access token. Testing against it is what makes the
// `type` claim assertions meaningful; with distinct secrets those tests would
// pass on the signature check alone and prove nothing.
process.env.REFRESH_TOKEN_SECRET ??= 'test-jwt-secret';

process.env.REFRESH_TOKEN_EXPIRY ??= '10d';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';

// Cloudinary is configured at import but not called — uploads are not exercised.
process.env.CLOUDINARY_NAME ??= 'test-cloud';
process.env.CLOUDINARY_API_KEY ??= 'test-key';
process.env.CLOUDINARY_API_SECRET ??= 'test-secret';

// 4, not the production value: bcrypt is deliberately slow, and auth.service.ts
// hashes a dummy password at module load. At 10 rounds that alone costs ~100ms
// per test file.
process.env.SALTROUNDS ??= '4';
