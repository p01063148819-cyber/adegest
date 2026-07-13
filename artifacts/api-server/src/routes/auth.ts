import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { and, eq, isNull } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { setSessionCookie, clearSessionCookie } from "../lib/session";

const router: IRouter = Router();
const SALT_ROUNDS = 12;

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const senhaHash = await bcrypt.hash(parsed.data.senha, SALT_ROUNDS);

  // Only sets the password if it is still null — blocks overwriting an existing account.
  const [user] = await db
    .update(usersTable)
    .set({ senhaHash })
    .where(and(eq(usersTable.role, parsed.data.role), isNull(usersTable.senhaHash)))
    .returning();

  if (!user) {
    res.status(409).json({ error: "Account already exists for this role" });
    return;
  }

  res.status(201).json({ role: user.role });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.role, parsed.data.role));
  if (!user || !user.senhaHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.senha, user.senhaHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  setSessionCookie(res, { role: user.role });
  res.json({ role: user.role });
});

router.post("/auth/logout", (_req, res): void => {
  clearSessionCookie(res);
  res.sendStatus(204);
});

router.get("/auth/me", (req, res): void => {
  res.json({ role: req.user?.role ?? null });
});

export default router;
