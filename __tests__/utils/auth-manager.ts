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
