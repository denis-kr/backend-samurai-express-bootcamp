import request from "supertest";
import { app } from "../../src/setting.js";

export const commentsTestManager: any = {
  async getCommentById(
    id: string,
    { expectedStatusCode }: { expectedStatusCode: number }
  ) {
    const response = await request(app).get(`/comments/${id}`);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async updateComment(
    commentId: string,
    data: { content?: string },
    {
      expectedStatusCode,
      authHeader,
    }: { expectedStatusCode: number; authHeader?: string }
  ) {
    const requestObject = request(app).put(`/comments/${commentId}`);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    }

    const response = await requestObject.send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async updateLikeStatus(
    commentId: string,
    data: { likeStatus?: unknown },
    {
      expectedStatusCode,
      authHeader,
    }: { expectedStatusCode: number; authHeader?: string }
  ) {
    const requestObject = request(app).put(`/comments/${commentId}/like-status`);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    }

    const response = await requestObject.send(data);

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
  async deleteComment(
    commentId: string,
    {
      expectedStatusCode,
      authHeader,
    }: { expectedStatusCode: number; authHeader?: string }
  ) {
    const requestObject = request(app).delete(`/comments/${commentId}`);

    if (authHeader) {
      requestObject.set("Authorization", authHeader);
    }

    const response = await requestObject;

    expect(response.statusCode).toBe(expectedStatusCode);

    return response;
  },
};
