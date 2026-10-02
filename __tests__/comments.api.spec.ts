import request from "supertest";
import { app } from "../src/setting.js";
import { commentsTestManager } from "./utils/comments-manager.js";
import { postsTestManager } from "./utils/posts-manager.js";
import { blogsTestManager } from "./utils/blogs-manager.js";
import { usersTestManager } from "./utils/users-manager.js";
import { authTestManager } from "./utils/auth-manager.js";

//The tests have to be isolated and independent.

describe("Comments", () => {
  beforeEach(() => {
    //clear all data before running tests
    return request(app).delete("/testing/all-data");
  });

  const createTestPost = async () => {
    const blog = await blogsTestManager.createBlog(
      { name: "Blog 1", description: "Description 1", websiteUrl: "https://www.blog1.com" },
      { expectedStatusCode: 201, isAuthorized: true },
    );
    const post = await postsTestManager.createPost(
      { title: "Post 1", shortDescription: "Short description 1", content: "Content 1", blogId: blog.body.id },
      { expectedStatusCode: 201, isAuthorized: true },
    );
    return post.body;
  };

  const createTestUserAndLogin = async (
    overrides: { login?: string; password?: string; email?: string } = {},
  ) => {
    const data = {
      login: overrides.login ?? "commenter",
      password: overrides.password ?? "password1",
      email: overrides.email ?? "commenter@mail.com",
    };
    const created = await usersTestManager.createUser(data, {
      expectedStatusCode: 201,
      isAuthorized: true,
    });
    const loginResponse = await authTestManager.login(
      { loginOrEmail: data.login, password: data.password },
      { expectedStatusCode: 200 },
    );
    return {
      userId: created.body.id,
      login: data.login,
      accessToken: loginResponse.body.accessToken as string,
    };
  };

  const createTestComment = async (
    postId: string,
    accessToken: string,
    content = "A".repeat(20),
  ) => {
    const response = await postsTestManager.createCommentForPost(
      postId,
      { content },
      { expectedStatusCode: 201, authHeader: `Bearer ${accessToken}` },
    );
    return response.body;
  };

  describe("GET /comments/:id", () => {
    //GET /comments/:id 200
    it("should return the comment matching the given id", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      const response = await commentsTestManager.getCommentById(created.id, {
        expectedStatusCode: 200,
      });

      expect(response.body).toEqual(created);
    });

    //GET /comments/:id 200 does not require authentication
    it("should return 200 without an Authorization header", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      const response = await request(app).get(`/comments/${created.id}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(created.id);
    });

    //GET /comments/:id 404 well-formed id but no matching comment
    it("should return 404 if no comment exists with the given id", async () => {
      await commentsTestManager.getCommentById("507f1f77bcf86cd799439011", {
        expectedStatusCode: 404,
      });
    });

    //GET /comments/:id 404 malformed id (not a valid ObjectId)
    it("should return 404 if the id is not a valid ObjectId", async () => {
      await commentsTestManager.getCommentById("invalid-id", {
        expectedStatusCode: 404,
      });
    });
  });

  describe("PUT /comments/:commentId", () => {
    //PUT /comments/:commentId 204
    it("should update the comment content and return 204 status", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      const updatedContent = "Updated content ".repeat(2);
      await commentsTestManager.updateComment(
        created.id,
        { content: updatedContent },
        { expectedStatusCode: 204, authHeader: `Bearer ${accessToken}` },
      );

      const responseGet = await commentsTestManager.getCommentById(created.id, {
        expectedStatusCode: 200,
      });
      expect(responseGet.body.content).toBe(updatedContent);
    });

    //PUT /comments/:commentId 401 no Authorization header
    it("should return 401 status for unauthorized request", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      await commentsTestManager.updateComment(
        created.id,
        { content: "Updated content ".repeat(2) },
        { expectedStatusCode: 401 },
      );

      const responseGet = await commentsTestManager.getCommentById(created.id, {
        expectedStatusCode: 200,
      });
      expect(responseGet.body.content).toBe(created.content);
    });

    //PUT /comments/:commentId 403 not the comment's owner
    it("should return 403 if the authenticated user is not the comment's owner", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin({
        login: "owner",
        email: "owner@mail.com",
      });
      const created = await createTestComment(post.id, accessToken);

      const otherUser = await createTestUserAndLogin({
        login: "intruder",
        email: "intruder@mail.com",
      });

      await commentsTestManager.updateComment(
        created.id,
        { content: "Updated content ".repeat(2) },
        { expectedStatusCode: 403, authHeader: `Bearer ${otherUser.accessToken}` },
      );

      const responseGet = await commentsTestManager.getCommentById(created.id, {
        expectedStatusCode: 200,
      });
      expect(responseGet.body.content).toBe(created.content);
    });

    //PUT /comments/:commentId 404 well-formed id but no matching comment
    it("should return 404 if no comment exists with the given commentId", async () => {
      const { accessToken } = await createTestUserAndLogin();

      await commentsTestManager.updateComment(
        "507f1f77bcf86cd799439011",
        { content: "Updated content ".repeat(2) },
        { expectedStatusCode: 404, authHeader: `Bearer ${accessToken}` },
      );
    });

    //PUT /comments/:commentId 404 malformed id (not a valid ObjectId)
    it("should return 404 if the commentId is not a valid ObjectId", async () => {
      const { accessToken } = await createTestUserAndLogin();

      await commentsTestManager.updateComment(
        "invalid-id",
        { content: "Updated content ".repeat(2) },
        { expectedStatusCode: 404, authHeader: `Bearer ${accessToken}` },
      );
    });

    //PUT /comments/:commentId 400 content is required
    it("should return 400 if content is missing", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      const response = await commentsTestManager.updateComment(
        created.id,
        {},
        { expectedStatusCode: 400, authHeader: `Bearer ${accessToken}` },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //PUT /comments/:commentId 400 content below minimum length
    it("should return 400 if content is shorter than 20 characters", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      const response = await commentsTestManager.updateComment(
        created.id,
        { content: "A".repeat(19) },
        { expectedStatusCode: 400, authHeader: `Bearer ${accessToken}` },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });

    //PUT /comments/:commentId 400 content exceeds max length
    it("should return 400 if content exceeds 300 characters", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      const response = await commentsTestManager.updateComment(
        created.id,
        { content: "A".repeat(301) },
        { expectedStatusCode: 400, authHeader: `Bearer ${accessToken}` },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "content" }),
      );
    });
  });

  describe("DELETE /comments/:commentId", () => {
    //DELETE /comments/:commentId 204
    it("should delete the comment and return 204 status", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      await commentsTestManager.deleteComment(created.id, {
        expectedStatusCode: 204,
        authHeader: `Bearer ${accessToken}`,
      });

      await commentsTestManager.getCommentById(created.id, {
        expectedStatusCode: 404,
      });
    });

    //DELETE /comments/:commentId 401 no Authorization header
    it("should return 401 status for unauthorized request", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      await commentsTestManager.deleteComment(created.id, {
        expectedStatusCode: 401,
      });

      await commentsTestManager.getCommentById(created.id, {
        expectedStatusCode: 200,
      });
    });

    //DELETE /comments/:commentId 403 not the comment's owner
    it("should return 403 if the authenticated user is not the comment's owner", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin({
        login: "owner2",
        email: "owner2@mail.com",
      });
      const created = await createTestComment(post.id, accessToken);

      const otherUser = await createTestUserAndLogin({
        login: "intruder2",
        email: "intruder2@mail.com",
      });

      await commentsTestManager.deleteComment(created.id, {
        expectedStatusCode: 403,
        authHeader: `Bearer ${otherUser.accessToken}`,
      });

      await commentsTestManager.getCommentById(created.id, {
        expectedStatusCode: 200,
      });
    });

    //DELETE /comments/:commentId 404 well-formed id but no matching comment
    it("should return 404 if no comment exists with the given commentId", async () => {
      const { accessToken } = await createTestUserAndLogin();

      await commentsTestManager.deleteComment("507f1f77bcf86cd799439011", {
        expectedStatusCode: 404,
        authHeader: `Bearer ${accessToken}`,
      });
    });

    //DELETE /comments/:commentId 404 malformed id (not a valid ObjectId)
    it("should return 404 if the commentId is not a valid ObjectId", async () => {
      const { accessToken } = await createTestUserAndLogin();

      await commentsTestManager.deleteComment("invalid-id", {
        expectedStatusCode: 404,
        authHeader: `Bearer ${accessToken}`,
      });
    });

    //DELETE /comments/:commentId 404 on second delete of the same comment
    it("should return 404 when deleting the same comment a second time", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      await commentsTestManager.deleteComment(created.id, {
        expectedStatusCode: 204,
        authHeader: `Bearer ${accessToken}`,
      });

      await commentsTestManager.deleteComment(created.id, {
        expectedStatusCode: 404,
        authHeader: `Bearer ${accessToken}`,
      });
    });
  });

  describe("PUT /comments/:commentId/like-status", () => {
    //PUT /comments/:commentId/like-status 401 no Authorization header
    it("should return 401 if no Authorization header is provided", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      await commentsTestManager.updateLikeStatus(
        created.id,
        { likeStatus: "Like" },
        { expectedStatusCode: 401 },
      );
    });

    //PUT /comments/:commentId/like-status 401 invalid token
    it("should return 401 if the token is invalid", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      await commentsTestManager.updateLikeStatus(
        created.id,
        { likeStatus: "Like" },
        { expectedStatusCode: 401, authHeader: "Bearer invalid.token.value" },
      );
    });

    //PUT /comments/:commentId/like-status 400 likeStatus is missing
    it("should return 400 if likeStatus is missing", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      const response = await commentsTestManager.updateLikeStatus(
        created.id,
        {},
        { expectedStatusCode: 400, authHeader: `Bearer ${accessToken}` },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "likeStatus" }),
      );
    });

    //PUT /comments/:commentId/like-status 400 likeStatus not one of None/Like/Dislike
    it("should return 400 if likeStatus is not one of None, Like, Dislike", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);

      for (const likeStatus of ["like", "Love", "", 1]) {
        const response = await commentsTestManager.updateLikeStatus(
          created.id,
          { likeStatus },
          { expectedStatusCode: 400, authHeader: `Bearer ${accessToken}` },
        );
        expect(response.body.errorsMessages).toContainEqual(
          expect.objectContaining({ field: "likeStatus" }),
        );
      }
    });

    const getLikesInfo = async (commentId: string, accessToken?: string) => {
      const response = await commentsTestManager.getCommentById(commentId, {
        expectedStatusCode: 200,
        authHeader: accessToken ? `Bearer ${accessToken}` : undefined,
      });
      return response.body.likesInfo;
    };

    //PUT /comments/:commentId/like-status 204 Like -> Dislike -> None
    it("should add, switch and remove the user's like status", async () => {
      const post = await createTestPost();
      const { accessToken } = await createTestUserAndLogin();
      const created = await createTestComment(post.id, accessToken);
      const authHeader = `Bearer ${accessToken}`;

      await commentsTestManager.updateLikeStatus(
        created.id,
        { likeStatus: "Like" },
        { expectedStatusCode: 204, authHeader },
      );
      expect(await getLikesInfo(created.id, accessToken)).toEqual({
        likesCount: 1,
        dislikesCount: 0,
        myStatus: "Like",
      });

      // Repeating the same status doesn't count twice
      await commentsTestManager.updateLikeStatus(
        created.id,
        { likeStatus: "Like" },
        { expectedStatusCode: 204, authHeader },
      );
      expect(await getLikesInfo(created.id, accessToken)).toEqual({
        likesCount: 1,
        dislikesCount: 0,
        myStatus: "Like",
      });

      await commentsTestManager.updateLikeStatus(
        created.id,
        { likeStatus: "Dislike" },
        { expectedStatusCode: 204, authHeader },
      );
      expect(await getLikesInfo(created.id, accessToken)).toEqual({
        likesCount: 0,
        dislikesCount: 1,
        myStatus: "Dislike",
      });

      await commentsTestManager.updateLikeStatus(
        created.id,
        { likeStatus: "None" },
        { expectedStatusCode: 204, authHeader },
      );
      expect(await getLikesInfo(created.id, accessToken)).toEqual({
        likesCount: 0,
        dislikesCount: 0,
        myStatus: "None",
      });
    });

    //PUT /comments/:commentId/like-status 204 likes from different users are counted separately
    it("should count each user's status separately and report myStatus per viewer", async () => {
      const post = await createTestPost();
      const first = await createTestUserAndLogin();
      const second = await createTestUserAndLogin({
        login: "commenter2",
        email: "commenter2@mail.com",
      });
      const third = await createTestUserAndLogin({
        login: "commenter3",
        email: "commenter3@mail.com",
      });
      const created = await createTestComment(post.id, first.accessToken);

      await commentsTestManager.updateLikeStatus(
        created.id,
        { likeStatus: "Like" },
        { expectedStatusCode: 204, authHeader: `Bearer ${first.accessToken}` },
      );
      await commentsTestManager.updateLikeStatus(
        created.id,
        { likeStatus: "Like" },
        { expectedStatusCode: 204, authHeader: `Bearer ${second.accessToken}` },
      );
      await commentsTestManager.updateLikeStatus(
        created.id,
        { likeStatus: "Dislike" },
        { expectedStatusCode: 204, authHeader: `Bearer ${third.accessToken}` },
      );

      const counts = { likesCount: 2, dislikesCount: 1 };
      expect(await getLikesInfo(created.id, first.accessToken)).toEqual({
        ...counts,
        myStatus: "Like",
      });
      expect(await getLikesInfo(created.id, third.accessToken)).toEqual({
        ...counts,
        myStatus: "Dislike",
      });
      // Anonymous viewers get the counts with myStatus "None"
      expect(await getLikesInfo(created.id)).toEqual({
        ...counts,
        myStatus: "None",
      });
    });

    //PUT /comments/:commentId/like-status 404 comment does not exist
    it("should return 404 if the comment does not exist", async () => {
      const { accessToken } = await createTestUserAndLogin();

      for (const commentId of ["000000000000000000000000", "not-an-object-id"]) {
        await commentsTestManager.updateLikeStatus(
          commentId,
          { likeStatus: "Like" },
          { expectedStatusCode: 404, authHeader: `Bearer ${accessToken}` },
        );
      }
    });
  });
});
