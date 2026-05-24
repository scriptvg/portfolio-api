import { Request, Response } from "express";
import { sql } from "drizzle-orm";
import db from "@/db";
import { ApiResponse } from "@/shared/utils/api-response";
import { STATUS_CODES } from "@/shared/constants/status-codes";

/**
 * Basic health check endpoint
 * GET /api/health
 */
export const healthCheck = async (_req: Request, res: Response) => {
  const start = Date.now();

  try {
    await db.execute(sql`SELECT 1`);
    const latency = Date.now() - start;

    return ApiResponse.Success(res, "Service is healthy", {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database: {
          status: "healthy",
          latency_ms: latency
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return new ApiResponse({
      success: false,
      message: "Service unhealthy",
      statusCode: STATUS_CODES.SERVICE_UNAVAILABLE,
      data: {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        dependencies: {
          database: {
            status: "unhealthy",
            error: message
          }
        }
      }
    }).send(res);
  }
};

/**
 * Detailed health check with system information
 * GET /api/health/detailed
 */
export const detailedHealthCheck = async (_req: Request, res: Response) => {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    memory: {
      used:
        Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total:
        Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      unit: "MB"
    },
    cpu: {
      usage: process.cpuUsage()
    }
  };

  return ApiResponse.Success(res, "Service is healthy", healthData);
};
