import { Hono } from "hono";
import zodRouter from "./zod";
import valibotRouter from "./valibot";
import typeboxRouter from "./typebox";
import arkTypeRouter from "./arktype";

const router = new Hono();

// Validators routes
router.route("/zod", zodRouter);
router.route("/valibot", valibotRouter);
// router.route("/typebox", typeboxRouter);
// router.route("/arktype", arkTypeRouter);

export default router;
