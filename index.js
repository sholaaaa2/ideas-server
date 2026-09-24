import mongoose from 'mongoose';
import App from './app.js';
import { env } from './src/config/env.js';

import net from 'net';
import dns from 'dns/promises';

console.log("### DEPLOY TEST 9999 ###");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Mongo URL exists:", !!env.mongo.url);

const mongoHost = 'ac-axkggw0-shard-00-00.4nuzgo4.mongodb.net';

try {
    const resolved = await dns.lookup(mongoHost);
    console.log('[TEST] DNS OK:', mongoHost, '->', resolved.address);
} catch (e) {
    console.error('[TEST] DNS FAILED:', e);
}

const socket = net.createConnection({
    host: mongoHost,
    port: 27017,
    timeout: 10000
});

socket.on('connect', () => {
    console.log('[TEST] TCP 27017 CONNECTED');
    socket.destroy();
});

socket.on('timeout', () => {
    console.error('[TEST] TCP 27017 TIMEOUT');
    socket.destroy();
});

socket.on('error', (err) => {
    console.error('[TEST] TCP 27017 ERROR:', {
        code: err.code,
        message: err.message
    });
});

setTimeout(() => {
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
}, 12000);
