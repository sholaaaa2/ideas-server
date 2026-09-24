import mongoose from 'mongoose';
import App from './app.js';
import { env } from './src/config/env.js';

mongoose
    .connect(env.mongo.url)
    .then(() => {
        console.log('[DB] connected');
        const appInstance = new App();
        appInstance.start();
    })
    .catch((error) => {
        console.log('test');
        
        console.error("[DB] connection failed");
        console.error("name:", error.name);
        console.error("message:", error.message);
        console.error("cause:", error.cause);
        console.error("reason:", error.reason);

        process.exit(1);
    });
