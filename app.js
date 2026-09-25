import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./src/config/env.js";
import { errorHandler, notFoundHandler } from "./src/middlewares/index.js";
import apiRoutes from "./src/routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class App {
    constructor() {
        this.app = express();
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    initializeMiddleware() {
        this.app.use(
            helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        scriptSrc: ["'self'", "https://code.jquery.com"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        imgSrc: ["'self'", "data:", "https:"],
                        frameSrc: [
                            "'self'",
                            "https://www.youtube.com",
                            "https://www.youtube-nocookie.com",
                            "https://www.instagram.com",
                            "https://www.tiktok.com",
                        ],
                        connectSrc: ["'self'",],
                    },
                },
            })
        );
        this.app.use(
            cors({
                origin: env.corsOrigins,
                credentials: true,
                methods: [
                    "GET",
                    "POST",
                    "PATCH",
                    "DELETE",
                    "OPTIONS",
                ],
                allowedHeaders: [
                    "Origin",
                    "X-Requested-With",
                    "Content-Type",
                    "Accept",
                    "Authorization",
                ],
            })
        );
        this.app.set("trust proxy", 1);
        this.app.use(cookieParser());
        this.app.use(express.json({ limit: "10mb" }));
        this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
        this.app.use(express.static(path.join(__dirname, "public")));
    }

    initializeRoutes() {
        this.app.use("/api", apiRoutes);
        this.app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")) });
    }

    initializeErrorHandling() {
        this.app.use(notFoundHandler);
        this.app.use(errorHandler);
    }
    async start() {
        this.app.listen(env.port, '0.0.0.0', () => {
            console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
        });
    }
}
export default App;