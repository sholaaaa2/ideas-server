import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { AppError } from "../helpers/index.js";
import UserModel from "../modules/user/user-model.js";

const jwtHandler = async (req, res, next) => {
    try {
        const token = req
            .header("Authorization")
            ?.replace(/^Bearer\s+/i, "");

        if (!token) {
            throw new AppError(
                "Authorization token is missing",
                401
            );
        }

        const decoded = jwt.verify(
            token,
            env.jwt.secret
        );

        const userId =
            decoded._id ||
            decoded.userId;

        if (!userId) {
            throw new AppError(
                "Invalid token payload",
                401
            );
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            throw new AppError("User not found", 401);
        }

        req.authenticatedUser = user;

        req.user = {
            userId: user._id.toString(),
            name: user.name,
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return next(
                new AppError("Token expired", 401)
            );
        }

        if (error instanceof jwt.JsonWebTokenError) {
            return next(
                new AppError("Invalid token", 401)
            );
        }

        next(error);
    }
};

export { jwtHandler };