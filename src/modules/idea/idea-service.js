import IdeaModel from "./idea-model.js";
import { AppError, normalizeVideoUrl } from "../../helpers/index.js";

function escapeRegex(str = "") {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class IdeaService {
    static async get(page, limit, offset, rawFilters) {
        const {
            from,
            to,
            search,
            location,
            difficulty,
            ...filters
        } = rawFilters;

        const query = {};

        if (search) {
            query.title = { $regex: escapeRegex(search), $options: "i", };
        }

        const scriptFilter = {};

        if (location) {
            scriptFilter.location = { $regex: escapeRegex(location), $options: "i" };
        }

        if (difficulty && ["low", "mid", "high"].includes(difficulty)) {
            scriptFilter.difficulty = difficulty;
        }

        if (Object.keys(scriptFilter).length) {
            query.scripts = { $elemMatch: scriptFilter };
        }

        if (from || to) {
            query.createdAt = {};
            if (from) {
                const startOfDay = new Date(from);
                startOfDay.setUTCHours(0, 0, 0, 0);
                query.createdAt.$gte = startOfDay;
            }
            if (to) {
                const endOfDay = new Date(to);
                endOfDay.setUTCHours(23, 59, 59, 999);
                query.createdAt.$lte = endOfDay;
            }
        }
        for (const [key, raw] of Object.entries(filters)) {
            if (raw == null || raw === "") { continue; }
            query[key] = { $regex: escapeRegex(String(raw)), $options: "i" };
        }
        const [objects, total] = await Promise.all([
            IdeaModel.find(query)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .exec(),
            IdeaModel.countDocuments(query),
        ]);

        return {
            objects,
            page,
            limit,
            total,
        };
    }

    static async create(obj) {
        const data = { ...obj };

        if (Object.prototype.hasOwnProperty.call(data, "url")) {
            const originalUrl = String(data.url || "").trim();
            data.url_origin = originalUrl;
            data.url = await normalizeVideoUrl(originalUrl);
        }

        return IdeaModel.create(data);
    }

    static async update(id, obj) {
        const existing = await IdeaModel.findById(id);
        if (!existing) throw new AppError("Idea not found", 404);

        const data = { ...obj };

        if (Object.prototype.hasOwnProperty.call(data, "url_origin")) {
            const originalUrl = String(data.url_origin || "").trim();
            data.url_origin = originalUrl;
            data.url = await normalizeVideoUrl(originalUrl);
        } else if (Object.prototype.hasOwnProperty.call(data, "url")) {
            const originalUrl = String(data.url || "").trim();
            data.url_origin = originalUrl;
            data.url = await normalizeVideoUrl(originalUrl);
        }

        return IdeaModel.findByIdAndUpdate(id,
            {
                $set: data,
            },
            { new: true, runValidators: true }
        );
    }

    static async delete(id) {
        const existing = await IdeaModel.findById(id);
        if (!existing) throw new AppError("Idea not found",404);

        await existing.deleteOne();
        return existing;
    }
}

export default IdeaService;