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
