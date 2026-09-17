import type { Role } from "../generated/prisma/enums.js";

declare global {
  namespace Express {
    interface Request {
      pengguna?: {
        id: number;
        role: Role;
      };
    }
  }
}