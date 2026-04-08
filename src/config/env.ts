import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function getEnv(key: string, defaultvalue?: string): string {
    const value = process.env[key] || defaultvalue;
    if (!value) {
        throw new Error(
            `Environment variable ${key} is not set and no default value provided.`,
        );
    }

    return value;
}

export const ENV = {
    PORT: getEnv('PORT', '3000'),
    MONGODB_URI: getEnv('MONGODB_URI', 'null'),
    JWT_SECRET: getEnv('JWT_SECRET', 'null'),
    CORS_ORIGIN: getEnv('CORS_ORIGIN', '*'),
    REFRESH_TOKEN_SECRET: getEnv('REFRESH_TOKEN_SECRET', 'null'),
    REFRESH_TOKEN_EXPIRY: getEnv('REFRESH_TOKEN_EXPIRY', '10d'),
    CLOUDINARY_NAME: getEnv('CLOUDINARY_NAME', 'null'),
    CLOUDINARY_API_KEY: getEnv('CLOUDINARY_API_KEY', 'null'),
    CLOUDINARY_API_SECRET: getEnv('CLOUDINARY_API_SECRET', 'null'),
};
