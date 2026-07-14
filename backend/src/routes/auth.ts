import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  findUserByEmail,
  createUser,
  getAllUsers,
  deleteUser,
  updateUserAdminStatus,
  findUserById,
} from "../models/User";
import { authenticateToken, AuthenticatedRequest, requireAdmin } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "currency_addin_jwt_secret_token_key_2026_xyz";

// Generate JWT Helper
function generateToken(userId: string, email: string): string {
  return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: "7d" });
}

// POST /api/auth/register
router.post("/register", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required." });
    return;
  }

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: "Email is already registered." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser({
      name,
      email,
      password: hashedPassword,
      isAdmin: false,
    });

    const token = generateToken(user.id, user.email);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Server registration failed." });
  }
});

// POST /api/auth/login
router.post("/login", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  try {
    const user = await findUserByEmail(email);
    if (!user || !user.password) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = generateToken(user.id, user.email);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server login failed." });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(404).json({ error: "User profile not found." });
    return;
  }
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    isAdmin: req.user.isAdmin,
  });
});

// GET /api/auth/users (Admin only)
router.get(
  "/users",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const users = await getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Fetch users error:", error);
      res.status(500).json({ error: "Failed to fetch user list." });
    }
  }
);

// PUT /api/auth/users/:id/admin (Admin only)
router.put(
  "/users/:id/admin",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { isAdmin } = req.body;

    if (req.user?.id === id) {
      res.status(400).json({ error: "You cannot change your own admin privileges." });
      return;
    }

    try {
      const updatedUser = await updateUserAdminStatus(id, !!isAdmin);
      if (!updatedUser) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
      });
    } catch (error) {
      console.error("Promote user error:", error);
      res.status(500).json({ error: "Failed to update user admin privileges." });
    }
  }
);

// DELETE /api/auth/users/:id (Admin only)
router.delete(
  "/users/:id",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    if (req.user?.id === id) {
      res.status(400).json({ error: "You cannot delete your own account." });
      return;
    }

    try {
      const deleted = await deleteUser(id);
      if (!deleted) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      res.json({ message: "User deleted successfully." });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user." });
    }
  }
);

export default router;
