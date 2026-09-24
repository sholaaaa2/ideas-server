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
        console.log(error.message);
        process.exit(1);
    });
