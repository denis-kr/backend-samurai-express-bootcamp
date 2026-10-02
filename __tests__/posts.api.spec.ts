import { postsTestManager } from "./utils/posts-manager.js";
import { blogsTestManager } from "./utils/blogs-manager.js";
import { usersTestManager } from "./utils/users-manager.js";
import { authTestManager } from "./utils/auth-manager.js";
import { commentsTestManager } from "./utils/comments-manager.js";
import request from "supertest";
import { MongoClient } from "mongodb";
import { app } from "../src/setting.js";

const mongoURI = process.env.MONGO_URI || `mongodb://0.0.0.0:27017/samurai`;

//The tests have to be isolated and independent.

describe("Posts", () => {
  const client = new MongoClient(mongoURI);

  const createTestBlog = async () => {
    const response = await blogsTestManager.createBlog(
      {
        name: "Blog 1",
        description: "Description 1",
        websiteUrl: "https://www.blog1.com",
      },
      { expectedStatusCode: 201, isAuthorized: true },
    );
    return response.body;
  };

  const createTestUserAndLogin = async (
    overrides: { login?: string; password?: string; email?: string } = {},
  ) => {
    const data = {
      login: overrides.login ?? "commenter",
      password: overrides.password ?? "password1",
      email: overrides.email ?? "commenter@mail.com",
    };
    await usersTestManager.createUser(data, {
      expectedStatusCode: 201,
      isAuthorized: true,
    });
    const loginResponse = await authTestManager.login(
      { loginOrEmail: data.login, password: data.password },
      { expectedStatusCode: 200 },
    );
    return {
      login: data.login,
      accessToken: loginResponse.body.accessToken as string,
    };
  };

  beforeEach(() => {
    //clear all data before running tests
    return request(app).delete("/testing/all-data");
  });

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
  });

  describe("POST /posts", () => {
    //POST /posts 201
    it("should create a new post and return 201 status", async () => {
      const blog = await createTestBlog();
      const data = {
        title: "Post 1",
        shortDescription: "Short description 1",
        content: "Content 1",
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(data, {
        expectedStatusCode: 201,
        isAuthorized: true,
      });

      expect(response.body.title).toBe(data.title);
      expect(response.body.shortDescription).toBe(data.shortDescription);
      expect(response.body.content).toBe(data.content);
      expect(response.body.blogId).toBe(data.blogId);
      expect(response.body.blogName).toBe(blog.name);
      expect(response.body.createdAt).toBeDefined();

      // now test that the post was created
      const responseGet = await request(app).get(`/posts/${response.body.id}`);
      expect(responseGet.body).toEqual(response.body);
    });

    //POST /posts 401
    it("should return 401 status for unauthorized request", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        shortDescription: "Short description 1",
        content: "Content 1",
        blogId: blog.id,
      };

      await postsTestManager.createPost(newPost, {
        expectedStatusCode: 401,
      });
      // now test that the post was not created
      const responseGet = await request(app).get("/posts");
      expect(responseGet.body.items).toHaveLength(0);
    });

    //POST /posts 401 with wrong credentials
    it("should return 401 status for request with wrong credentials", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        shortDescription: "Short description 1",
        content: "Content 1",
        blogId: blog.id,
      };

      await postsTestManager.createPost(newPost, {
        expectedStatusCode: 401,
        authHeader: "Basic d3Jvbmc6Y3JlZHM=",
      });
      // now test that the post was not created
      const responseGet = await request(app).get("/posts");
      expect(responseGet.body.items).toHaveLength(0);
    });

    //POST /posts 400 title is required
    it("should return 400 if title is missing", async () => {
      const blog = await createTestBlog();
      const newPost = {
        shortDescription: "Short description 1",
        content: "Content 1",
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "title" }),
      );

      const responseGet = await request(app).get("/posts");
      expect(responseGet.body.items).toHaveLength(0);
    });

    //POST /posts 400 title is empty after trim
    it("should return 400 if title is a whitespace-only string", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "   ",
        shortDescription: "Short description 1",
        content: "Content 1",
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "title" }),
      );
    });

    //POST /posts 400 title exceeds max length
    it("should return 400 if title exceeds 30 characters", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "A".repeat(31),
        shortDescription: "Short description 1",
        content: "Content 1",
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "title" }),
      );
    });

    //POST /posts 201 title at max length boundary
    it("should create a post when title is exactly 30 characters", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "A".repeat(30),
        shortDescription: "Short description 1",
        content: "Content 1",
        blogId: blog.id,
      };

      await postsTestManager.createPost(newPost, {
        expectedStatusCode: 201,
        isAuthorized: true,
      });
    });

    //POST /posts 400 shortDescription is required
    it("should return 400 if shortDescription is missing", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        content: "Content 1",
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "shortDescription" }),
      );
    });

    //POST /posts 400 shortDescription is empty after trim
    it("should return 400 if shortDescription is a whitespace-only string", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        shortDescription: "   ",
        content: "Content 1",
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "shortDescription" }),
      );
    });

    //POST /posts 400 shortDescription exceeds max length
    it("should return 400 if shortDescription exceeds 100 characters", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        shortDescription: "A".repeat(101),
        content: "Content 1",
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "shortDescription" }),
      );
    });

    //POST /posts 201 shortDescription at max length boundary
    it("should create a post when shortDescription is exactly 100 characters", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        shortDescription: "A".repeat(100),
        content: "Content 1",
        blogId: blog.id,
      };

      await postsTestManager.createPost(newPost, {
        expectedStatusCode: 201,
        isAuthorized: true,
      });
    });

    //POST /posts 400 content is required
    it("should return 400 if content is missing", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        shortDescription: "Short description 1",
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //POST /posts 400 content is empty after trim
    it("should return 400 if content is a whitespace-only string", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        shortDescription: "Short description 1",
        content: "   ",
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //POST /posts 400 content exceeds max length
    it("should return 400 if content exceeds 1000 characters", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        shortDescription: "Short description 1",
        content: "A".repeat(1001),
        blogId: blog.id,
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //POST /posts 201 content at max length boundary
    it("should create a post when content is exactly 1000 characters", async () => {
      const blog = await createTestBlog();
      const newPost = {
        title: "Post 1",
        shortDescription: "Short description 1",
        content: "A".repeat(1000),
        blogId: blog.id,
      };

      await postsTestManager.createPost(newPost, {
        expectedStatusCode: 201,
        isAuthorized: true,
      });
    });

    //POST /posts 400 blogId is required
    it("should return 400 if blogId is missing", async () => {
      const newPost = {
        title: "Post 1",
        shortDescription: "Short description 1",
        content: "Content 1",
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "blogId" }),
      );
    });

    //POST /posts 400 blogId is empty after trim
    it("should return 400 if blogId is a whitespace-only string", async () => {
      const newPost = {
        title: "Post 1",
        shortDescription: "Short description 1",
        content: "Content 1",
        blogId: "   ",
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "blogId" }),
      );
    });

    //POST /posts 400 blogId does not reference an existing blog
    it("should return 400 if blogId does not reference an existing blog", async () => {
      const newPost = {
        title: "Post 1",
        shortDescription: "Short description 1",
        content: "Content 1",
        blogId: "507f1f77bcf86cd799439011",
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "blogId" }),
      );
    });

    //POST /posts 400 multiple invalid fields
    it("should return 400 with an error message per invalid field when multiple fields are invalid", async () => {
      const newPost = {
        title: "A".repeat(31),
        shortDescription: "",
        content: "",
        blogId: "",
      };

      const response = await postsTestManager.createPost(newPost, {
        expectedStatusCode: 400,
        isAuthorized: true,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "title" }),
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "shortDescription" }),
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "blogId" }),
      );

      const responseGet = await request(app).get("/posts");
      expect(responseGet.body.items).toHaveLength(0);
    });
  });

  describe("GET /posts", () => {
    //GET /posts 200 empty database
    it("should return 200 with an empty items array and totalCount 0 on a clean DB", async () => {
      const response = await postsTestManager.getPosts(
        {},
        { expectedStatusCode: 200 },
      );

      expect(response.body).toEqual({
        pagesCount: 0,
        page: 1,
        pageSize: 10,
        totalCount: 0,
        items: [],
      });
    });

    //GET /posts 200 does not require authentication
    it("should return 200 without an Authorization header", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await request(app).get("/posts");

      expect(response.statusCode).toBe(200);
      expect(response.body.items).toContainEqual(
        expect.objectContaining({ id: created.body.id }),
      );
    });

    //GET /posts 200 maps Mongo doc to id, no _id
    it("should return posts with an id field and no _id field", async () => {
      const blog = await createTestBlog();
      await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.getPosts(
        {},
        { expectedStatusCode: 200 },
      );

      expect(response.body.items).toHaveLength(1);
      const item = response.body.items[0];
      expect(item.id).toBeDefined();
      expect(item._id).toBeUndefined();
      expect(item.title).toBe("Post 1");
    });

    //GET /posts 200 default pagination when query is omitted
    it("should apply default pagination (pageSize 10, pageNumber 1) when query is omitted", async () => {
      const blog = await createTestBlog();
      for (let i = 1; i <= 12; i++) {
        await postsTestManager.createPost(
          {
            title: `Post ${i}`,
            shortDescription: "Short description",
            content: "Content",
            blogId: blog.id,
          },
          { expectedStatusCode: 201, isAuthorized: true },
        );
      }

      const response = await postsTestManager.getPosts(
        {},
        { expectedStatusCode: 200 },
      );

      expect(response.body.pageSize).toBe(10);
      expect(response.body.page).toBe(1);
      expect(response.body.totalCount).toBe(12);
      expect(response.body.pagesCount).toBe(2);
      expect(response.body.items).toHaveLength(10);
    });

    //GET /posts 200 pageSize/pageNumber slice correctly
    it("should return the correct page slice for a given pageSize and pageNumber", async () => {
      const blog = await createTestBlog();
      for (let i = 1; i <= 5; i++) {
        await postsTestManager.createPost(
          {
            title: `Post ${i}`,
            shortDescription: "Short description",
            content: "Content",
            blogId: blog.id,
          },
          { expectedStatusCode: 201, isAuthorized: true },
        );
      }

      const response = await postsTestManager.getPosts(
        { pageSize: 2, pageNumber: 2, sortBy: "title", sortDirection: "asc" },
        { expectedStatusCode: 200 },
      );

      expect(response.body.pagesCount).toBe(3);
      expect(response.body.page).toBe(2);
      expect(response.body.pageSize).toBe(2);
      expect(response.body.totalCount).toBe(5);
      expect(response.body.items.map((p: any) => p.title)).toEqual([
        "Post 3",
        "Post 4",
      ]);
    });

    //GET /posts 200 sortDirection asc
    it("should sort ascending by the given sortBy field", async () => {
      const blog = await createTestBlog();
      for (const title of ["Post B", "Post A", "Post C"]) {
        await postsTestManager.createPost(
          {
            title,
            shortDescription: "Short description",
            content: "Content",
            blogId: blog.id,
          },
          { expectedStatusCode: 201, isAuthorized: true },
        );
      }

      const response = await postsTestManager.getPosts(
        { sortBy: "title", sortDirection: "asc" },
        { expectedStatusCode: 200 },
      );

      expect(response.body.items.map((p: any) => p.title)).toEqual([
        "Post A",
        "Post B",
        "Post C",
      ]);
    });

    //GET /posts 200 sortDirection desc (default)
    it("should sort descending by the given sortBy field by default", async () => {
      const blog = await createTestBlog();
      for (const title of ["Post B", "Post A", "Post C"]) {
        await postsTestManager.createPost(
          {
            title,
            shortDescription: "Short description",
            content: "Content",
            blogId: blog.id,
          },
          { expectedStatusCode: 201, isAuthorized: true },
        );
      }

      const response = await postsTestManager.getPosts(
        { sortBy: "title" },
        { expectedStatusCode: 200 },
      );

      expect(response.body.items.map((p: any) => p.title)).toEqual([
        "Post C",
        "Post B",
        "Post A",
      ]);
    });

    //GET /posts 400 pageSize is not an integer
    it("should return 400 if pageSize is not an integer", async () => {
      const response = await postsTestManager.getPosts(
        { pageSize: "abc" },
        { expectedStatusCode: 400 },
      );

      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "pageSize" }),
      );
    });

    //GET /posts 400 pageSize below minimum
    it("should return 400 if pageSize is 0", async () => {
      const response = await postsTestManager.getPosts(
        { pageSize: 0 },
        { expectedStatusCode: 400 },
      );

      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "pageSize" }),
      );
    });

    //GET /posts 200 pageSize at minimum boundary
    it("should accept pageSize exactly 1", async () => {
      const response = await postsTestManager.getPosts(
        { pageSize: 1 },
        { expectedStatusCode: 200 },
      );

      expect(response.body.pageSize).toBe(1);
    });

    //GET /posts 400 pageNumber is not an integer
    it("should return 400 if pageNumber is not an integer", async () => {
      const response = await postsTestManager.getPosts(
        { pageNumber: "abc" },
        { expectedStatusCode: 400 },
      );

      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "pageNumber" }),
      );
    });

    //GET /posts 400 pageNumber below minimum
    it("should return 400 if pageNumber is 0", async () => {
      const response = await postsTestManager.getPosts(
        { pageNumber: 0 },
        { expectedStatusCode: 400 },
      );

      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "pageNumber" }),
      );
    });

    //GET /posts 400 sortBy is not a string
    it("should return 400 if sortBy is not a string", async () => {
      const response = await postsTestManager.getPosts(
        { sortBy: ["a", "b"] as any },
        { expectedStatusCode: 400 },
      );

      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "sortBy" }),
      );
    });

    //GET /posts 400 sortDirection is not 'asc' or 'desc'
    it("should return 400 if sortDirection is neither 'asc' nor 'desc'", async () => {
      const response = await postsTestManager.getPosts(
        { sortDirection: "sideways" },
        { expectedStatusCode: 400 },
      );

      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "sortDirection" }),
      );
    });

    //GET /posts 400 multiple invalid query params
    it("should return 400 with an error message per invalid field when multiple query params are invalid", async () => {
      const response = await postsTestManager.getPosts(
        { pageSize: 0, sortDirection: "sideways" },
        { expectedStatusCode: 400 },
      );

      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "pageSize" }),
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "sortDirection" }),
      );
    });
  });

  describe("GET /posts/:id", () => {
    //GET /posts/:id 200
    it("should return the post matching the given id", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.getPostById(created.body.id, {
        expectedStatusCode: 200,
      });

      expect(response.body).toEqual(created.body);
    });

    //GET /posts/:id 200 does not require authentication
    it("should return 200 without an Authorization header", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await request(app).get(`/posts/${created.body.id}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(created.body.id);
    });

    //GET /posts/:id 200 maps Mongo doc to id, no _id field
    it("should return the post with an id field and no _id field", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.getPostById(created.body.id, {
        expectedStatusCode: 200,
      });

      expect(response.body.id).toBe(created.body.id);
      expect(response.body._id).toBeUndefined();
    });

    //GET /posts/:id 400 id is a whitespace-only string
    it("should return 400 if id is a whitespace-only string", async () => {
      const response = await request(app).get("/posts/%20");

      expect(response.statusCode).toBe(400);
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "id" }),
      );
    });

    //GET /posts/:id 404 well-formed id but no matching post
    it("should return 404 if no post exists with the given id", async () => {
      await postsTestManager.getPostById("507f1f77bcf86cd799439011", {
        expectedStatusCode: 404,
      });
    });

    //GET /posts/:id 404 malformed id (not a valid ObjectId)
    it("should return 404 if the id is not a valid ObjectId", async () => {
      await postsTestManager.getPostById("invalid-id", {
        expectedStatusCode: 404,
      });
    });
  });

  describe("DELETE /posts/:id", () => {
    //DELETE /posts/:id 204
    it("should delete the post and return 204 status", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.deletePost(created.body.id, {
        expectedStatusCode: 204,
        isAuthorized: true,
      });

      const responseGet = await request(app).get(`/posts/${created.body.id}`);
      expect(responseGet.statusCode).toBe(404);
    });

    //DELETE /posts/:id 401 no Authorization header
    it("should return 401 status for unauthorized request", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.deletePost(created.body.id, {
        expectedStatusCode: 401,
      });

      const responseGet = await request(app).get(`/posts/${created.body.id}`);
      expect(responseGet.statusCode).toBe(200);
    });

    //DELETE /posts/:id 401 with wrong credentials
    it("should return 401 status for request with wrong credentials", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.deletePost(created.body.id, {
        expectedStatusCode: 401,
        authHeader: "Basic d3Jvbmc6Y3JlZHM=",
      });

      const responseGet = await request(app).get(`/posts/${created.body.id}`);
      expect(responseGet.statusCode).toBe(200);
    });

    //DELETE /posts/:id 404 well-formed id but no matching post
    it("should return 404 if no post exists with the given id", async () => {
      await postsTestManager.deletePost("507f1f77bcf86cd799439011", {
        expectedStatusCode: 404,
        isAuthorized: true,
      });
    });

    //DELETE /posts/:id 404 malformed id (not a valid ObjectId)
    it("should return 404 if the id is not a valid ObjectId", async () => {
      await postsTestManager.deletePost("invalid-id", {
        expectedStatusCode: 404,
        isAuthorized: true,
      });
    });

    //DELETE /posts/:id 404 on second delete of the same post
    it("should return 404 when deleting the same post a second time", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.deletePost(created.body.id, {
        expectedStatusCode: 204,
        isAuthorized: true,
      });

      await postsTestManager.deletePost(created.body.id, {
        expectedStatusCode: 404,
        isAuthorized: true,
      });
    });
  });

  describe("PUT /posts/:id", () => {
    //PUT /posts/:id 204
    it("should update the post and return 204 status", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const updateData = {
        title: "Updated",
        shortDescription: "Updated Description",
        content: "Updated Content",
        blogId: blog.id,
      };

      await postsTestManager.updatePost(updateData, created.body.id, {
        expectedStatusCode: 204,
        isAuthorized: true,
      });

      const responseGet = await request(app).get(`/posts/${created.body.id}`);
      expect(responseGet.body.title).toBe(updateData.title);
      expect(responseGet.body.shortDescription).toBe(
        updateData.shortDescription,
      );
      expect(responseGet.body.content).toBe(updateData.content);
      expect(responseGet.body.id).toBe(created.body.id);
    });

    //PUT /posts/:id 401 no Authorization header
    it("should return 401 status for unauthorized request", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.updatePost(
        {
          title: "Updated",
          shortDescription: "Updated Description",
          content: "Updated Content",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 401 },
      );

      const responseGet = await request(app).get(`/posts/${created.body.id}`);
      expect(responseGet.body.title).toBe("Post 1");
    });

    //PUT /posts/:id 401 with wrong credentials
    it("should return 401 status for request with wrong credentials", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.updatePost(
        {
          title: "Updated",
          shortDescription: "Updated Description",
          content: "Updated Content",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 401, authHeader: "Basic d3Jvbmc6Y3JlZHM=" },
      );

      const responseGet = await request(app).get(`/posts/${created.body.id}`);
      expect(responseGet.body.title).toBe("Post 1");
    });

    //PUT /posts/:id 404 well-formed id but no matching post
    it("should return 404 if no post exists with the given id", async () => {
      const blog = await createTestBlog();
      await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        "507f1f77bcf86cd799439011",
        { expectedStatusCode: 404, isAuthorized: true },
      );
    });

    //PUT /posts/:id 404 malformed id (not a valid ObjectId)
    it("should return 404 if the id is not a valid ObjectId", async () => {
      const blog = await createTestBlog();
      await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        "invalid-id",
        { expectedStatusCode: 404, isAuthorized: true },
      );
    });

    //PUT /posts/:id 400 title is required
    it("should return 400 if title is missing", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "title" }),
      );

      const responseGet = await request(app).get(`/posts/${created.body.id}`);
      expect(responseGet.body.title).toBe("Post 1");
    });

    //PUT /posts/:id 400 title is empty after trim
    it("should return 400 if title is a whitespace-only string", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "   ",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "title" }),
      );
    });

    //PUT /posts/:id 400 title exceeds max length
    it("should return 400 if title exceeds 30 characters", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "A".repeat(31),
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "title" }),
      );
    });

    //PUT /posts/:id 204 title at max length boundary
    it("should update the post when title is exactly 30 characters", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.updatePost(
        {
          title: "A".repeat(30),
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 204, isAuthorized: true },
      );
    });

    //PUT /posts/:id 400 shortDescription is required
    it("should return 400 if shortDescription is missing", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        { title: "Post 1", content: "Content 1", blogId: blog.id },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "shortDescription" }),
      );
    });

    //PUT /posts/:id 400 shortDescription is empty after trim
    it("should return 400 if shortDescription is a whitespace-only string", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "   ",
          content: "Content 1",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "shortDescription" }),
      );
    });

    //PUT /posts/:id 400 shortDescription exceeds max length
    it("should return 400 if shortDescription exceeds 100 characters", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "A".repeat(101),
          content: "Content 1",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "shortDescription" }),
      );
    });

    //PUT /posts/:id 204 shortDescription at max length boundary
    it("should update the post when shortDescription is exactly 100 characters", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "A".repeat(100),
          content: "Content 1",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 204, isAuthorized: true },
      );
    });

    //PUT /posts/:id 400 content is required
    it("should return 400 if content is missing", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //PUT /posts/:id 400 content is empty after trim
    it("should return 400 if content is a whitespace-only string", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "   ",
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //PUT /posts/:id 400 content exceeds max length
    it("should return 400 if content exceeds 1000 characters", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "A".repeat(1001),
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //PUT /posts/:id 204 content at max length boundary
    it("should update the post when content is exactly 1000 characters", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "A".repeat(1000),
          blogId: blog.id,
        },
        created.body.id,
        { expectedStatusCode: 204, isAuthorized: true },
      );
    });

    //PUT /posts/:id 400 blogId is required
    it("should return 400 if blogId is missing", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "blogId" }),
      );
    });

    //PUT /posts/:id 400 blogId does not reference an existing blog
    it("should return 400 if blogId does not reference an existing blog", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: "507f1f77bcf86cd799439011",
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "blogId" }),
      );
    });

    //PUT /posts/:id 400 multiple invalid fields
    it("should return 400 with an error message per invalid field when multiple fields are invalid", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.updatePost(
        {
          title: "A".repeat(31),
          shortDescription: "",
          content: "",
          blogId: "",
        },
        created.body.id,
        { expectedStatusCode: 400, isAuthorized: true },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "title" }),
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "shortDescription" }),
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "blogId" }),
      );

      const responseGet = await request(app).get(`/posts/${created.body.id}`);
      expect(responseGet.body.title).toBe("Post 1");
    });

    //PUT /posts/:id 204 both times when updating the same post twice (idempotent, unlike DELETE)
    it("should return 204 both times when updating the same post twice with valid data", async () => {
      const blog = await createTestBlog();
      const created = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const updateData = {
        title: "Updated",
        shortDescription: "Updated Description",
        content: "Updated Content",
        blogId: blog.id,
      };

      await postsTestManager.updatePost(updateData, created.body.id, {
        expectedStatusCode: 204,
        isAuthorized: true,
      });

      await postsTestManager.updatePost(updateData, created.body.id, {
        expectedStatusCode: 204,
        isAuthorized: true,
      });

      const responseGet = await request(app).get(`/posts/${created.body.id}`);
      expect(responseGet.body.title).toBe(updateData.title);
    });
  });

  describe("POST /posts/:postId/comments", () => {
    //POST /posts/:postId/comments 201
    it("should create a new comment for the post and return 201 status", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken, login } = await createTestUserAndLogin();

      const response = await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(20) },
        { expectedStatusCode: 201, authHeader: `Bearer ${accessToken}` },
      );

      expect(response.body.content).toBe("A".repeat(20));
      expect(response.body.commentatorInfo).toEqual({
        userId: expect.any(String),
        userLogin: login,
      });
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body._id).toBeUndefined();
      expect(response.body.likesInfo).toEqual({
        likesCount: 0,
        dislikesCount: 0,
        myStatus: "None",
      });
    });

    //POST /posts/:postId/comments 401 no Authorization header
    it("should return 401 status for unauthorized request", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(20) },
        { expectedStatusCode: 401 },
      );
    });

    //POST /posts/:postId/comments 401 malformed/invalid token
    it("should return 401 status for an invalid token", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(20) },
        { expectedStatusCode: 401, authHeader: "Bearer not-a-real-token" },
      );
    });

    //POST /posts/:postId/comments 404 well-formed postId but no matching post
    it("should return 404 if no post exists with the given postId", async () => {
      const { accessToken } = await createTestUserAndLogin();

      await postsTestManager.createCommentForPost(
        "507f1f77bcf86cd799439011",
        { content: "A".repeat(20) },
        { expectedStatusCode: 404, authHeader: `Bearer ${accessToken}` },
      );
    });

    //POST /posts/:postId/comments 404 malformed postId (not a valid ObjectId)
    it("should return 404 if the postId is not a valid ObjectId", async () => {
      const { accessToken } = await createTestUserAndLogin();

      await postsTestManager.createCommentForPost(
        "invalid-id",
        { content: "A".repeat(20) },
        { expectedStatusCode: 404, authHeader: `Bearer ${accessToken}` },
      );
    });

    //POST /posts/:postId/comments 400 content is required
    it("should return 400 if content is missing", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken } = await createTestUserAndLogin();

      const response = await postsTestManager.createCommentForPost(
        post.body.id,
        {},
        { expectedStatusCode: 400, authHeader: `Bearer ${accessToken}` },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //POST /posts/:postId/comments 400 content below minimum length
    it("should return 400 if content is shorter than 20 characters", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken } = await createTestUserAndLogin();

      const response = await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(19) },
        { expectedStatusCode: 400, authHeader: `Bearer ${accessToken}` },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //POST /posts/:postId/comments 201 content at minimum length boundary
    it("should create a comment when content is exactly 20 characters", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken } = await createTestUserAndLogin();

      await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(20) },
        { expectedStatusCode: 201, authHeader: `Bearer ${accessToken}` },
      );
    });

    //POST /posts/:postId/comments 400 content exceeds max length
    it("should return 400 if content exceeds 300 characters", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken } = await createTestUserAndLogin();

      const response = await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(301) },
        { expectedStatusCode: 400, authHeader: `Bearer ${accessToken}` },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //POST /posts/:postId/comments 201 content at maximum length boundary
    it("should create a comment when content is exactly 300 characters", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken } = await createTestUserAndLogin();

      await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(300) },
        { expectedStatusCode: 201, authHeader: `Bearer ${accessToken}` },
      );
    });
  });

  describe("GET /posts/:postId/comments", () => {
    //GET /posts/:postId/comments 200 empty
    it("should return 200 with an empty items array and totalCount 0 when the post has no comments", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await postsTestManager.getCommentsForPost(
        post.body.id,
        {},
        { expectedStatusCode: 200 },
      );

      expect(response.body).toEqual({
        pagesCount: 0,
        page: 1,
        pageSize: 10,
        totalCount: 0,
        items: [],
      });
    });

    //GET /posts/:postId/comments 200 does not require authentication
    it("should return 200 without an Authorization header", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken } = await createTestUserAndLogin();
      await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(20) },
        { expectedStatusCode: 201, authHeader: `Bearer ${accessToken}` },
      );

      const response = await postsTestManager.getCommentsForPost(
        post.body.id,
        {},
        { expectedStatusCode: 200 },
      );

      expect(response.body.items).toHaveLength(1);
    });

    //GET /posts/:postId/comments 200 maps Mongo doc to id, no _id field
    it("should return comments with an id field and no _id field", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken } = await createTestUserAndLogin();
      await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(20) },
        { expectedStatusCode: 201, authHeader: `Bearer ${accessToken}` },
      );

      const response = await postsTestManager.getCommentsForPost(
        post.body.id,
        {},
        { expectedStatusCode: 200 },
      );

      const item = response.body.items[0];
      expect(item.id).toBeDefined();
      expect(item._id).toBeUndefined();
    });

    //GET /posts/:postId/comments 200 likesInfo with myStatus for the current viewer
    it("should return likesInfo with myStatus of the user from the access token", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const author = await createTestUserAndLogin();
      const liker = await createTestUserAndLogin({
        login: "liker",
        email: "liker@mail.com",
      });
      const comment = await postsTestManager.createCommentForPost(
        post.body.id,
        { content: "A".repeat(20) },
        { expectedStatusCode: 201, authHeader: `Bearer ${author.accessToken}` },
      );
      await commentsTestManager.updateLikeStatus(
        comment.body.id,
        { likeStatus: "Like" },
        { expectedStatusCode: 204, authHeader: `Bearer ${liker.accessToken}` },
      );

      const asLiker = await postsTestManager.getCommentsForPost(
        post.body.id,
        {},
        { expectedStatusCode: 200, authHeader: `Bearer ${liker.accessToken}` },
      );
      expect(asLiker.body.items[0].likesInfo).toEqual({
        likesCount: 1,
        dislikesCount: 0,
        myStatus: "Like",
      });

      const asAuthor = await postsTestManager.getCommentsForPost(
        post.body.id,
        {},
        { expectedStatusCode: 200, authHeader: `Bearer ${author.accessToken}` },
      );
      expect(asAuthor.body.items[0].likesInfo).toEqual({
        likesCount: 1,
        dislikesCount: 0,
        myStatus: "None",
      });

      // An invalid token on this public endpoint is ignored rather than rejected
      const withInvalidToken = await postsTestManager.getCommentsForPost(
        post.body.id,
        {},
        { expectedStatusCode: 200, authHeader: "Bearer invalid.token.value" },
      );
      expect(withInvalidToken.body.items[0].likesInfo.myStatus).toBe("None");
    });

    //GET /posts/:postId/comments 200 only returns comments for the specified post
    it("should not return comments belonging to a different post", async () => {
      const blog = await createTestBlog();
      const post1 = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const post2 = await postsTestManager.createPost(
        {
          title: "Post 2",
          shortDescription: "Short description 2",
          content: "Content 2",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken } = await createTestUserAndLogin();

      await postsTestManager.createCommentForPost(
        post1.body.id,
        { content: "Comment for post one " },
        { expectedStatusCode: 201, authHeader: `Bearer ${accessToken}` },
      );
      await postsTestManager.createCommentForPost(
        post2.body.id,
        { content: "Comment for post two " },
        { expectedStatusCode: 201, authHeader: `Bearer ${accessToken}` },
      );

      const response = await postsTestManager.getCommentsForPost(
        post1.body.id,
        {},
        { expectedStatusCode: 200 },
      );

      expect(response.body.totalCount).toBe(1);
      expect(response.body.items).toHaveLength(1);
    });

    //GET /posts/:postId/comments 404 well-formed postId but no matching post
    it("should return 404 if no post exists with the given postId", async () => {
      await postsTestManager.getCommentsForPost(
        "507f1f77bcf86cd799439011",
        {},
        { expectedStatusCode: 404 },
      );
    });

    //GET /posts/:postId/comments 404 malformed postId (not a valid ObjectId)
    it("should return 404 if the postId is not a valid ObjectId", async () => {
      await postsTestManager.getCommentsForPost(
        "invalid-id",
        {},
        { expectedStatusCode: 404 },
      );
    });

    //GET /posts/:postId/comments 200 default pagination when query is omitted
    it("should apply default pagination (pageSize 10, pageNumber 1) when query is omitted", async () => {
      const blog = await createTestBlog();
      const post = await postsTestManager.createPost(
        {
          title: "Post 1",
          shortDescription: "Short description 1",
          content: "Content 1",
          blogId: blog.id,
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const { accessToken } = await createTestUserAndLogin();
      for (let i = 1; i <= 12; i++) {
        await postsTestManager.createCommentForPost(
          post.body.id,
          { content: `Comment number ${i} `.repeat(2) },
          { expectedStatusCode: 201, authHeader: `Bearer ${accessToken}` },
        );
      }

      const response = await postsTestManager.getCommentsForPost(
        post.body.id,
        {},
        { expectedStatusCode: 200 },
      );

      expect(response.body.pageSize).toBe(10);
      expect(response.body.page).toBe(1);
      expect(response.body.totalCount).toBe(12);
      expect(response.body.pagesCount).toBe(2);
      expect(response.body.items).toHaveLength(10);
    });
  });
});
