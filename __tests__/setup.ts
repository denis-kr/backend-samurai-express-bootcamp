import { runDb, stopDb } from "../src/repositories/db.js";

// Never send real emails from tests — the adapter is the only place that talks
// to nodemailer, so stubbing it covers registration, resend, and admin user creation.
// Specs can inspect calls via `vi.mocked(emailAdapter.sendEmail)`.
vi.mock("../src/adapters/email-adapter.js", () => ({
  emailAdapter: {
    sendEmail: vi.fn().mockResolvedValue({ accepted: [], rejected: [] }),
  },
}));

// Mongoose buffers queries until it is connected, so the suite has to open the
// connection itself — the specs only import `app`, they never start the server.
beforeAll(async () => {
  await runDb();
});

afterAll(async () => {
  await stopDb();
});
