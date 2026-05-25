import { Router } from "express";
import HealthRouter from "../modules/health/health.routes";
import OAuthRouter from "../modules/oauth/oauth.routes";
import TechnologiesRouter from "../modules/technologies/technologies.routes";
import ExperiencesRouter from "../modules/experiences/experiences.routes";
import EducationRouter from "../modules/education/education.routes";
import ProjectsRouter from "../modules/projects/projects.routes";
import SettingsRouter from "../modules/settings/settings.routes";
import WorkspacePublicRouter from "../modules/workspace-public/workspace-public.routes";
import WebhooksRouter from "../modules/webhooks/webhooks.routes";
import GithubIntegrationRouter from "../modules/github-integration/github-integration.routes";
import DeepwikiRouter from "../modules/deepwiki/deepwiki.routes";
import AiRouter from "../modules/ai/ai.routes";

const router = Router();

router.use("/health", HealthRouter);
// authLimiter se aplica por ruta en oauth.routes.ts, no a nivel de router,
// para no estrangular los endpoints de lectura/bootstrap (GET /auth/me, callbacks OAuth).
router.use("/auth", OAuthRouter);
router.use("/settings", SettingsRouter);
router.use("/technologies", TechnologiesRouter);
router.use("/experiences", ExperiencesRouter);
router.use("/education", EducationRouter);
router.use("/projects", ProjectsRouter);
router.use("/workspace", WorkspacePublicRouter);
router.use("/webhooks", WebhooksRouter);
router.use("/integrations/github", GithubIntegrationRouter);
router.use("/deepwiki", DeepwikiRouter);
router.use("/ai", AiRouter);

export default router;
