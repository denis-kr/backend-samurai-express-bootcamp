import request from "supertest";
import { app } from "../src/setting.js";
import { authTestManager } from "./utils/auth-manager.js";
import { usersTestManager } from "./utils/users-manager.js";
import { emailAdapter } from "../src/adapters/email-adapter.js";

//The tests have to be isolated and independent.

describe("Auth", () => {
  beforeEach(async () => {
    //clear all data before running tests
    await request(app).delete("/testing/all-data");
    // emailAdapter is mocked in setup.ts; reset recorded calls so each test only sees its own sends
    vi.mocked(emailAdapter.sendEmail).mockClear();
  });

  const createTestUser = async (
    overrides: { login?: string; password?: string; email?: string } = {},
  ) => {
    const data = {
      login: overrides.login ?? "john_doe",
      password: overrides.password ?? "password1",
      email: overrides.email ?? "john@mail.com",
    };
    await usersTestManager.createUser(data, {
      expectedStatusCode: 201,
      isAuthorized: true,
    });
    return data;
  };

  describe("POST /auth/login", () => {
    //POST /auth/login 200 with login
    it("should return 200 and an accessToken when logging in with a valid login and password", async () => {
      const user = await createTestUser();

      await authTestManager.login(
        { loginOrEmail: user.login, password: user.password },
        { expectedStatusCode: 200 },
      );
    });

    //POST /auth/login 200 with email
    it("should return 200 and an accessToken when logging in with a valid email and password", async () => {
      const user = await createTestUser();

      await authTestManager.login(
        { loginOrEmail: user.email, password: user.password },
        { expectedStatusCode: 200 },
      );
    });

    //POST /auth/login 401 wrong password
    it("should return 401 if the password is incorrect", async () => {
      const user = await createTestUser();

      await authTestManager.login(
        { loginOrEmail: user.login, password: "wrongpassword" },
        { expectedStatusCode: 401 },
      );
    });

    //POST /auth/login 401 unknown loginOrEmail
    it("should return 401 if loginOrEmail does not match any user", async () => {
      await authTestManager.login(
        { loginOrEmail: "nobody", password: "password1" },
        { expectedStatusCode: 401 },
      );
    });

    //POST /auth/login 400 password is missing
    it("should return 400 if password is missing", async () => {
      const user = await createTestUser();

      const response = await authTestManager.login(
        { loginOrEmail: user.login },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "password" }),
      );
    });

    //POST /auth/login 400 password is an empty string
    it("should return 400 if password is an empty string", async () => {
      const user = await createTestUser();

      const response = await authTestManager.login(
        { loginOrEmail: user.login, password: "" },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "password" }),
      );
    });

    //POST /auth/login 400 loginOrEmail is missing
    it("should return 400 if loginOrEmail is missing", async () => {
      const response = await authTestManager.login(
        { password: "password1" },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "loginOrEmail" }),
      );
    });

    //POST /auth/login 400 loginOrEmail is an empty string
    it("should return 400 if loginOrEmail is an empty string", async () => {
      const response = await authTestManager.login(
        { loginOrEmail: "", password: "password1" },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "loginOrEmail" }),
      );
    });
  });

  describe("GET /auth/me", () => {
    const loginTestUser = async () => {
      const user = await createTestUser();
      const loginResponse = await authTestManager.login(
        { loginOrEmail: user.login, password: user.password },
        { expectedStatusCode: 200 },
      );
      return { user, accessToken: loginResponse.body.accessToken };
    };

    //GET /auth/me 200
    it("should return the current user's email, login and userId for a valid token", async () => {
      const { user, accessToken } = await loginTestUser();

      const response = await authTestManager.me({
        expectedStatusCode: 200,
        authHeader: `Bearer ${accessToken}`,
      });

      expect(response.body.email).toBe(user.email);
      expect(response.body.login).toBe(user.login);
      expect(response.body.userId).toBeDefined();
    });

    //GET /auth/me 401 no Authorization header
    it("should return 401 if no Authorization header is provided", async () => {
      await authTestManager.me({ expectedStatusCode: 401 });
    });

    //GET /auth/me 401 Authorization header has no token
    it("should return 401 if the Authorization header has no token", async () => {
      await authTestManager.me({
        expectedStatusCode: 401,
        authHeader: "Bearer",
      });
    });

    //GET /auth/me 401 invalid token
    it("should return 401 if the token is invalid", async () => {
      await authTestManager.me({
        expectedStatusCode: 401,
        authHeader: "Bearer invalid.token.value",
      });
    });

    //GET /auth/me 401 user referenced by the token has been deleted
    it("should return 401 if the user referenced by the token has been deleted", async () => {
      const created = await usersTestManager.createUser(
        { login: "to_delete", password: "password1", email: "to_delete@mail.com" },
        { expectedStatusCode: 201, isAuthorized: true },
      );
      const loginResponse = await authTestManager.login(
        { loginOrEmail: "to_delete", password: "password1" },
        { expectedStatusCode: 200 },
      );

      await request(app)
        .delete(`/users/${created.body.id}`)
        .set("Authorization", "Basic YWRtaW46cXdlcnR5");

      await authTestManager.me({
        expectedStatusCode: 401,
        authHeader: `Bearer ${loginResponse.body.accessToken}`,
      });
    });
  });

  const sendEmailMock = () => vi.mocked(emailAdapter.sendEmail);

  const extractCode = (message: string) => {
    const code = message.match(/code=([^"&]+)/)?.[1];
    expect(code).toBeDefined();
    return code!;
  };

  const registerTestUser = async (
    overrides: { login?: string; password?: string; email?: string } = {},
  ) => {
    const data = {
      login: overrides.login ?? "jane_doe",
      password: overrides.password ?? "password1",
      email: overrides.email ?? "jane@mail.com",
    };
    await authTestManager.registration(data, { expectedStatusCode: 204 });
    const code = extractCode(sendEmailMock().mock.lastCall![2]);
    return { ...data, code };
  };

  const getUsersCount = async () => {
    const response = await usersTestManager.getUsers(
      {},
      { expectedStatusCode: 200, isAuthorized: true },
    );
    return response.body.totalCount;
  };

  describe("POST /auth/registration", () => {
    const validUser = {
      login: "jane_doe",
      password: "password1",
      email: "jane@mail.com",
    };

    const expectFieldError = async (
      data: Record<string, unknown>,
      field: string,
    ) => {
      const response = await authTestManager.registration(data, {
        expectedStatusCode: 400,
      });
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field }),
      );
      expect(sendEmailMock()).not.toHaveBeenCalled();
      return response;
    };

    //POST /auth/registration 204
    it("should return 204, create an unconfirmed user and send a confirmation email", async () => {
      await authTestManager.registration(validUser, { expectedStatusCode: 204 });

      expect(sendEmailMock()).toHaveBeenCalledTimes(1);
      const [to, subject, message] = sendEmailMock().mock.lastCall!;
      expect(to).toBe(validUser.email);
      expect(subject).toBe("Email confirmation");
      extractCode(message);

      const users = await usersTestManager.getUsers(
        {},
        { expectedStatusCode: 200, isAuthorized: true },
      );
      expect(users.body.totalCount).toBe(1);
      expect(users.body.items[0].login).toBe(validUser.login);
      expect(users.body.items[0].email).toBe(validUser.email);

      // not confirmed yet, so login must fail
      await authTestManager.login(
        { loginOrEmail: validUser.login, password: validUser.password },
        { expectedStatusCode: 401 },
      );
    });

    //POST /auth/registration 400 email sending fails
    it("should return 400 and not keep the user if sending the confirmation email fails", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      sendEmailMock().mockRejectedValueOnce(new Error("SMTP down"));

      await authTestManager.registration(validUser, { expectedStatusCode: 400 });

      expect(await getUsersCount()).toBe(0);
      consoleSpy.mockRestore();
    });

    //POST /auth/registration 400 login is missing
    it("should return 400 if login is missing", async () => {
      await expectFieldError({ ...validUser, login: undefined }, "login");
      expect(await getUsersCount()).toBe(0);
    });

    //POST /auth/registration 400 login is an empty string
    it("should return 400 if login is an empty string", async () => {
      await expectFieldError({ ...validUser, login: "" }, "login");
    });

    //POST /auth/registration 400 login is not a string
    it("should return 400 if login is not a string", async () => {
      await expectFieldError({ ...validUser, login: 12345 }, "login");
    });

    //POST /auth/registration 400 login shorter than 3
    it("should return 400 if login is shorter than 3 characters", async () => {
      await expectFieldError({ ...validUser, login: "ab" }, "login");
    });

    //POST /auth/registration 400 login longer than 10
    it("should return 400 if login is longer than 10 characters", async () => {
      await expectFieldError({ ...validUser, login: "a".repeat(11) }, "login");
    });

    //POST /auth/registration 204 login at min/max length boundaries
    it("should return 204 if login is exactly 3 or exactly 10 characters", async () => {
      await authTestManager.registration(
        { ...validUser, login: "abc", email: "min@mail.com" },
        { expectedStatusCode: 204 },
      );
      await authTestManager.registration(
        { ...validUser, login: "a".repeat(10), email: "max@mail.com" },
        { expectedStatusCode: 204 },
      );
    });

    //POST /auth/registration 400 login has forbidden characters
    it("should return 400 if login contains characters other than letters, numbers, _ and -", async () => {
      await expectFieldError({ ...validUser, login: "jane doe!" }, "login");
    });

    //POST /auth/registration 400 login already taken
    it("should return 400 if login is already taken", async () => {
      await registerTestUser({ login: "taken", email: "first@mail.com" });
      sendEmailMock().mockClear();

      await expectFieldError(
        { ...validUser, login: "taken", email: "second@mail.com" },
        "login",
      );
      expect(await getUsersCount()).toBe(1);
    });

    //POST /auth/registration 400 password is missing
    it("should return 400 if password is missing", async () => {
      await expectFieldError({ ...validUser, password: undefined }, "password");
    });

    //POST /auth/registration 400 password is not a string
    it("should return 400 if password is not a string", async () => {
      await expectFieldError({ ...validUser, password: 123456 }, "password");
    });

    //POST /auth/registration 400 password shorter than 6
    it("should return 400 if password is shorter than 6 characters", async () => {
      await expectFieldError({ ...validUser, password: "12345" }, "password");
    });

    //POST /auth/registration 400 password longer than 20
    it("should return 400 if password is longer than 20 characters", async () => {
      await expectFieldError(
        { ...validUser, password: "a".repeat(21) },
        "password",
      );
    });

    //POST /auth/registration 204 password at min/max length boundaries
    it("should return 204 if password is exactly 6 or exactly 20 characters", async () => {
      await authTestManager.registration(
        { login: "pw_min", password: "a".repeat(6), email: "min@mail.com" },
        { expectedStatusCode: 204 },
      );
      await authTestManager.registration(
        { login: "pw_max", password: "a".repeat(20), email: "max@mail.com" },
        { expectedStatusCode: 204 },
      );
    });

    //POST /auth/registration 400 email is missing
    it("should return 400 if email is missing", async () => {
      await expectFieldError({ ...validUser, email: undefined }, "email");
    });

    //POST /auth/registration 400 email is not a string
    it("should return 400 if email is not a string", async () => {
      await expectFieldError({ ...validUser, email: 42 }, "email");
    });

    //POST /auth/registration 400 email has invalid format
    it("should return 400 if email has an invalid format", async () => {
      await expectFieldError({ ...validUser, email: "not-an-email" }, "email");
    });

    //POST /auth/registration 400 email already taken
    it("should return 400 if email is already taken", async () => {
      await registerTestUser({ login: "first", email: "taken@mail.com" });
      sendEmailMock().mockClear();

      await expectFieldError(
        { ...validUser, login: "second", email: "taken@mail.com" },
        "email",
      );
      expect(await getUsersCount()).toBe(1);
    });

    //POST /auth/registration 400 multiple invalid fields
    it("should return 400 listing every invalid field", async () => {
      const response = await authTestManager.registration(
        { login: "a", password: "1", email: "bad" },
        { expectedStatusCode: 400 },
      );
      const fields = response.body.errorsMessages.map(
        (e: { field: string }) => e.field,
      );
      expect(fields).toEqual(
        expect.arrayContaining(["login", "password", "email"]),
      );
      expect(sendEmailMock()).not.toHaveBeenCalled();
    });
  });

  describe("POST /auth/registration-confirmation", () => {
    //POST /auth/registration-confirmation 204
    it("should return 204 for a valid code and allow the user to log in afterwards", async () => {
      const user = await registerTestUser();

      await authTestManager.confirmRegistration(
        { code: user.code },
        { expectedStatusCode: 204 },
      );

      await authTestManager.login(
        { loginOrEmail: user.login, password: user.password },
        { expectedStatusCode: 200 },
      );
    });

    //POST /auth/registration-confirmation 400 code already used
    it("should return 400 if the code has already been used", async () => {
      const user = await registerTestUser();
      await authTestManager.confirmRegistration(
        { code: user.code },
        { expectedStatusCode: 204 },
      );

      await authTestManager.confirmRegistration(
        { code: user.code },
        { expectedStatusCode: 400 },
      );
    });

    //POST /auth/registration-confirmation 400 unknown code
    it("should return 400 if the code does not match any user", async () => {
      const user = await registerTestUser();

      await authTestManager.confirmRegistration(
        { code: crypto.randomUUID() },
        { expectedStatusCode: 400 },
      );

      // the real user stays unconfirmed
      await authTestManager.login(
        { loginOrEmail: user.login, password: user.password },
        { expectedStatusCode: 401 },
      );
    });

    //POST /auth/registration-confirmation 400 code is missing
    it("should return 400 if code is missing", async () => {
      const response = await authTestManager.confirmRegistration(
        {},
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "code" }),
      );
    });

    //POST /auth/registration-confirmation 400 code is an empty string
    it("should return 400 if code is an empty string", async () => {
      const response = await authTestManager.confirmRegistration(
        { code: "" },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "code" }),
      );
    });

    //POST /auth/registration-confirmation 400 code is not a string
    it("should return 400 if code is not a string", async () => {
      const response = await authTestManager.confirmRegistration(
        { code: 12345 },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "code" }),
      );
    });
  });

  describe("POST /auth/registration-email-resending", () => {
    //POST /auth/registration-email-resending 204
    it("should return 204 and resend a working confirmation code to the user's email", async () => {
      const user = await registerTestUser();
      sendEmailMock().mockClear();

      await authTestManager.resendRegistrationEmail(
        { email: user.email },
        { expectedStatusCode: 204 },
      );

      expect(sendEmailMock()).toHaveBeenCalledTimes(1);
      const [to, subject, message] = sendEmailMock().mock.lastCall!;
      expect(to).toBe(user.email);
      expect(subject).toBe("Email confirmation");
      const resentCode = extractCode(message);

      await authTestManager.confirmRegistration(
        { code: resentCode },
        { expectedStatusCode: 204 },
      );
      await authTestManager.login(
        { loginOrEmail: user.login, password: user.password },
        { expectedStatusCode: 200 },
      );
    });

    //POST /auth/registration-email-resending 400 email sending fails
    it("should return 400 if sending the email fails", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const user = await registerTestUser();
      sendEmailMock().mockRejectedValueOnce(new Error("SMTP down"));

      await authTestManager.resendRegistrationEmail(
        { email: user.email },
        { expectedStatusCode: 400 },
      );
      consoleSpy.mockRestore();
    });

    //POST /auth/registration-email-resending 400 email already confirmed
    it("should return 400 if the email is already confirmed", async () => {
      const user = await registerTestUser();
      await authTestManager.confirmRegistration(
        { code: user.code },
        { expectedStatusCode: 204 },
      );
      sendEmailMock().mockClear();

      const response = await authTestManager.resendRegistrationEmail(
        { email: user.email },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "email" }),
      );
      expect(sendEmailMock()).not.toHaveBeenCalled();
    });

    //POST /auth/registration-email-resending 400 email not registered
    it("should return 400 if no user is registered with the email", async () => {
      const response = await authTestManager.resendRegistrationEmail(
        { email: "nobody@mail.com" },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "email" }),
      );
      expect(sendEmailMock()).not.toHaveBeenCalled();
    });

    //POST /auth/registration-email-resending 400 email is missing
    it("should return 400 if email is missing", async () => {
      const response = await authTestManager.resendRegistrationEmail(
        {},
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "email" }),
      );
    });

    //POST /auth/registration-email-resending 400 email is not a string
    it("should return 400 if email is not a string", async () => {
      const response = await authTestManager.resendRegistrationEmail(
        { email: 42 },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "email" }),
      );
    });

    //POST /auth/registration-email-resending 400 email has invalid format
    it("should return 400 if email has an invalid format", async () => {
      const response = await authTestManager.resendRegistrationEmail(
        { email: "not-an-email" },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "email" }),
      );
    });
  });
});
