import mongoose, { Schema } from "mongoose";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { isMockDb } from "../db";

// Unified User Type
export interface IUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  isAdmin: boolean;
  createdAt: Date | string;
}

// Mongoose Schema
const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const UserModel: mongoose.Model<any> = mongoose.models.User || mongoose.model("User", UserSchema);

// JSON Mock Database Helpers
const MOCK_DB_PATH = process.env.VERCEL
  ? "/tmp/mock_db.json"
  : path.join(__dirname, "../../../mock_db.json");

function readMockDb(): IUser[] {
  try {
    if (!fs.existsSync(MOCK_DB_PATH)) {
      // Create initial database with a default admin
      const defaultAdminPassword = bcrypt.hashSync("Admin@123", 10);
      const defaultUsers: IUser[] = [
        {
          id: "admin-default-id",
          name: "admin",
          email: "admin@gmail.com",
          password: defaultAdminPassword,
          isAdmin: true,
          createdAt: new Date().toISOString(),
        },
      ];
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(defaultUsers, null, 2));
      return defaultUsers;
    }
    const content = fs.readFileSync(MOCK_DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading mock DB file:", error);
    return [];
  }
}

function writeMockDb(users: IUser[]): void {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error("Error writing mock DB file:", error);
  }
}

// Unified Database CRUD Methods
export async function findUserByEmail(email: string): Promise<IUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (isMockDb) {
    const users = readMockDb();
    const found = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    return found ? { ...found } : null;
  } else {
    const userDoc = await UserModel.findOne({ email: normalizedEmail });
    if (!userDoc) return null;
    return {
      id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      password: userDoc.password,
      isAdmin: userDoc.isAdmin,
      createdAt: userDoc.createdAt,
    };
  }
}

export async function findUserById(id: string): Promise<IUser | null> {
  if (isMockDb) {
    const users = readMockDb();
    const found = users.find((u) => u.id === id);
    return found ? { ...found } : null;
  } else {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const userDoc = await UserModel.findById(id);
    if (!userDoc) return null;
    return {
      id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      password: userDoc.password,
      isAdmin: userDoc.isAdmin,
      createdAt: userDoc.createdAt,
    };
  }
}

export async function createUser(userData: {
  name: string;
  email: string;
  password?: string;
  isAdmin?: boolean;
}): Promise<IUser> {
  const normalizedEmail = userData.email.trim().toLowerCase();
  if (isMockDb) {
    const users = readMockDb();
    const newUser: IUser = {
      id: "mock-" + Math.random().toString(36).substring(2, 11),
      name: userData.name,
      email: normalizedEmail,
      password: userData.password,
      isAdmin: userData.isAdmin || false,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeMockDb(users);
    return { ...newUser };
  } else {
    const userDoc = new UserModel({
      name: userData.name,
      email: normalizedEmail,
      password: userData.password,
      isAdmin: userData.isAdmin || false,
    });
    await userDoc.save();
    return {
      id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      password: userDoc.password,
      isAdmin: userDoc.isAdmin,
      createdAt: userDoc.createdAt,
    };
  }
}

export async function getAllUsers(): Promise<IUser[]> {
  if (isMockDb) {
    const users = readMockDb();
    // Return users without passwords for security
    return users.map(({ password, ...u }) => u as IUser);
  } else {
    const userDocs = await UserModel.find({}, "-password");
    return userDocs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      email: doc.email,
      isAdmin: doc.isAdmin,
      createdAt: doc.createdAt,
    }));
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  if (isMockDb) {
    const users = readMockDb();
    const initialLength = users.length;
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length < initialLength) {
      writeMockDb(filtered);
      return true;
    }
    return false;
  } else {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await UserModel.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}

export async function updateUserAdminStatus(id: string, isAdmin: boolean): Promise<IUser | null> {
  if (isMockDb) {
    const users = readMockDb();
    const userIndex = users.findIndex((u) => u.id === id);
    if (userIndex === -1) return null;
    users[userIndex].isAdmin = isAdmin;
    writeMockDb(users);
    return { ...users[userIndex] };
  } else {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const userDoc = await UserModel.findByIdAndUpdate(id, { isAdmin }, { new: true });
    if (!userDoc) return null;
    return {
      id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      isAdmin: userDoc.isAdmin,
      createdAt: userDoc.createdAt,
    };
  }
}

// Ensures default admin user exists in MongoDB if connected
export async function seedDefaultAdmin(): Promise<void> {
  if (!isMockDb) {
    try {
      const adminExists = await UserModel.findOne({ email: "admin@gmail.com" });
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash("Admin@123", 10);
        const adminUser = new UserModel({
          name: "admin",
          email: "admin@gmail.com",
          password: hashedPassword,
          isAdmin: true,
        });
        await adminUser.save();
        console.log("✅ Seeded default admin user in MongoDB.");
      }
    } catch (err) {
      console.error("Failed to seed default admin in MongoDB:", err);
    }
  } else {
    // Just trigger readMockDb() which creates the file and default admin if missing
    readMockDb();
  }
}
