import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import TokenModel from './token-model.js';

export default class TokenService {
    static signTokens(payload) {
        const accessToken = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresInAccess });
        const refreshToken = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresInRefresh });
        return {
            accessToken,
            refreshToken
        };
    }

    static verifyToken(token, onerror = (err) => { throw err }) {
        return jwt.verify(token, env.jwt.secret, (err, payload) => {
            if (err) {
                return onerror(err);
            } else {
                return payload
            }
        });
    }

    static async upsertToken(userId, token) {
        await TokenModel.updateOne(
            { userId },
            { $set: { token } },
            { upsert: true }
        );
    }

    static async deleteToken(token){
        await TokenModel.deleteOne({token})
    }
}
