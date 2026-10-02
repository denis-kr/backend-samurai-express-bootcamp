import request from "supertest";
import { app } from "../src/setting.js";
import { securityDevicesTestManager } from "./utils/security-devices-manager.js";
import { authTestManager } from "./utils/auth-manager.js";
import { usersTestManager } from "./utils/users-manager.js";

//The tests have to be isolated and independent.

describe("Security devices", () => {
  beforeEach(async () => {
    //clear all data before running tests
    await request(app).delete("/testing/all-data");
  });

  // Refresh tokens live 20s; only Date is faked so the Mongo driver's real
  // timers keep working while jwt sees a later clock.
  const advanceClockBySeconds = (seconds: number) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + seconds * 1000);
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultUser = {
    login: "device_usr",
    password: "password1",
    email: "device@mail.com",
  };

  const createTestUser = async (data = defaultUser) => {
    await usersTestManager.createUser(data, {
      expectedStatusCode: 201,
      isAuthorized: true,
    });
    return data;
  };

  const login = async (user = defaultUser, userAgent?: string) => {
    const loginResponse = await authTestManager.login(
      { loginOrEmail: user.login, password: user.password },
      { expectedStatusCode: 200, userAgent },
    );
    return {
      accessToken: loginResponse.body.accessToken as string,
      refreshToken: authTestManager.getRefreshToken(loginResponse) as string,
    };
  };

  const loginAndGetTokens = async () => {
    await createTestUser();
    return login();
  };

  const getDevices = async (refreshToken: string) => {
    const response = await securityDevicesTestManager.getDevices({
      expectedStatusCode: 200,
      refreshToken,
    });
    return response.body as {
      ip: string;
      title: string;
      lastActiveDate: string;
      deviceId: string;
    }[];
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

    //401 refresh token already rotated
    it("should return 401 if the refresh token was already used for a refresh", async () => {
      const { refreshToken } = await loginAndGetTokens();
      await authTestManager.refreshToken({ expectedStatusCode: 200, refreshToken });

      await call({ expectedStatusCode: 401, refreshToken });
    });

    //401 refresh token expired
    it("should return 401 if the refresh token has expired (after 20s)", async () => {
      const { refreshToken } = await loginAndGetTokens();

      advanceClockBySeconds(21);

      await call({ expectedStatusCode: 401, refreshToken });
    });
  });

  describe("GET /security/devices", () => {
    //GET /security/devices 200
    it("should return 200 with the current session's ip, title, lastActiveDate and deviceId", async () => {
      await createTestUser();
      const before = Date.now();
      const { refreshToken } = await login(defaultUser, "Chrome on Windows");
      const after = Date.now();

      const devices = await getDevices(refreshToken);

      expect(devices).toEqual([
        {
          ip: expect.any(String),
          title: "Chrome on Windows",
          lastActiveDate: expect.any(String),
          deviceId: expect.any(String),
        },
      ]);
      const [device] = devices;
      expect(device!.ip).not.toBe("");
      expect(device!.deviceId).not.toBe("");
      // ISO 8601, matching the moment of login
      expect(new Date(device!.lastActiveDate).toISOString()).toBe(
        device!.lastActiveDate,
      );
      const lastActive = new Date(device!.lastActiveDate).getTime();
      expect(lastActive).toBeGreaterThanOrEqual(before);
      expect(lastActive).toBeLessThanOrEqual(after);
    });

    //GET /security/devices 200 one session per login
    it("should list one session per login, each with its own deviceId and title", async () => {
      await createTestUser();
      const { refreshToken } = await login(defaultUser, "Chrome");
      await login(defaultUser, "Firefox");
      await login(defaultUser, "Safari");

      const devices = await getDevices(refreshToken);

      expect(devices).toHaveLength(3);
      expect(devices.map((d) => d.title).sort()).toEqual([
        "Chrome",
        "Firefox",
        "Safari",
      ]);
      expect(new Set(devices.map((d) => d.deviceId)).size).toBe(3);
    });

    //GET /security/devices 200 only own sessions
    it("should not list sessions of other users", async () => {
      await createTestUser();
      const other = await createTestUser({
        login: "other_usr",
        password: "password2",
        email: "other@mail.com",
      });
      const { refreshToken } = await login(defaultUser, "Mine");
      const { refreshToken: otherToken } = await login(other, "Theirs");

      const devices = await getDevices(refreshToken);
      expect(devices.map((d) => d.title)).toEqual(["Mine"]);

      const otherDevices = await getDevices(otherToken);
      expect(otherDevices.map((d) => d.title)).toEqual(["Theirs"]);
    });

    //GET /security/devices 200 refresh keeps the session
    it("should keep the same deviceId and move lastActiveDate forward after a token refresh", async () => {
      const { refreshToken } = await loginAndGetTokens();
      const [before] = await getDevices(refreshToken);

      advanceClockBySeconds(5);
      const refreshed = await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken,
      });
      const newRefreshToken = authTestManager.getRefreshToken(refreshed);

      const devices = await getDevices(newRefreshToken);
      expect(devices).toHaveLength(1);
      expect(devices[0]!.deviceId).toBe(before!.deviceId);
      expect(devices[0]!.title).toBe(before!.title);
      expect(new Date(devices[0]!.lastActiveDate).getTime()).toBeGreaterThan(
        new Date(before!.lastActiveDate).getTime(),
      );
    });

    //GET /security/devices 200 logout ends the session
    it("should not list a session after it was logged out", async () => {
      await createTestUser();
      const { refreshToken: kept } = await login(defaultUser, "Kept");
      const { refreshToken: loggedOut } = await login(defaultUser, "LoggedOut");

      await authTestManager.logout({
        expectedStatusCode: 204,
        refreshToken: loggedOut,
      });

      const devices = await getDevices(kept);
      expect(devices.map((d) => d.title)).toEqual(["Kept"]);
    });
  });

  describe("DELETE /security/devices", () => {
    //DELETE /security/devices 204
    it("should return 204 and terminate every session except the current one", async () => {
      await createTestUser();
      const { refreshToken: current } = await login(defaultUser, "Current");
      const { refreshToken: second } = await login(defaultUser, "Second");
      const { refreshToken: third } = await login(defaultUser, "Third");

      await securityDevicesTestManager.deleteDevices({
        expectedStatusCode: 204,
        refreshToken: current,
      });

      const devices = await getDevices(current);
      expect(devices.map((d) => d.title)).toEqual(["Current"]);

      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken: second,
      });
      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken: third,
      });
      await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken: current,
      });
    });

    //DELETE /security/devices 204 only current session exists
    it("should return 204 when the current session is the only one", async () => {
      const { refreshToken } = await loginAndGetTokens();

      await securityDevicesTestManager.deleteDevices({
        expectedStatusCode: 204,
        refreshToken,
      });

      const devices = await getDevices(refreshToken);
      expect(devices).toHaveLength(1);
    });

    //DELETE /security/devices 204 other users untouched
    it("should not terminate sessions of other users", async () => {
      await createTestUser();
      const other = await createTestUser({
        login: "other_usr",
        password: "password2",
        email: "other@mail.com",
      });
      const { refreshToken } = await login();
      const { refreshToken: otherToken } = await login(other);

      await securityDevicesTestManager.deleteDevices({
        expectedStatusCode: 204,
        refreshToken,
      });

      expect(await getDevices(otherToken)).toHaveLength(1);
    });
  });

  describe("DELETE /security/devices/:deviceId", () => {
    //DELETE /security/devices/:deviceId 204 another own session
    it("should return 204 and terminate another session of the same user", async () => {
      await createTestUser();
      const { refreshToken: current } = await login(defaultUser, "Current");
      const { refreshToken: target } = await login(defaultUser, "Target");
      const targetDevice = (await getDevices(current)).find(
        (d) => d.title === "Target",
      )!;

      await securityDevicesTestManager.deleteDeviceById(targetDevice.deviceId, {
        expectedStatusCode: 204,
        refreshToken: current,
      });

      const devices = await getDevices(current);
      expect(devices.map((d) => d.title)).toEqual(["Current"]);
      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken: target,
      });
    });

    //DELETE /security/devices/:deviceId 204 current session
    it("should return 204 and revoke the current refresh token when deleting the current session", async () => {
      const { refreshToken } = await loginAndGetTokens();
      const [device] = await getDevices(refreshToken);

      await securityDevicesTestManager.deleteDeviceById(device!.deviceId, {
        expectedStatusCode: 204,
        refreshToken,
      });

      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken,
      });
    });

    //DELETE /security/devices/:deviceId 404
    it("should return 404 if no session has this deviceId", async () => {
      const { refreshToken } = await loginAndGetTokens();

      await securityDevicesTestManager.deleteDeviceById(crypto.randomUUID(), {
        expectedStatusCode: 404,
        refreshToken,
      });

      expect(await getDevices(refreshToken)).toHaveLength(1);
    });

    //DELETE /security/devices/:deviceId 404 deleted twice
    it("should return 404 when deleting the same session twice", async () => {
      await createTestUser();
      const { refreshToken: current } = await login(defaultUser, "Current");
      await login(defaultUser, "Target");
      const targetDevice = (await getDevices(current)).find(
        (d) => d.title === "Target",
      )!;

      await securityDevicesTestManager.deleteDeviceById(targetDevice.deviceId, {
        expectedStatusCode: 204,
        refreshToken: current,
      });
      await securityDevicesTestManager.deleteDeviceById(targetDevice.deviceId, {
        expectedStatusCode: 404,
        refreshToken: current,
      });
    });

    //DELETE /security/devices/:deviceId 403
    it("should return 403 and keep the session if it belongs to another user", async () => {
      await createTestUser();
      const other = await createTestUser({
        login: "other_usr",
        password: "password2",
        email: "other@mail.com",
      });
      const { refreshToken } = await login();
      const { refreshToken: otherToken } = await login(other);
      const [otherDevice] = await getDevices(otherToken);

      await securityDevicesTestManager.deleteDeviceById(otherDevice!.deviceId, {
        expectedStatusCode: 403,
        refreshToken,
      });

      expect(await getDevices(otherToken)).toHaveLength(1);
      await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken: otherToken,
      });
    });
  });
});
