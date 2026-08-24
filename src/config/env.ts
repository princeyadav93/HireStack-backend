import dotenv from 'dotenv';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';

dotenv.config({ quiet: true });

function getEnv(key: string, defaultvalue?: string): string {
    const value = process.env[key] || defaultvalue;
    if (!value) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `Environment variable ${key} is not set and no default value provided.`,
        );
    }

    return value;
}

// Validate required env vars
const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'CLOUDINARY_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'SALTROUNDS',
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `Required environment variable missing: ${envVar}`,
        );
    }
}

// Optional: absent means "feature off", so these must not go through getEnv,
// which treats an empty value as a fatal misconfiguration.
function optionalEnv(key: string): string {
    return process.env[key]?.trim() ?? '';
}

/**
 * How many proxy hops sit between the internet and this process.
 *
 * Configurable because the right value is a property of the deployment, not of
 * the code, and it cannot be known until the thing is actually deployed:
 * Render's load balancer alone is 1, a Vercel rewrite in front of it is 2,
 * Cloudflare in front of that is 3. Getting it wrong does not raise an error —
 * it silently makes every request look like it came from the same address, so
 * all users share one rate-limit bucket and the 5-per-hour email limiter
 * becomes 5 per hour for the entire platform.
 *
 * Measure rather than guess: `ip` is on every request log line (see
 * logger.ts), so call the API from a known address and compare.
 *
 * Validated as a non-negative integer specifically so `TRUST_PROXY=true`
 * fails at boot instead of at runtime. Express accepts `true` and it is the
 * one value that must never be used: it trusts the whole caller-supplied
 * X-Forwarded-For chain, so anyone can forge a header, get a fresh bucket per
 * request, and walk past every limiter.
 */
function parseTrustProxy(): number {
    const raw = getEnv('TRUST_PROXY', '1');
    const hops = Number(raw);

    if (!Number.isInteger(hops) || hops < 0) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `TRUST_PROXY must be a non-negative integer — it is a hop count, ` +
                `not a boolean. Got "${raw}".`,
        );
    }

    return hops;
}

export const ENV = {
    PORT: getEnv('PORT', '3000'),
    MONGODB_URI: getEnv('MONGODB_URI'),
    JWT_SECRET: getEnv('JWT_SECRET'),
    CORS_ORIGIN: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
    REFRESH_TOKEN_SECRET: getEnv('REFRESH_TOKEN_SECRET', getEnv('JWT_SECRET')),
    REFRESH_TOKEN_EXPIRY: getEnv('REFRESH_TOKEN_EXPIRY', '10d'),
    CLOUDINARY_NAME: getEnv('CLOUDINARY_NAME'),
    CLOUDINARY_API_KEY: getEnv('CLOUDINARY_API_KEY'),
    CLOUDINARY_API_SECRET: getEnv('CLOUDINARY_API_SECRET'),
    NODE_ENV: getEnv('NODE_ENV', 'development'),
    SALTROUNDS: parseInt(getEnv('SALTROUNDS')),

    // Number of proxy hops in front of the app — see parseTrustProxy above.
    TRUST_PROXY: parseTrustProxy(),

    // Blank means "let logger.ts pick by environment". Set it to raise or lower
    // verbosity on a deployed instance without a code change — the usual reason
    // being to turn `debug` on for ten minutes while chasing something.
    LOG_LEVEL: optionalEnv('LOG_LEVEL'),

    // ─── Email ────────────────────────────────────────────────
    // Where the links in emails point: the frontend that will call this API,
    // not the API itself. A reset link has to open a page with a password
    // form on it.
    APP_URL: getEnv('APP_URL', 'http://localhost:5173'),
    EMAIL_FROM: getEnv('EMAIL_FROM', 'HireStack <no-reply@hirestack.local>'),

    // SMTP is the common denominator — Resend, SendGrid, Mailgun, SES, Gmail
    // and Mailtrap all expose it, so choosing a provider is configuration
    // rather than a code change. Leave SMTP_HOST unset and mail is written to
    // the console instead, which is enough to develop the whole flow.
    SMTP_HOST: optionalEnv('SMTP_HOST'),
    SMTP_PORT: parseInt(optionalEnv('SMTP_PORT') || '587'),
    SMTP_USER: optionalEnv('SMTP_USER'),
    SMTP_PASS: optionalEnv('SMTP_PASS'),
    // Implicit TLS (port 465). Port 587 upgrades with STARTTLS instead, which
    // nodemailer negotiates on its own, so this stays false there.
    SMTP_SECURE: optionalEnv('SMTP_SECURE') === 'true',
};
