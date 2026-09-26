# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

REST API built for the "Backend Samurai" course. Express 5 + TypeScript (ESM/NodeNext) + Mongoose.

## Commands

- Install deps: `pnpm install` (pnpm is the package manager; `pnpm-lock.yaml` is committed)
- Run tests: `pnpm test` (vitest, watch mode by default — matches `**/*.spec.ts`); one-shot: `pnpm test run`; coverage: `pnpm test:cov`
- Run a single test file: `pnpm test __tests__/blogs.api.spec.ts`
- Dev server: `pnpm dev` — runs `tsc --watch` and `node --inspect=9229 --watch-path=./dist dist/src/index.js` concurrently. There is no separate one-shot `build` script; compiled output goes to `./dist` via the watching `tsc`.
- MongoDB must be reachable at `MONGO_URI` for both the app and the tests, since tests hit a real API + real DB (no DB mocking). `docker-compose.yml` spins up a local `mongo` service and the app together.

There is no lint/format tooling configured (see `TODO.txt` — ESLint setup was deliberately deferred).

## Environment

- `PORT` (default 3000)
- `MONGO_URI` (default `mongodb://localhost:27017`); the database name is pinned to `samurai` in `src/repositories/db.ts`, not taken from the URI
- `JWT_SECRET` (falls back to an insecure default in `jwt-service.ts`)
- `EMAIL` / `EMAIL_PASSWORD` for nodemailer (gmail) — transport auth is still a TODO in `email-adapter.ts`

## Architecture

Layered structure, one directory per concern, wired together per-entity (blogs, posts, users, comments):

```
routes/               Express routers — validation middleware chain, then handler calls into domain layer, then shapes the HTTP response (Mongo _id -> id)
domain/               *-service.ts — business logic, orchestrates one or more repositories
repositories/         *-repo.ts — Mongoose queries (usually `.lean()`)
repositories/models/  Mongoose schemas + document types (`Blog`, `Post`, `User`, `Comment`)
application/          jwt-service (sign/verify, 1h expiry)
adapters/             email-adapter — the only place that talks to nodemailer
manager/              email-manager — builds confirmation emails and calls the adapter
middleware/           auth/ (basic + JWT) and validation/ (express-validator chains, per-entity + a shared "universal" set for pagination/id checks)
types/index.d.ts      augments Express `Request` with `userId`
```

- `src/repositories/db.ts`: `runDb()` / `stopDb()` wrap `mongoose.connect` / `disconnect` (Stable API v1). Repositories validate ids with `Types.ObjectId.isValid` and return `null`/`false` for invalid ids instead of throwing.
- `src/setting.ts` builds and exports the Express `app` (routers mounted, JSON body parsing) separately from `src/index.ts` (which calls `runDb()` then starts listening). Tests import `app` directly and drive it with `supertest` — they don't start the HTTP listener.
- Request handler generics (`RequestWithBody<T>`, `RequestWithQuery<T>`, `RequestWithParams<T>`, `RequestWithParamsAndBody<T,B>`, `RequestWithParamsAndQuery<T,Q>` in `src/utils/types.ts`) are the standard way to type Express `req` across routers — use these instead of typing `Request` generics inline.
- Two auth schemes; router ordering matters (public GETs declared first, then `router.use(<auth middleware>)` gates everything below):
  - Basic auth (`basicAuthMiddleware`, hardcoded `admin:qwerty`): blog/post writes and all of `/users`.
  - JWT Bearer (`authMiddleware`, sets `req.userId`): `/comments` writes, creating comments under posts, `/auth/me`. Comment ownership is checked against `comment.commentatorInfo.userId`.
- Routers are mounted under their prefix in `setting.ts`, so paths inside a router must not repeat it (e.g. `"/login"` in `auth-router.ts`, not `"/auth/login"`). The comments router file is named `coments-router.ts` (typo).
- Users: the API field `login` is stored as `userName` in Mongo — map it in responses, and use `sortFieldMap` in `users-repo.ts` for `sortBy`.
- Registration stores `emailConfirmation { confirmationCode, expirationDate, isConfirmed }` on the user and emails the code; confirm/resend endpoints live in `auth-router.ts`.
- List endpoints follow one shared response envelope: `{ pagesCount, page, pageSize, totalCount, items }`, with Mongo documents mapped to `{ ...doc, id: doc._id.toString(), _id: undefined }`. Follow this shape for any new list/detail endpoint.
- `DELETE /testing/all-data` (in `src/setting.ts`) clears blogs, posts, users and comments — used by tests/local resets, not a real product endpoint.

## Testing

- Spec files live in `__tests__/*.api.spec.ts`, driven by `supertest` against the real `app` + real MongoDB.
- `__tests__/setup.ts` (vitest `setupFiles`) opens/closes the Mongoose connection and `vi.mock`s the email adapter, so no real emails are sent; assert on sends via `vi.mocked(emailAdapter.sendEmail)`.
- `fileParallelism: false` in `vitest.config.ts`: all spec files share one real DB, so they run serially. Tests must be isolated — clear data in `beforeEach` via `DELETE /testing/all-data`.
- Shared per-entity request helpers (`blogsTestManager`, `postsTestManager`, `usersTestManager`, `authTestManager`, `commentsTestManager`) live in `__tests__/utils/*-manager.ts` and wrap `supertest` calls with expected-status assertions; add new entity helpers there rather than duplicating request-building logic in spec files.
