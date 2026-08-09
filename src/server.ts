import http from 'http';
import mongoose from 'mongoose';
import app from './app';
import { ENV } from './config/env';
import { logger } from './config/logger';
import { connectDB } from './config/mongodb';

const server = http.createServer(app);

connectDB();

server.listen(ENV.PORT, () => {
    logger.info({ port: ENV.PORT, env: ENV.NODE_ENV }, 'Server started');
});

/**
 * Graceful shutdown.
 *
 * SIGTERM is the one that matters in production: it is what Render, Docker and
 * Kubernetes send on every deploy, restart and scale-down, followed by a hard
 * kill a few seconds later. Ignore it and each deploy severs whatever requests
 * were mid-flight — a user's registration dies half-written because you pushed
 * a commit. Closing the server first stops new connections while letting the
 * ones already open finish.
 *
 * SIGINT is the same handler for Ctrl+C locally.
 */
const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');

    // Stops accepting new connections, then fires once the open ones drain.
    server.close(async () => {
        await mongoose.connection.close();
        logger.info('Shutdown complete');
        process.exit(0);
    });

    // A request that never finishes would otherwise hold the process open
    // until the platform kills it uncleanly. Ten seconds sits inside the grace
    // period every host gives before SIGKILL.
    setTimeout(() => {
        logger.error('Shutdown timed out, forcing exit');
        process.exit(1);
    }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
