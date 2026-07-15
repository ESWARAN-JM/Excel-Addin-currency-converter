import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  isAdmin: boolean;
  createdAt?: string;
}

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const UserModel: mongoose.Model<any> = mongoose.models.User || mongoose.model("User", UserSchema);

// Unified Database CRUD Methods
export async function findUserByEmail(email: string): Promise<IUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
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

export async function findUserById(id: string): Promise<IUser | null> {
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

export async function createUser(userData: {
  name: string;
  email: string;
  password?: string;
  isAdmin?: boolean;
}): Promise<IUser> {
  const normalizedEmail = userData.email.trim().toLowerCase();
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

export async function getAllUsers(): Promise<IUser[]> {
  const userDocs = await UserModel.find({}, "-password");
  return userDocs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    isAdmin: doc.isAdmin,
    createdAt: doc.createdAt,
  }));
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  const result = await UserModel.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

export async function updateUserAdminStatus(id: string, isAdmin: boolean): Promise<IUser | null> {
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

// Ensures default admin user exists in MongoDB if connected
export async function seedDefaultAdmin(): Promise<void> {
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
}
