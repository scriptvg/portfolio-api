import { Router } from "express";
import { getStructure, getContents, askQuestion } from "./deepwiki.controller";

const router = Router({ mergeParams: true });

router.get("/:owner/:repo/structure", getStructure);
router.get("/:owner/:repo/contents", getContents);
router.post("/:owner/:repo/ask", askQuestion);

export default router;
