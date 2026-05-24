import {
  type NextFunction,
  type Request,
  type Response,
  Router
} from "express";

import {
  deleteWorkspaceAvatar,
  getSettings,
  patchNotifications,
  patchPanel,
  patchWorkspace,
  uploadWorkspaceAvatar
} from "@/modules/settings/settings.controller";
import { requireJwt } from "@/shared/middlewares/require-jwt";
import { avatarUploader, normalizeMulterError } from "@/shared/utils/uploads";

const router = Router();

router.use(requireJwt);

router.get("/", getSettings);
router.patch("/panel", patchPanel);
router.patch("/notifications", patchNotifications);
router.patch("/workspace", patchWorkspace);

router.post(
  "/workspace/avatar",
  (req: Request, res: Response, next: NextFunction) => {
    avatarUploader.single("avatar")(req, res, err => {
      if (err) {
        return next(normalizeMulterError(err));
      }
      next();
    });
  },
  uploadWorkspaceAvatar
);
router.delete("/workspace/avatar", deleteWorkspaceAvatar);

export default router;
