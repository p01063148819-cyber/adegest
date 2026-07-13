import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import salesRouter from "./sales";
import stockRouter from "./stock";
import reportsRouter from "./reports";
import { attachSession, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.use(attachSession);

router.use(healthRouter);
router.use(authRouter);

// All business routes require an authenticated session (either role).
// Fine-grained per-role restrictions can be layered in per-route later if needed.
router.use(requireRole("admin", "vendedor"));
router.use(categoriesRouter);
router.use(productsRouter);
router.use(salesRouter);
// Stock movements (entrada/ajuste) are an admin-only responsibility.
router.use(requireRole("admin"), stockRouter);
router.use(reportsRouter);

export default router;
