import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "./server";
import fs from "fs";
import path from "path";
import { disconnectDB } from "./db";

const MOCK_DB_PATH = path.join(__dirname, "../../../mock_db.json");

describe("Express Backend API Tests", () => {
  let backupDbContent: string | null = null;

  beforeAll(() => {
    // Backup existing mock database if it exists
    if (fs.existsSync(MOCK_DB_PATH)) {
      backupDbContent = fs.readFileSync(MOCK_DB_PATH, "utf-8");
    }
  });

  afterAll(async () => {
    // Restore backup
    if (backupDbContent !== null) {
      fs.writeFileSync(MOCK_DB_PATH, backupDbContent);
    } else if (fs.existsSync(MOCK_DB_PATH)) {
      fs.unlinkSync(MOCK_DB_PATH);
    }
    await disconnectDB();
  });

  describe("GET /api/health", () => {
    it("should return status ok and database indicator", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("database");
    });
  });

  describe("GET /api/rates/latest", () => {
    it("should fetch latest rates structure successfully", async () => {
      const res = await request(app).get("/api/rates/latest");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("result");
      expect(res.body).toHaveProperty("rates");
    });
  });

  describe("Authentication Flow /api/auth", () => {
    const testUser = {
      name: "Test User",
      email: `test_${Math.random().toString(36).substring(7)}@example.com`,
      password: "TestPassword123"
    };

    let userToken = "";

    it("should register a new user and return a JWT token", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.user.isAdmin).toBe(false);
      userToken = res.body.token;
    });

    it("should fail to register user with same email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty("error");
    });

    it("should login user with correct credentials and return a token", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.name).toBe(testUser.name);
    });

    it("should fail login with wrong credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword"
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });

    it("should fetch current user profile via JWT", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(testUser.email.toLowerCase());
    });
  });
});
