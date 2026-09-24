import 'dotenv/config';

const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);

export const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 5001),
    corsOrigins: corsOrigins.length ? corsOrigins : '*',
    jwt: {
        secret: process.env.JWT_SECRET || 'secret_key_jwt',
        expiresInAccess: process.env.JWT_EXPIRES_IN_ACCESS || '15m',
        expiresInRefresh: process.env.JWT_EXPIRES_IN_REFRESH || '7d'
    },
    mongo: {
        url: process.env.MONGO_URL || '',
    }
};