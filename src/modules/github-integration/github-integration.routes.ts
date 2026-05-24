import { Router } from "express";

import { requireJwt } from "@/shared/middlewares/require-jwt";

import {
  connect,
  disconnect,
  getPublicRepo,
  getPublicReposBatch,
  getRepoDetails,
  getStatus,
  importRepo,
  linkRepoToProject,
  listRepos,
  refresh
} from "./github-integration.controller";

const router = Router();

// Public (no auth) — repo stats with server-side cache.
router.get("/public/repos", getPublicReposBatch);
router.get("/public/repos/:owner/:repo", getPublicRepo);

router.use(requireJwt);

router.get("/status", getStatus);
router.post("/connect", connect);
router.delete("/disconnect", disconnect);
router.post("/refresh", refresh);
router.get("/repos", listRepos);
router.get("/repos/:owner/:repo", getRepoDetails);
router.post("/import-repo", importRepo);
router.post("/link-repo", linkRepoToProject);

export default router;
