import { Router } from "express";
import { UserRouter } from "../modules/user/index.js";
import { IdeaRouter } from "../modules/idea/index.js";

const router = Router();

router.use("/user", UserRouter);
router.use("/idea", IdeaRouter);

export default router;
