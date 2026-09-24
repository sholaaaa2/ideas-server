import { AppError, ctrlWrapper } from "../../helpers/index.js";
import IdeaService from "./idea-service.js";

class IdeaController {
    static get = ctrlWrapper(async (req, res) => {
        const { page: rawPage, limit: rawLimit, ...filters } = req.query;

        let page = Number(rawPage) || 1;
        let limit = Number(rawLimit) || 50;
        if (page < 1) page = 1;
        if (limit < 1) limit = 50;
        const offset = (page - 1) * limit;

        const data = await IdeaService.get(page, limit, offset, filters);

        res.json(data);
    });

    static create = ctrlWrapper(async (req, res) => {
        const objData = req.body;
        if (!objData.title?.trim()) throw new AppError("Title is required", 400);

        const created = await IdeaService.create(objData);
        res.status(201).json(created);
    });

    static update = ctrlWrapper(async (req, res) => {
        const { id } = req.params;
        const updated = await IdeaService.update(id, req.body);
        res.json(updated);
    });

    static delete = ctrlWrapper(async (req, res) => {
        const { id } = req.params;
        const deleted = await IdeaService.delete(id);
        res.json(deleted);
    });
}

export default IdeaController;