import request from "supertest";
import { app } from "../src/setting.js";
import { emailAdapter } from "../src/adapters/email-adapter.js";
import { usersTestManager } from "./utils/users-manager.js";
import { authTestManager } from "./utils/auth-manager.js";

//The tests have to be isolated and independent.

describe("Users", () => {
  beforeEach(() => {
    //clear all data before running tests
    return request(app).delete("/testing/all-data");
  });

  describe("GET /users", () => {
    //GET /users 401 no Authorization header
    it("should return 401 status for unauthorized request", async () => {
      await usersTestManager.getUsers({}, { expectedStatusCode: 401 });
    });

    //GET /users 200 empty database
    it("should return 200 with an empty items array and totalCount 0 on a clean DB", async () => {
      const response = await usersTestManager.getUsers(
        {},
        { expectedStatusCode: 200, isAuthorized: true },
      );

      expect(response.body).toEqual({
        pagesCount: 0,
        page: 1,
        pageSize: 10,
        totalCount: 0,
        items: [],
      });
    });

    //GET /users 200 maps Mongo doc to id, no _id field
    it("should return users with an id field and no _id field", async () => {
      await usersTestManager.createUser(
        { login: "john_doe", password: "password1", email: "john@mail.com" },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await usersTestManager.getUsers(
        {},
        { expectedStatusCode: 200, isAuthorized: true },
      );

      expect(response.body.items).toHaveLength(1);
      const item = response.body.items[0];
      expect(item.id).toBeDefined();
      expect(item._id).toBeUndefined();
    });

    //GET /users 200 default pagination when query is omitted
    it("should apply default pagination (pageSize 10, pageNumber 1) when query is omitted", async () => {
      for (let i = 1; i <= 12; i++) {
        await usersTestManager.createUser(
          {
            login: `user${i}`,
            password: "password1",
            email: `user${i}@mail.com`,
          },
          { expectedStatusCode: 201, isAuthorized: true },
        );
      }

      const response = await usersTestManager.getUsers(
        {},
        { expectedStatusCode: 200, isAuthorized: true },
      );

      expect(response.body.pageSize).toBe(10);
      expect(response.body.page).toBe(1);
      expect(response.body.totalCount).toBe(12);
      expect(response.body.pagesCount).toBe(2);
      expect(response.body.items).toHaveLength(10);
    });

    //GET /users 200 searchLoginTerm filters case-insensitively and totalCount reflects the filtered set
    it("should filter items by searchLoginTerm case-insensitively and count only matching users", async () => {
      await usersTestManager.createUser(
        { login: "apple_usr", password: "password1", email: "apple@mail.com" },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      await usersTestManager.createUser(
        {
          login: "banana_usr",
          password: "password1",
          email: "banana@mail.com",
        },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      await usersTestManager.createUser(
        { login: "cherry", password: "password1", email: "cherry@mail.com" },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await usersTestManager.getUsers(
        { searchLoginTerm: "AN" },
        { expectedStatusCode: 200, isAuthorized: true },
      );

      expect(response.body.totalCount).toBe(1);
      expect(response.body.pagesCount).toBe(1);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].login).toBe("banana_usr");
    });

    //GET /users 200 searchEmailTerm filters case-insensitively and totalCount reflects the filtered set
    it("should filter items by searchEmailTerm case-insensitively and count only matching users", async () => {
      await usersTestManager.createUser(
        { login: "user1", password: "password1", email: "apple@mail.com" },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      await usersTestManager.createUser(
        { login: "user2", password: "password1", email: "banana@mail.com" },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      await usersTestManager.createUser(
        { login: "user3", password: "password1", email: "cherry@mail.com" },
        { expectedStatusCode: 201, isAuthorized: true },
      );

      const response = await usersTestManager.getUsers(
        { searchEmailTerm: "AN" },
        { expectedStatusCode: 200, isAuthorized: true },
      );

      expect(response.body.totalCount).toBe(1);
      expect(response.body.pagesCount).toBe(1);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].email).toBe("banana@mail.com");
    });

    //GET /users 200 pageSize/pageNumber slice matches the filtered totalCount, not the whole collection
    it("should paginate correctly against the filtered result set when a search term is applied", async () => {
      for (const login of ["match_one", "match_two", "match3", "other"]) {
        await usersTestManager.createUser(
          { login, password: "password1", email: `${login}@mail.com` },
          { expectedStatusCode: 201, isAuthorized: true },
        );
      }

      const response = await usersTestManager.getUsers(
        { searchLoginTerm: "match", pageSize: 2, pageNumber: 2 },
        { expectedStatusCode: 200, isAuthorized: true },
      );

      expect(response.body.totalCount).toBe(3);
      expect(response.body.pagesCount).toBe(2);
      expect(response.body.items).toHaveLength(1);
    });

    //GET /users 200 sortBy=login sorts alphabetically, since the DB field is userName not login
    it("should sort items alphabetically by login when sortBy=login", async () => {
      for (const login of ["zebra_ser", "apple_ser", "mango_ser"]) {
        await usersTestManager.createUser(
          { login, password: "password1", email: `${login}@mail.com` },
          { expectedStatusCode: 201, isAuthorized: true },
        );
      }

      const response = await usersTestManager.getUsers(
        {
          pageSize: 15,
          pageNumber: 1,
          searchLoginTerm: "seR",
          searchEmailTerm: ".com",
          sortDirection: "asc",
          sortBy: "login",
        },
        { expectedStatusCode: 200, isAuthorized: true },
      );

      expect(response.body.items.map((item: any) => item.login)).toEqual([
        "apple_ser",
        "mango_ser",
        "zebra_ser",
      ]);
    });
  });

  describe("POST /users", () => {
    //POST /users 201 user is confirmed without an email
    it("should create an already confirmed user without sending a confirmation email", async () => {
      vi.mocked(emailAdapter.sendEmail).mockClear();
      const data = {
        login: "john_doe",
        password: "password1",
        email: "john@mail.com",
      };

      await usersTestManager.createUser(data, {
        expectedStatusCode: 201,
        isAuthorized: true,
      });

      expect(emailAdapter.sendEmail).not.toHaveBeenCalled();
      await authTestManager.login(
        { loginOrEmail: data.login, password: data.password },
        { expectedStatusCode: 200 },
      );
    });
  });
});
