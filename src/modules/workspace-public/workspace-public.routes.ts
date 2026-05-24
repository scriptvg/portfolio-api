import { Router } from "express";

import { getPublicWorkspace } from "./workspace-public.controller";

const router = Router();

router.get("/:slug", getPublicWorkspace);

export default router;
