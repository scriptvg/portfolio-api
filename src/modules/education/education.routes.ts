import { Router } from "express";

import { requireAdminSecret } from "@/shared/middlewares/require-admin-secret";
import {
  createEducation,
  deleteEducation,
  getAllEducation,
  patchEducation,
  replaceEducation
} from "./education.controller";

const router = Router();

router.get("/", getAllEducation);

router.post("/", requireAdminSecret, createEducation);
router.put("/:id", requireAdminSecret, replaceEducation);
router.patch("/:id", requireAdminSecret, patchEducation);
router.delete("/:id", requireAdminSecret, deleteEducation);

export default router;
