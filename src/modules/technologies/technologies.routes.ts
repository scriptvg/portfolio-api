import { Router } from "express";

import { requireAdminSecret } from "@/shared/middlewares/require-admin-secret";
import {
  createTechnology,
  deleteTechnology,
  getAllTechnologies,
  patchTechnology,
  replaceTechnology
} from "./technologies.controller";

const router = Router();

router.get("/", getAllTechnologies);

router.post("/", requireAdminSecret, createTechnology);
router.put("/:id", requireAdminSecret, replaceTechnology);
router.patch("/:id", requireAdminSecret, patchTechnology);
router.delete("/:id", requireAdminSecret, deleteTechnology);

export default router;
