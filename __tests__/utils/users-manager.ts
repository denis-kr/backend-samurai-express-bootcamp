import request from "supertest";
import { app } from "../../src/setting.js";

export const usersTestManager: any = {
  async getUsers(
    query: {
      pageSize?: number | string;
      pageNumber?: number | string;
      sortBy?: string;
      sortDirection?: string;
      searchLoginTerm?: string;
      searchEmailTerm?: string;
    } = {},
    {
      expectedStatusCode,
      isAuthorized = false,
      authHeader,
    }: {
      expectedStatusCode: number;
      isAuthorized?: boolean;
      authHeader?: string;
    }
  ) {
    const requestObject = request(app).get("/users").query(query as any);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    } else if (isAuthorized) {
      requestObject.set("Authorization", "Basic YWRtaW46cXdlcnR5");
    }

    const response = await requestObject;

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async createUser(
    data: {
      login?: string;
      password?: string;
      email?: string;
    },
    {
      expectedStatusCode,
      isAuthorized = false,
      authHeader,
    }: {
      expectedStatusCode: number;
      isAuthorized?: boolean;
      authHeader?: string;
    }
  ) {
    const requestObject = request(app).post("/users");

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    } else if (isAuthorized) {
      requestObject.set("Authorization", "Basic YWRtaW46cXdlcnR5");
    }

    const response = await requestObject.send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    if (response.statusCode === 201) {
      expect(response.body.login).toBe(data.login);
      expect(response.body.email).toBe(data.email);
    }

    return response;
  },
};
