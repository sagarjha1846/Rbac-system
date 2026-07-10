import { Router } from "express";
import { findUserByEmail } from "../services/rbac";
import { verifyPassword } from "../auth/password";
import { signToken } from "../auth/jwt";
import { resolvePermissionTree } from "../services/permissionTree";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = await findUserByEmail(email);
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ userId: user.id, email: user.email });
  const permissionTree = await resolvePermissionTree(user.id);

  res.json({
    token,
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    permissionTree,
  });
});
