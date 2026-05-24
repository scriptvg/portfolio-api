import { Request, Response } from "express";
import { ApiResponse } from "@/shared/utils/api-response";
import { ApiError } from "@/shared/errors/api-error";
import { DeepwikiService } from "./deepwiki.service";

const repoFrom = (req: Request) => `${req.params.owner}/${req.params.repo}`;

export const getStructure = async (req: Request, res: Response) => {
  const content = await DeepwikiService.readStructure(repoFrom(req));
  return ApiResponse.Success(res, "DeepWiki structure", { content });
};

export const getContents = async (req: Request, res: Response) => {
  const content = await DeepwikiService.readContents(repoFrom(req));
  return ApiResponse.Success(res, "DeepWiki contents", { content });
};

export const askQuestion = async (req: Request, res: Response) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) {
    throw ApiError.badRequest("Missing 'question' in body");
  }
  const content = await DeepwikiService.ask(repoFrom(req), question);
  return ApiResponse.Success(res, "DeepWiki answer", { content });
};
