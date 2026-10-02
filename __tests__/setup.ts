import { runDb, stopDb } from "../src/repositories/db.js";
import { resetRateLimit } from "./utils/rate-limit-control.js";

// Never send real emails from tests — the adapter is the only place that talks
// to nodemailer, so stubbing it covers registration, resend, and admin user creation.
// Specs can inspect calls via `vi.mocked(emailAdapter.sendEmail)`.
vi.mock("../src/adapters/email-adapter.js", () => ({
  emailAdapter: {
    sendEmail: vi.fn().mockResolvedValue({ accepted: [], rejected: [] }),
  },
}));

// Keep the app's real limiter options, but give each limiter a store the tests can
// reset and a skip switch, so limits only apply in specs that call enableRateLimit().
vi.mock("express-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("express-rate-limit")>();
  const { rateLimitControl } = await import("./utils/rate-limit-control.js");

  const rateLimit: typeof actual.rateLimit = (options) => {
    const store = new actual.MemoryStore();
    rateLimitControl.stores.push(store);
    return actual.rateLimit({
      ...options,
      store,
      skip: () => !rateLimitControl.enabled,
    });
  };

  return { ...actual, default: rateLimit, rateLimit };
});

// Mongoose buffers queries until it is connected, so the suite has to open the
// connection itself — the specs only import `app`, they never start the server.
beforeAll(async () => {
  await runDb();
});

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await resetRateLimit();
});
