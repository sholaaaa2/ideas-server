import { ctrlWrapper } from "../../helpers/index.js";
import { env } from "../../config/env.js";
import UserService from "./user-service.js";

class UserController {
    static login = ctrlWrapper(async (req, res) => {
        const user = await UserService.login(req.body);
        const { tokens, ...restUser } = user;

        res.cookie("refresh_token", tokens.refreshToken, {
            httpOnly: true,
            secure: env.nodeEnv === "production",
            sameSite: "lax",
            maxAge:
                1000 * 60 * 60 * 24 * 7,
        });

        res.json({
            success: true,
            message: "login success",
            data: {
                user: restUser,
                token: tokens.accessToken,
            },
        });
    });

    static refresh = ctrlWrapper(async (req, res) => {
        const { refresh_token: oldToken, } = req.cookies;
        const { user, tokens } = await UserService.refresh(oldToken);

        res.cookie("refresh_token", tokens.refreshToken, {
            httpOnly: true,
            secure: env.nodeEnv === "production",
            sameSite: "lax",
            maxAge:
                1000 * 60 * 60 * 24 * 7,
        });

        res.json({
            success: true,
            message: "refresh success",
            data: {
                user,
                token: tokens.accessToken,
            },
        });
    });

    static logout = ctrlWrapper(async (req, res) => {
        const { refresh_token } = req.cookies;
        if (refresh_token) {
            await UserService.logout(refresh_token);
        }

        res.clearCookie("refresh_token", {
            httpOnly: true,
            secure: env.nodeEnv === "production",
            sameSite: "lax",
        });

        res.json({
            success: true,
            message: "logout success",
        });
    });

    static get = ctrlWrapper(async (req, res) => {
        const { page: rawPage, limit: rawLimit, ...filters } = req.query;

        let page = Number(rawPage) || 1;
        let limit = Number(rawLimit) || 50;
        if (page < 1) page = 1;
        if (limit < 1) limit = 50;
        const offset = (page - 1) * limit;

        const data = await UserService.get(page, limit, offset, filters);

        res.json(data);
    });

    static create = ctrlWrapper(async (req, res) => {
        const created = await UserService.create(req.body);
        res.status(201).json(created);
    });

    static update = ctrlWrapper(async (req, res) => {
        const { id } = req.params;
        const updated = await UserService.update(id, req.body);

        res.json(updated);
    });

    static delete = ctrlWrapper(async (req, res) => {
        const { id } = req.params;
        const deleted = await UserService.delete(id);
        res.json(deleted);
    });
}

export default UserController;