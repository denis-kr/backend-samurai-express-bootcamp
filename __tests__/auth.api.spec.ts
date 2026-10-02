import request from "supertest";
import { app } from "../src/setting.js";
import { authTestManager } from "./utils/auth-manager.js";
import { usersTestManager } from "./utils/users-manager.js";
import { emailAdapter } from "../src/adapters/email-adapter.js";
import { enableRateLimit } from "./utils/rate-limit-control.js";

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

  // Access tokens live 10s and refresh tokens 20s; only Date is faked so the
  // Mongo driver's real timers keep working while jwt.verify sees a later clock.
  const advanceClockBySeconds = (seconds: number) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + seconds * 1000);
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  const loginAndGetTokens = async () => {
    const user = await createTestUser();
    const loginResponse = await authTestManager.login(
      { loginOrEmail: user.login, password: user.password },
      { expectedStatusCode: 200 },
    );
    return {
      user,
      accessToken: loginResponse.body.accessToken as string,
      refreshToken: authTestManager.getRefreshToken(loginResponse) as string,
    };
  };

  describe("POST /auth/login", () => {
    //POST /auth/login 200 sets refreshToken cookie
    it("should set an httpOnly, secure refreshToken cookie on successful login", async () => {
      const user = await createTestUser();

      const response = await authTestManager.login(
        { loginOrEmail: user.login, password: user.password },
        { expectedStatusCode: 200 },
      );

      const cookie = authTestManager.getRefreshTokenCookie(response);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(authTestManager.getRefreshToken(response)).not.toBe(
        response.body.accessToken,
      );
    });

    //POST /auth/login 401 no refreshToken cookie on failed login
    it("should not set a refreshToken cookie if login fails", async () => {
      const user = await createTestUser();

      const response = await authTestManager.login(
        { loginOrEmail: user.login, password: "wrongpassword" },
        { expectedStatusCode: 401 },
      );

      expect(authTestManager.getRefreshTokenCookie(response)).toBeUndefined();
    });

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

    //GET /auth/me 401 access token expired
    it("should return 401 if the access token has expired (after 10s)", async () => {
      const { accessToken } = await loginTestUser();

      advanceClockBySeconds(11);

      await authTestManager.me({
        expectedStatusCode: 401,
        authHeader: `Bearer ${accessToken}`,
      });
    });

    //GET /auth/me 401 refresh token used as access token
    it("should return 401 if a refresh token is sent as the Bearer token", async () => {
      const { refreshToken } = await loginAndGetTokens();

      await authTestManager.me({
        expectedStatusCode: 401,
        authHeader: `Bearer ${refreshToken}`,
      });
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

  describe("POST /auth/refresh-token", () => {
    //POST /auth/refresh-token 200
    it("should return 200 with a new working accessToken and a new httpOnly, secure refreshToken cookie", async () => {
      const { user, refreshToken } = await loginAndGetTokens();

      const response = await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken,
      });

      const newRefreshToken = authTestManager.getRefreshToken(response);
      expect(newRefreshToken).not.toBe(refreshToken);
      const cookie = authTestManager.getRefreshTokenCookie(response);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);

      const me = await authTestManager.me({
        expectedStatusCode: 200,
        authHeader: `Bearer ${response.body.accessToken}`,
      });
      expect(me.body.login).toBe(user.login);
    });

    //POST /auth/refresh-token 200 the rotated refresh token is itself usable
    it("should accept the newly issued refresh token on the next refresh", async () => {
      const { refreshToken } = await loginAndGetTokens();

      const first = await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken,
      });

      await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken: authTestManager.getRefreshToken(first),
      });
    });

    //POST /auth/refresh-token 401 old refresh token reused after rotation
    it("should return 401 if a refresh token that was already used is sent again", async () => {
      const { refreshToken } = await loginAndGetTokens();

      await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken,
      });

      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken,
      });
    });

    //POST /auth/refresh-token 200/401 concurrent use of the same token
    it("should let only one of two concurrent requests with the same refresh token succeed", async () => {
      const { refreshToken } = await loginAndGetTokens();

      const send = () =>
        request(app)
          .post("/auth/refresh-token")
          .set("Cookie", `refreshToken=${refreshToken}`);
      const statuses = (await Promise.all([send(), send()]))
        .map((r) => r.statusCode)
        .sort();

      expect(statuses).toEqual([200, 401]);
    });

    //POST /auth/refresh-token 401 no cookie
    it("should return 401 if no refreshToken cookie is sent", async () => {
      await authTestManager.refreshToken({ expectedStatusCode: 401 });
    });

    //POST /auth/refresh-token 401 empty cookie
    it("should return 401 if the refreshToken cookie is empty", async () => {
      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken: "",
      });
    });

    //POST /auth/refresh-token 401 malformed token
    it("should return 401 if the refresh token is not a valid JWT", async () => {
      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken: "invalid.token.value",
      });
    });

    //POST /auth/refresh-token 401 access token sent as refresh token
    it("should return 401 if an access token is sent as the refresh token", async () => {
      const { accessToken } = await loginAndGetTokens();

      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken: accessToken,
      });
    });

    //POST /auth/refresh-token 401 refresh token expired
    it("should return 401 if the refresh token has expired (after 20s)", async () => {
      const { refreshToken } = await loginAndGetTokens();

      advanceClockBySeconds(21);

      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken,
      });
    });

    //POST /auth/refresh-token 401 after logout
    it("should return 401 if the refresh token was revoked by logout", async () => {
      const { refreshToken } = await loginAndGetTokens();

      await authTestManager.logout({ expectedStatusCode: 204, refreshToken });

      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken,
      });
    });

    //POST /auth/refresh-token 401 user deleted
    it("should return 401 if the user referenced by the refresh token has been deleted", async () => {
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

      await authTestManager.refreshToken({
        expectedStatusCode: 401,
        refreshToken: authTestManager.getRefreshToken(loginResponse),
      });
    });

    //POST /auth/refresh-token 200 sessions are independent
    it("should not revoke a refresh token from another login when one is rotated", async () => {
      const { user, refreshToken: firstSession } = await loginAndGetTokens();
      const secondLogin = await authTestManager.login(
        { loginOrEmail: user.login, password: user.password },
        { expectedStatusCode: 200 },
      );

      await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken: firstSession,
      });

      await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken: authTestManager.getRefreshToken(secondLogin),
      });
    });
  });

  describe("POST /auth/logout", () => {
    //POST /auth/logout 204
    it("should return 204 and clear the refreshToken cookie", async () => {
      const { refreshToken } = await loginAndGetTokens();

      const response = await authTestManager.logout({
        expectedStatusCode: 204,
        refreshToken,
      });

      const cookie = authTestManager.getRefreshTokenCookie(response);
      expect(cookie).toBeDefined();
      expect(authTestManager.getRefreshToken(response)).toBeUndefined();
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    //POST /auth/logout 401 logging out twice with the same token
    it("should return 401 when logging out a second time with the same refresh token", async () => {
      const { refreshToken } = await loginAndGetTokens();

      await authTestManager.logout({ expectedStatusCode: 204, refreshToken });

      await authTestManager.logout({ expectedStatusCode: 401, refreshToken });
    });

    //POST /auth/logout 401 refresh token already rotated
    it("should return 401 if the refresh token was already used for a refresh", async () => {
      const { refreshToken } = await loginAndGetTokens();

      await authTestManager.refreshToken({
        expectedStatusCode: 200,
        refreshToken,
      });

      await authTestManager.logout({ expectedStatusCode: 401, refreshToken });
    });

    //POST /auth/logout 401 no cookie
    it("should return 401 if no refreshToken cookie is sent", async () => {
      await authTestManager.logout({ expectedStatusCode: 401 });
    });

    //POST /auth/logout 401 malformed token
    it("should return 401 if the refresh token is not a valid JWT", async () => {
      await authTestManager.logout({
        expectedStatusCode: 401,
        refreshToken: "invalid.token.value",
      });
    });

    //POST /auth/logout 401 access token sent as refresh token
    it("should return 401 if an access token is sent as the refresh token", async () => {
      const { accessToken } = await loginAndGetTokens();

      await authTestManager.logout({
        expectedStatusCode: 401,
        refreshToken: accessToken,
      });
    });

    //POST /auth/logout 401 refresh token expired
    it("should return 401 if the refresh token has expired (after 20s)", async () => {
      const { refreshToken } = await loginAndGetTokens();

      advanceClockBySeconds(21);

      await authTestManager.logout({ expectedStatusCode: 401, refreshToken });
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

  const extractRecoveryCode = (message: string) => {
    const code = message.match(/recoveryCode=([^"&]+)/)?.[1];
    expect(code).toBeDefined();
    return code!;
  };

  const requestRecoveryCode = async (email: string) => {
    await authTestManager.passwordRecovery(
      { email },
      { expectedStatusCode: 204 },
    );
    return extractRecoveryCode(sendEmailMock().mock.lastCall![2]);
  };

  describe("POST /auth/password-recovery", () => {
    //POST /auth/password-recovery 204
    it("should return 204 and send a recovery email to a registered user", async () => {
      const user = await createTestUser();
      sendEmailMock().mockClear();

      await authTestManager.passwordRecovery(
        { email: user.email },
        { expectedStatusCode: 204 },
      );

      expect(sendEmailMock()).toHaveBeenCalledTimes(1);
      const [to, subject, message] = sendEmailMock().mock.lastCall!;
      expect(to).toBe(user.email);
      expect(subject).toBe("Password recovery");
      extractRecoveryCode(message);
    });

    //POST /auth/password-recovery 204 unknown email
    it("should return 204 and still send an email if no user has this email", async () => {
      await authTestManager.passwordRecovery(
        { email: "nobody@mail.com" },
        { expectedStatusCode: 204 },
      );

      expect(sendEmailMock()).toHaveBeenCalledTimes(1);
      expect(sendEmailMock().mock.lastCall![0]).toBe("nobody@mail.com");
    });

    //POST /auth/password-recovery 204 email sending fails
    it("should return 204 even if sending the email fails", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      sendEmailMock().mockRejectedValueOnce(new Error("SMTP down"));

      await authTestManager.passwordRecovery(
        { email: "nobody@mail.com" },
        { expectedStatusCode: 204 },
      );
      consoleSpy.mockRestore();
    });

    //POST /auth/password-recovery 400 invalid email
    it("should return 400 if email is missing, not a string or has an invalid format", async () => {
      for (const data of [{}, { email: 42 }, { email: "not-an-email" }]) {
        const response = await authTestManager.passwordRecovery(data, {
          expectedStatusCode: 400,
        });
        expect(response.body.errorsMessages).toContainEqual(
          expect.objectContaining({ field: "email" }),
        );
      }
      expect(sendEmailMock()).not.toHaveBeenCalled();
    });
  });

  describe("POST /auth/new-password", () => {
    //POST /auth/new-password 204
    it("should return 204 and let the user log in with the new password only", async () => {
      const user = await createTestUser();
      const recoveryCode = await requestRecoveryCode(user.email);

      await authTestManager.newPassword(
        { newPassword: "newPassword1", recoveryCode },
        { expectedStatusCode: 204 },
      );

      await authTestManager.login(
        { loginOrEmail: user.login, password: "newPassword1" },
        { expectedStatusCode: 200 },
      );
      await authTestManager.login(
        { loginOrEmail: user.login, password: user.password },
        { expectedStatusCode: 401 },
      );
    });

    //POST /auth/new-password 400 code reused
    it("should return 400 if the recovery code was already used", async () => {
      const user = await createTestUser();
      const recoveryCode = await requestRecoveryCode(user.email);

      await authTestManager.newPassword(
        { newPassword: "newPassword1", recoveryCode },
        { expectedStatusCode: 204 },
      );
      const response = await authTestManager.newPassword(
        { newPassword: "newPassword2", recoveryCode },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "recoveryCode" }),
      );
    });

    //POST /auth/new-password 400 code replaced by a newer one
    it("should return 400 for an older recovery code after a new one was requested", async () => {
      const user = await createTestUser();
      const oldCode = await requestRecoveryCode(user.email);
      await requestRecoveryCode(user.email);

      await authTestManager.newPassword(
        { newPassword: "newPassword1", recoveryCode: oldCode },
        { expectedStatusCode: 400 },
      );
    });

    //POST /auth/new-password 400 code from an unknown email
    it("should return 400 for a code sent to an email with no user", async () => {
      const recoveryCode = await requestRecoveryCode("nobody@mail.com");

      await authTestManager.newPassword(
        { newPassword: "newPassword1", recoveryCode },
        { expectedStatusCode: 400 },
      );
    });

    //POST /auth/new-password 400 code expired
    it("should return 400 if the recovery code has expired (after 1h)", async () => {
      const user = await createTestUser();
      const recoveryCode = await requestRecoveryCode(user.email);

      advanceClockBySeconds(60 * 60 + 1);

      await authTestManager.newPassword(
        { newPassword: "newPassword1", recoveryCode },
        { expectedStatusCode: 400 },
      );
    });

    //POST /auth/new-password 400 invalid newPassword
    it("should return 400 if newPassword is missing, too short or too long", async () => {
      for (const newPassword of [undefined, "12345", "a".repeat(21)]) {
        const response = await authTestManager.newPassword(
          { newPassword, recoveryCode: "some-code" },
          { expectedStatusCode: 400 },
        );
        expect(response.body.errorsMessages).toContainEqual(
          expect.objectContaining({ field: "newPassword" }),
        );
      }
    });

    //POST /auth/new-password 400 recoveryCode missing
    it("should return 400 if recoveryCode is missing", async () => {
      const response = await authTestManager.newPassword(
        { newPassword: "newPassword1" },
        { expectedStatusCode: 400 },
      );
      expect(response.body.errorsMessages).toContainEqual(
        expect.objectContaining({ field: "recoveryCode" }),
      );
    });
  });

  // Each limited route allows 5 requests per IP per 10s; the 6th is rejected
  // before validation runs, so an empty body is enough to count as a hit.
  describe("Rate limiting", () => {
    const limitedRoutes = [
      "/auth/login",
      "/auth/registration",
      "/auth/registration-confirmation",
      "/auth/registration-email-resending",
      "/auth/password-recovery",
      "/auth/new-password",
    ];

    const hit = (path: string, data: object = {}) =>
      request(app).post(path).send(data);

    const hitTimes = async (path: string, times: number) => {
      for (let i = 0; i < times; i++) {
        const response = await hit(path);
        expect(response.statusCode).not.toBe(429);
      }
    };

    beforeEach(() => {
      enableRateLimit();
    });

    describe.each(limitedRoutes)("POST %s", (path) => {
      //POST 429 6th request within 10s
      it("should return 429 for the 6th request within 10 seconds", async () => {
        await hitTimes(path, 5);

        const response = await hit(path);
        expect(response.statusCode).toBe(429);
      });

      //POST 429 -> allowed again after the window
      it("should accept requests again once the 10 second window has passed", async () => {
        await hitTimes(path, 5);
        await hit(path).expect(429);

        advanceClockBySeconds(11);

        const response = await hit(path);
        expect(response.statusCode).not.toBe(429);
      });
    });

    //POST /auth/login 429 even with valid credentials
    it("should return 429 for valid credentials once the login limit is reached", async () => {
      const user = await createTestUser();
      await hitTimes("/auth/login", 5);

      await authTestManager.login(
        { loginOrEmail: user.login, password: user.password },
        { expectedStatusCode: 429 },
      );
    });

    //POST /auth/password-recovery 429 sends no email
    it("should not send a recovery email when the request is rate limited", async () => {
      await hitTimes("/auth/password-recovery", 5);
      sendEmailMock().mockClear();

      await authTestManager.passwordRecovery(
        { email: "john@mail.com" },
        { expectedStatusCode: 429 },
      );
      expect(sendEmailMock()).not.toHaveBeenCalled();
    });

    //limits are counted per route
    it("should count requests separately for each route", async () => {
      await hitTimes("/auth/login", 5);
      await hit("/auth/login").expect(429);

      const response = await hit("/auth/registration");
      expect(response.statusCode).not.toBe(429);
    });

    //POST /auth/refresh-token is not limited
    it("should not rate limit /auth/refresh-token", async () => {
      for (let i = 0; i < 6; i++) {
        await authTestManager.refreshToken({ expectedStatusCode: 401 });
      }
    });
  });
});
