import { Hono } from "hono";
import arkTypeRouter from "./arktype";
import effectRouter from "./effect";
import typeboxRouter from "./typebox";
import valibotRouter from "./valibot";
import zodRouter from "./zod";

const router = new Hono();

// Validators routes
router.route("/zod", zodRouter);
router.route("/valibot", valibotRouter);
router.route("/typebox", typeboxRouter);
router.route("/arktype", arkTypeRouter);
router.route("/effect", effectRouter);

export default router;
