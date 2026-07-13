import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { UserRole } from "@workspace/db";
import { readSessionCookie } from "../lib/session";

declare global {
  namespace Express {
    interface Request {
      user?: { role: UserRole };
    }
  }
}

export function attachSession(req: Request, _res: Response, next: NextFunction): void {
  const session = readSessionCookie(req.cookies);
  if (session) {
    req.user = { role: session.role };
  }
  next();
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
