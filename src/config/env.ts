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
};
