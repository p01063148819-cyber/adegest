import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import suppliersRouter from "./suppliers";
import productsRouter from "./products";
import salesRouter from "./sales";
import stockRouter from "./stock";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(suppliersRouter);
router.use(productsRouter);
router.use(salesRouter);
router.use(stockRouter);
router.use(reportsRouter);

export default router;
