import request from "supertest";
import { app } from "../../src/setting.js";

export const authTestManager: any = {
  async login(
    data: { loginOrEmail?: string; password?: string },
    { expectedStatusCode }: { expectedStatusCode: number },
  ) {
    const response = await request(app).post("/auth/login").send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    if (response.statusCode === 200) {
      expect(response.body.accessToken).toBeDefined();
      expect(authTestManager.getRefreshToken(response)).toBeDefined();
    }

    return response;
  },
  async me({
    expectedStatusCode,
    authHeader,
  }: {
    expectedStatusCode: number;
    authHeader?: string;
  }) {
    const requestObject = request(app).get("/auth/me");

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    }

    const response = await requestObject;

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  // Returns the raw `refreshToken=...` Set-Cookie header, or undefined if none was set
  getRefreshTokenCookie(response: { headers: Record<string, unknown> }) {
    const cookies = (response.headers["set-cookie"] ?? []) as string[];
    return cookies.find((c) => c.startsWith("refreshToken="));
  },
  // Extracts just the token value from the refreshToken Set-Cookie header
  getRefreshToken(response: { headers: Record<string, unknown> }) {
    const cookie = authTestManager.getRefreshTokenCookie(response);
    return cookie?.split(";")[0]!.slice("refreshToken=".length) || undefined;
  },
  async refreshToken({
    expectedStatusCode,
    refreshToken,
  }: {
    expectedStatusCode: number;
    refreshToken?: string;
  }) {
    const requestObject = request(app).post("/auth/refresh-token");

    if (refreshToken !== undefined) {
      requestObject.set("Cookie", `refreshToken=${refreshToken}`);
    }

    const response = await requestObject;

    expect(response.statusCode).toBe(expectedStatusCode);

    if (response.statusCode === 200) {
      expect(response.body.accessToken).toBeDefined();
      expect(authTestManager.getRefreshToken(response)).toBeDefined();
    }

    return response;
  },
  async logout({
    expectedStatusCode,
    refreshToken,
  }: {
    expectedStatusCode: number;
    refreshToken?: string;
  }) {
    const requestObject = request(app).post("/auth/logout");

    if (refreshToken !== undefined) {
      requestObject.set("Cookie", `refreshToken=${refreshToken}`);
    }

    const response = await requestObject;

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async registration(
    data: { login?: unknown; password?: unknown; email?: unknown },
    { expectedStatusCode }: { expectedStatusCode: number },
  ) {
    const response = await request(app).post("/auth/registration").send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async confirmRegistration(
    data: { code?: unknown },
    { expectedStatusCode }: { expectedStatusCode: number },
  ) {
    const response = await request(app)
      .post("/auth/registration-confirmation")
      .send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async resendRegistrationEmail(
    data: { email?: unknown },
    { expectedStatusCode }: { expectedStatusCode: number },
  ) {
    const response = await request(app)
      .post("/auth/registration-email-resending")
      .send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
};
