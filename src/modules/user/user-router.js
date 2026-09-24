import { Router } from "express";

import { jwtHandler } from "../../middlewares/index.js";
import UserController from "./user-controller.js";

const UserRouter = Router();

UserRouter.post("/login", UserController.login);
UserRouter.post("/refresh", UserController.refresh);
UserRouter.post("/logout", UserController.logout);
// UserRouter.post("/create", UserController.create);

UserRouter.get("/get", jwtHandler, UserController.get);
UserRouter.patch("/update/:id", jwtHandler, UserController.update);
UserRouter.delete("/delete/:id", jwtHandler, UserController.delete);

export default UserRouter;