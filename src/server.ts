import http from 'http';
import app from './app';
import { ENV } from './config/env';
import { connectDB } from './config/mongodb';

const server = http.createServer(app);

connectDB();

server.listen(ENV.PORT, () => {
    console.log(`🚀 Server running on port ${ENV.PORT}`);
});

process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
