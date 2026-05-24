import { Router } from "express";

import { requireAdminSecret } from "@/shared/middlewares/require-admin-secret";
import {
  createExperience,
  deleteExperience,
  getAllExperiences,
  patchExperience,
  replaceExperience
} from "./experiences.controller";

const router = Router();

router.get("/", getAllExperiences);

router.post("/", requireAdminSecret, createExperience);
router.put("/:id", requireAdminSecret, replaceExperience);
router.patch("/:id", requireAdminSecret, patchExperience);
router.delete("/:id", requireAdminSecret, deleteExperience);

export default router;
