import type { PublicUser } from "@/shared/utils/user-public";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation
    interface User extends PublicUser {}
  }
}

export {};
