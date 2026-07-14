import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { findUserById, IUser } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "currency_addin_jwt_secret_token_key_2026_xyz";

// Extend Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access token is missing." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const user = await findUserById(decoded.id);

    if (!user) {
      res.status(403).json({ error: "User no longer exists." });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired access token." });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || !req.user.isAdmin) {
    res.status(403).json({ error: "Access denied. Admin role required." });
    return;
  }
  next();
}
