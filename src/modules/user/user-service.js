import bcrypt from "bcryptjs";
import { AppError } from "../../helpers/index.js";
import TokenService from "../token/token-service.js";
import UserModel from "./user-model.js";

class UserService {
    static async login({ name, password }) {
        const existingUser = await UserModel.findOne({ name }).select('+password');
        if (!existingUser) throw new AppError('User does not exist', 401);

        const passwordMatch = await bcrypt.compare(password, existingUser.password);
        if (!passwordMatch) throw new AppError('Invalid credentials', 401);

        const tokens = TokenService.signTokens({ _id: existingUser._id, name });
        await TokenService.upsertToken(existingUser._id, tokens.refreshToken);
        return {
            id: existingUser._id,
            name: existingUser.name,
            tokens,
        };
    }

    static async refresh(oldToken) {
        if (!oldToken) throw new AppError("Not authorized", 401);

        const { _id, name } = TokenService.verifyToken(oldToken, () => { throw new AppError("Not authorized", 401); });
        const existingUser = await UserModel.findById(_id);
        if (!existingUser) throw new AppError("User not found", 401);

        const tokens = TokenService.signTokens({ _id: existingUser._id.toString(), name: existingUser.name, });
        await TokenService.upsertToken(existingUser._id, tokens.refreshToken);

        return {
            user: { id: existingUser._id, name: existingUser.name, },
            tokens,
        };
    }

    static async logout(token) {
        if (!token) throw new AppError('Not authorized', 401);

        await TokenService.deleteToken(token);
    }

    static async get(page, limit, offset, rawFilters) {
        const { from, to, search, user, type, ...filters } = rawFilters;
        const query = {};
        const [objects, total] = await Promise.all([
            UserModel.find(query)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .exec(),
            UserModel.countDocuments(query),
        ]);
        return {
            objects,
            page,
            limit,
            total,
        };
    }

    static async create(obj) {
        const existing = await UserModel.findOne({ name: obj.name });
        if (existing) throw new Error(`This user already exists`);
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(obj.password, saltRounds);
        return await UserModel.create({ ...obj, password: hashedPassword });
    }

    static async update(id, obj) {
        const existing = await UserModel.findById(id);
        if (!existing) throw new Error("User not found");
        const duplicate = await UserModel.findOne({ name: obj.name, _id: { $ne: id } });
        if (duplicate) throw new Error("This user already exists");
        return await UserModel.findByIdAndUpdate(
            id,
            { $set: { ...obj } },
            { new: true, runValidators: true }
        );
    }
    
    static async delete(id) {
        const existing = await UserModel.findById(id);
        if (!existing) throw new Error("User not found");
        await existing.deleteOne();
        return existing;
    }
}
export default UserService;