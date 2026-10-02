import request from "supertest";
import { app } from "../../src/setting.js";
import type { Post } from "../../src/repositories/models/post-model.js";

export const postsTestManager: any = {
  async getPosts(
    query: {
      pageSize?: number | string;
      pageNumber?: number | string;
      sortBy?: string;
      sortDirection?: string;
    } = {},
    { expectedStatusCode }: { expectedStatusCode: number }
  ) {
    const response = await request(app).get("/posts").query(query as any);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async getPostById(
    id: string,
    { expectedStatusCode }: { expectedStatusCode: number }
  ) {
    const response = await request(app).get(`/posts/${id}`);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async createPost(
    data: {
      title?: Post["title"];
      shortDescription?: Post["shortDescription"];
      content?: Post["content"];
      blogId?: Post["blogId"];
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
    const requestObject = request(app).post("/posts");

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    } else if (isAuthorized) {
      requestObject.set("Authorization", "Basic YWRtaW46cXdlcnR5");
    }

    const response = await requestObject.send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    if (response.statusCode === 200 || response.statusCode === 201) {
      expect(response.body.title).toBe(data.title);
      expect(response.body.shortDescription).toBe(data.shortDescription);
      expect(response.body.content).toBe(data.content);
      expect(response.body.blogId).toBe(data.blogId);
    }

    return response;
  },
  async updatePost(
    data: {
      title?: Post["title"];
      shortDescription?: Post["shortDescription"];
      content?: Post["content"];
      blogId?: Post["blogId"];
    },
    id: string,
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
    const requestObject = request(app).put(`/posts/${id}`);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    } else if (isAuthorized) {
      requestObject.set("Authorization", "Basic YWRtaW46cXdlcnR5");
    }

    const response = await requestObject.send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async deletePost(
    id: string,
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
    const requestObject = request(app).delete(`/posts/${id}`);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    } else if (isAuthorized) {
      requestObject.set("Authorization", "Basic YWRtaW46cXdlcnR5");
    }

    const response = await requestObject;

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async createCommentForPost(
    postId: string,
    data: { content?: string },
    {
      expectedStatusCode,
      authHeader,
    }: { expectedStatusCode: number; authHeader?: string }
  ) {
    const requestObject = request(app).post(`/posts/${postId}/comments`);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    }

    const response = await requestObject.send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    if (response.statusCode === 201) {
      expect(response.body.content).toBe(data.content);
    }

    return response;
  },
  async getCommentsForPost(
    postId: string,
    query: {
      pageSize?: number | string;
      pageNumber?: number | string;
      sortBy?: string;
      sortDirection?: string;
    } = {},
    {
      expectedStatusCode,
      authHeader,
    }: { expectedStatusCode: number; authHeader?: string }
  ) {
    const requestObject = request(app)
      .get(`/posts/${postId}/comments`)
      .query(query as any);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    }

    const response = await requestObject;

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
};
