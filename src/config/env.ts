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
};
