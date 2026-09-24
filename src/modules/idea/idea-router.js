import { Router } from "express";
import { jwtHandler } from "../../middlewares/index.js";
import IdeaController from "./idea-controller.js";

const IdeaRouter = Router();

IdeaRouter.use(jwtHandler);

IdeaRouter.get("/get", IdeaController.get);
IdeaRouter.post("/create", IdeaController.create);
IdeaRouter.patch("/update/:id", IdeaController.update);
IdeaRouter.delete("/delete/:id", IdeaController.delete);

export default IdeaRouter;