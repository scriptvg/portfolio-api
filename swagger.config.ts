import swaggerAutoGen from "swagger-autogen";

const doc = {
  info: {
    title: "portfolio-api",
    description:
      "Backend Express 5 + Drizzle ORM + MySQL del ecosistema portfolio. Consumido por portfolio-web (público) y portfolio-saas (dashboard).",
    version: "1.0.0"
  },
  host: "localhost:9000",
  basePath: "/api/v1",
  schemes: ["http"],
  securityDefinitions: {
    bearerAuth: {
      type: "apiKey",
      name: "Authorization",
      in: "header",
      description:
        "JWT del usuario o API_ADMIN_SECRET. Formato: 'Bearer <token>'."
    }
  }
};

const outputFile = "./src/docs/swagger.json";
const endpointsFiles = ["./src/routes/*.ts"];

(async () => {
  try {
    const result = await swaggerAutoGen()(outputFile, endpointsFiles, doc);
    if (!result?.success) {
      console.error("[swagger] generation failed", result);
      process.exit(1);
    }
    process.stdout.write(`[swagger] wrote ${outputFile}\n`);
    process.exit(0);
  } catch (err) {
    console.error("[swagger] error", err);
    process.exit(1);
  }
})();
