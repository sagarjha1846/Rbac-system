import { describe, expect, it } from "vitest";
import request from "supertest";
import { resetTestDb } from "./testUtils";
import { createApp } from "../src/app";

// Its own file/module instance so the shared in-memory rate-limit counter
// doesn't interfere with (or get polluted by) the login flows exercised in
// auth.test.ts - vitest gives each test file a fresh module registry.
const app = createApp();

describe("rate limiting", () => {
  it("blocks login after exceeding the configured attempt limit", async () => {
    await resetTestDb();

    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post("/auth/login").send({ email: "nobody@test.local", password: "wrong" });
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});
