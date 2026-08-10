import mongoose from 'mongoose';
import { ENV } from './env';
import { logger } from './logger';

export const connectDB = async (): Promise<void> => {
    try {
        await mongoose.connect(ENV.MONGODB_URI);
        logger.info('MongoDB connected');
    } catch (error) {
        logger.fatal({ err: error }, 'MongoDB connection failed');
        process.exit(1);
    }
};
