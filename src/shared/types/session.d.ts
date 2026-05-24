import "express-session";

declare module "express-session" {
  interface SessionData {
    /** User id (JWT session) starting an OAuth link flow */
    linkAccountUserId?: string;
  }
}

export {};
