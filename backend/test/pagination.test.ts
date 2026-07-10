import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetTestDb } from "./testUtils";
import * as rbac from "../src/services/rbac";
import { createApp } from "../src/app";

const app = createApp();

describe("pagination on list endpoints", () => {
  let token: string;

  beforeAll(async () => {
    await resetTestDb();

    await rbac.createApplication({ name: "System", key: "system" });
    await rbac.createModule({ applicationKey: "system", name: "RBAC Admin", key: "rbac-admin", moduleType: "MENU" });
    const adminPermission = await rbac.createPermission({
      applicationKey: "system",
      moduleKey: "rbac-admin",
      canRead: true,
      canAdd: true,
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

    // 5 more plain users (6 total including admin).
    for (let i = 0; i < 5; i++) {
      await rbac.createUser({
        firstName: `User${i}`,
        lastName: "Test",
        email: `user${i}@test.local`,
        password: "Temp@1234",
        role: "Vendor",
      });
    }

    const login = await request(app).post("/auth/login").send({ email: "admin@test.local", password: "Admin@1234" });
    token = login.body.token;
  });

  it("returns a page of the requested size with an accurate total count", async () => {
    const res = await request(app).get("/admin/users?page=1&pageSize=2").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(6);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
  });

  it("returns a different slice on page 2", async () => {
    const page1 = await request(app).get("/admin/users?page=1&pageSize=2").set("Authorization", `Bearer ${token}`);
    const page2 = await request(app).get("/admin/users?page=2&pageSize=2").set("Authorization", `Bearer ${token}`);
    const page1Emails = page1.body.data.map((u: { email: string }) => u.email);
    const page2Emails = page2.body.data.map((u: { email: string }) => u.email);
    expect(page1Emails).not.toEqual(page2Emails);
  });

  it("defaults to page 1 / pageSize 20 when no query params are given", async () => {
    const res = await request(app).get("/admin/users").set("Authorization", `Bearer ${token}`);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.data).toHaveLength(6); // fewer than pageSize, so all fit on page 1
  });

  it("caps pageSize at 100 even if a larger value is requested", async () => {
    const res = await request(app).get("/admin/users?pageSize=99999").set("Authorization", `Bearer ${token}`);
    expect(res.body.pageSize).toBe(100);
  });
});
