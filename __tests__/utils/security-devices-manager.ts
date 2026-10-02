import request from "supertest";
import { app } from "../../src/setting.js";

const withRefreshToken = (
  requestObject: request.Test,
  refreshToken?: string,
) => {
  if (refreshToken !== undefined) {
    requestObject.set("Cookie", `refreshToken=${refreshToken}`);
  }
  return requestObject;
};

export const securityDevicesTestManager: any = {
  async getDevices({
    expectedStatusCode,
    refreshToken,
  }: {
    expectedStatusCode: number;
    refreshToken?: string;
  }) {
    const response = await withRefreshToken(
      request(app).get("/security/devices"),
      refreshToken,
    );

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async deleteDevices({
    expectedStatusCode,
    refreshToken,
  }: {
    expectedStatusCode: number;
    refreshToken?: string;
  }) {
    const response = await withRefreshToken(
      request(app).delete("/security/devices"),
      refreshToken,
    );

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async deleteDeviceById(
    deviceId: string,
    {
      expectedStatusCode,
      refreshToken,
    }: { expectedStatusCode: number; refreshToken?: string },
  ) {
    const response = await withRefreshToken(
      request(app).delete(`/security/devices/${deviceId}`),
      refreshToken,
    );

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
};
