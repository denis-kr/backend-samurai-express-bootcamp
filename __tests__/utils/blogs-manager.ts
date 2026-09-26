import request from "supertest";
import type { Blog } from "../../src/repositories/models/blog-model.js";
import { app } from "../../src/setting.js";

export const blogsTestManager: any = {
  async getBlogs(
    query: {
      pageSize?: number | string;
      pageNumber?: number | string;
      sortBy?: string;
      sortDirection?: string;
      searchNameTerm?: string;
    } = {},
    { expectedStatusCode }: { expectedStatusCode: number }
  ) {
    const response = await request(app).get("/blogs").query(query as any);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async getBlogById(
    id: string,
    { expectedStatusCode }: { expectedStatusCode: number }
  ) {
    const response = await request(app).get(`/blogs/${id}`);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async getPostsForBlog(
    blogId: string,
    query: {
      pageSize?: number | string;
      pageNumber?: number | string;
      sortBy?: string;
      sortDirection?: string;
    } = {},
    { expectedStatusCode }: { expectedStatusCode: number }
  ) {
    const response = await request(app)
      .get(`/blogs/${blogId}/posts`)
      .query(query as any);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async createPostForBlog(
    blogId: string,
    data: {
      title?: string;
      shortDescription?: string;
      content?: string;
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
    const requestObject = request(app).post(`/blogs/${blogId}/posts`);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    } else if (isAuthorized) {
      requestObject.set("Authorization", "Basic YWRtaW46cXdlcnR5");
    }

    const response = await requestObject.send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    if (response.statusCode === 201) {
      expect(response.body.title).toBe(data.title);
      expect(response.body.shortDescription).toBe(data.shortDescription);
      expect(response.body.content).toBe(data.content);
      expect(response.body.blogId).toBe(blogId);
    }

    return response;
  },
  async createBlog(
    data: {
      name: Blog["name"];
      description: Blog["description"];
      websiteUrl: Blog["websiteUrl"];
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
    const requestObject = request(app).post("/blogs");

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    } else if (isAuthorized) {
      requestObject.set("Authorization", "Basic YWRtaW46cXdlcnR5");
    }

    const response = await requestObject.send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    if (response.statusCode === 200 || response.statusCode === 201) {
      expect(response.body.name).toBe(data.name);
      expect(response.body.description).toBe(data.description);
      expect(response.body.websiteUrl).toBe(data.websiteUrl);
    }

    return response;
  },
  async updateBlog(
    data: {
      name?: Blog["name"];
      description?: Blog["description"];
      websiteUrl?: Blog["websiteUrl"];
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
    const requestObject = request(app).put(`/blogs/${id}`);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    } else if (isAuthorized) {
      requestObject.set("Authorization", "Basic YWRtaW46cXdlcnR5");
    }

    const response = await requestObject.send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async deleteBlog(
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
    const requestObject = request(app).delete(`/blogs/${id}`);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    } else if (isAuthorized) {
      requestObject.set("Authorization", "Basic YWRtaW46cXdlcnR5");
    }

    const response = await requestObject;

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
};
