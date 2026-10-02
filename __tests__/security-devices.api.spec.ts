import request from "supertest";
import { app } from "../src/setting.js";
import { securityDevicesTestManager } from "./utils/security-devices-manager.js";
import { authTestManager } from "./utils/auth-manager.js";
import { usersTestManager } from "./utils/users-manager.js";

//The tests have to be isolated and independent.

// Only the refreshTokenMiddleware gate is implemented so far — the handlers
// still answer 501, so happy paths are left as todos until they're built.
describe("Security devices", () => {
  beforeEach(async () => {
    //clear all data before running tests
    await request(app).delete("/testing/all-data");
  });

  const loginAndGetTokens = async () => {
    const data = { login: "device_usr", password: "password1", email: "device@mail.com" };
    await usersTestManager.createUser(data, {
      expectedStatusCode: 201,
      isAuthorized: true,
    });
    const loginResponse = await authTestManager.login(
      { loginOrEmail: data.login, password: data.password },
      { expectedStatusCode: 200 },
    );
    return {
      accessToken: loginResponse.body.accessToken as string,
      refreshToken: authTestManager.getRefreshToken(loginResponse) as string,
    };
  };

  // Every route sits behind refreshTokenMiddleware, so they share the same 401 cases
  const routes = [
    {
      name: "GET /security/devices",
      call: (opts: { expectedStatusCode: number; refreshToken?: string }) =>
        securityDevicesTestManager.getDevices(opts),
    },
    {
      name: "DELETE /security/devices",
      call: (opts: { expectedStatusCode: number; refreshToken?: string }) =>
        securityDevicesTestManager.deleteDevices(opts),
    },
    {
      name: "DELETE /security/devices/:deviceId",
      call: (opts: { expectedStatusCode: number; refreshToken?: string }) =>
        securityDevicesTestManager.deleteDeviceById("some-device-id", opts),
    },
  ];

  describe.each(routes)("$name", ({ call }) => {
    //401 no cookie
    it("should return 401 if no refreshToken cookie is sent", async () => {
      await call({ expectedStatusCode: 401 });
    });

    //401 malformed token
    it("should return 401 if the refresh token is not a valid JWT", async () => {
      await call({ expectedStatusCode: 401, refreshToken: "invalid.token.value" });
    });

    //401 access token sent as refresh token
    it("should return 401 if an access token is sent as the refresh token", async () => {
      const { accessToken } = await loginAndGetTokens();

      await call({ expectedStatusCode: 401, refreshToken: accessToken });
    });

    //401 refresh token revoked by logout
    it("should return 401 if the refresh token was revoked by logout", async () => {
      const { refreshToken } = await loginAndGetTokens();
      await authTestManager.logout({ expectedStatusCode: 204, refreshToken });

      await call({ expectedStatusCode: 401, refreshToken });
    });
  });

  it.todo("GET /security/devices 200 lists the user's active sessions");
  it.todo("DELETE /security/devices 204 terminates all other sessions");
  it.todo("DELETE /security/devices/:deviceId 204 terminates the given session");
  it.todo("DELETE /security/devices/:deviceId 403 session belongs to another user");
  it.todo("DELETE /security/devices/:deviceId 404 session does not exist");
});
