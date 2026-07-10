import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetTestDb } from "./testUtils";
import * as rbac from "../src/services/rbac";
import { createApp } from "../src/app";

const app = createApp();

describe("auth + permission guard", () => {
  beforeAll(async () => {
    await resetTestDb();

    await rbac.createApplication({ name: "System", key: "system" });
    const adminModule = await rbac.createModule({
      applicationKey: "system",
      name: "RBAC Admin",
      key: "rbac-admin",
      moduleType: "MENU",
    });
    const adminPermission = await rbac.createPermission({
      applicationKey: "system",
      moduleKey: "rbac-admin",
      canRead: true,
      canAdd: true,
      canModify: true,
      canDelete: true,
    });
    await rbac.createPermissionGroup({ name: "System Admin", key: "system-admin" });
    await rbac.addPermissionToGroup({ permissionId: adminPermission.id, permissionGroupKey: "system-admin" });

    const admin = await rbac.createUser({
      firstName: "Test",
      lastName: "Admin",
      email: "admin@test.local",
      password: "Admin@1234",
      role: "Originator",
    });
    await rbac.assignUserToApplication({ userId: admin.id, applicationKey: "system" });
    await rbac.assignUserToGroup({ userId: admin.id, permissionGroupKey: "system-admin" });

    await rbac.createUser({
      firstName: "Plain",
      lastName: "User",
      email: "plain@test.local",
      password: "Plain@1234",
      role: "Vendor",
    });

    void adminModule;
  });

  it("rejects login with wrong password", async () => {
    const res = await request(app).post("/auth/login").send({ email: "admin@test.local", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("rejects login with a malformed body", async () => {
    const res = await request(app).post("/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and returns a usable token", async () => {
    const res = await request(app).post("/auth/login").send({ email: "admin@test.local", password: "Admin@1234" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.permissionTree[0].modules[0].moduleKey).toBe("rbac-admin");
  });

  it("401s a protected route with no token", async () => {
    const res = await request(app).get("/admin/users");
    expect(res.status).toBe(401);
  });

  it("403s a user without rbac-admin permission", async () => {
    const login = await request(app).post("/auth/login").send({ email: "plain@test.local", password: "Plain@1234" });
    const res = await request(app).get("/admin/users").set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });

  it("200s for an admin user and lists users", async () => {
    const login = await request(app).post("/auth/login").send({ email: "admin@test.local", password: "Admin@1234" });
    const res = await request(app).get("/admin/users").set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((u: { email: string }) => u.email === "admin@test.local")).toBe(true);
  });

  it("validates the body on create-user and rejects a short password", async () => {
    const login = await request(app).post("/auth/login").send({ email: "admin@test.local", password: "Admin@1234" });
    const res = await request(app)
      .post("/admin/users")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ firstName: "A", lastName: "B", email: "short@test.local", password: "short", role: "Vendor" });
    expect(res.status).toBe(400);
  });

  it("404s an unknown route as JSON, not Express's default HTML page", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});
