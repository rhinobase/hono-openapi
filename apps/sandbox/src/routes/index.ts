import { Hono } from "hono";
import zodRouter from "./zod";
import valibotRouter from "./valibot";

const router = new Hono();

// Validators routes
router.route("/zod", zodRouter);
router.route("/valibot", valibotRouter);

export default router;
