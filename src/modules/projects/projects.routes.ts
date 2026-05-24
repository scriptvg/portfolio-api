import {
  type NextFunction,
  type Request,
  type Response,
  Router
} from "express";

import { requireAdminSecret } from "@/shared/middlewares/require-admin-secret";
import {
  normalizeMulterError,
  projectImageUploader
} from "@/shared/utils/uploads";

import {
  createProject,
  deleteProject,
  getAllProjects,
  getProjectBySlug,
  getProjectWikiBySlug,
  patchProject,
  replaceProject,
  uploadProjectImage
} from "./projects.controller";

const router = Router();

router.get("/", getAllProjects);
router.get("/by-slug/:slug", getProjectBySlug);
router.get("/by-slug/:slug/wiki", getProjectWikiBySlug);

router.post("/", requireAdminSecret, createProject);
router.post(
  "/images",
  requireAdminSecret,
  (req: Request, res: Response, next: NextFunction) => {
    projectImageUploader.single("image")(req, res, err => {
      if (err) {
        return next(normalizeMulterError(err));
      }
      next();
    });
  },
  uploadProjectImage
);
router.put("/:id", requireAdminSecret, replaceProject);
router.patch("/:id", requireAdminSecret, patchProject);
router.delete("/:id", requireAdminSecret, deleteProject);

export default router;
