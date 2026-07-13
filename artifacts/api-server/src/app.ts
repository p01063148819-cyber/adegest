import path from "node:path";
import { existsSync } from "node:fs";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// Populated in the esbuild banner (globalThis.__dirname) when running the
// bundled dist/index.mjs; falls back to Node's native __dirname in dev (tsx).
const staticDir = path.join(__dirname, "public");

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the built frontend (artifacts/adegest) and fall back to index.html
// for non-API routes so client-side (SPA) routing works on a hard refresh.
// dist/public is populated by build.mjs, which copies it from the frontend
// build — see the root `build` script for the required build order.
const indexHtmlPath = path.join(staticDir, "index.html");

if (existsSync(indexHtmlPath)) {
  app.use(express.static(staticDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(indexHtmlPath);
  });
} else {
  logger.warn(
    { staticDir },
    "Frontend build not found; skipping static file serving. Run `pnpm run build` from the repo root to build the frontend first.",
  );
}

export default app;
