import type { MemoryStore } from "express-rate-limit";

// Shared between setup.ts (which wraps express-rate-limit) and the specs.
// Rate limiting is off by default, because helpers like usersTestManager.createUser
// hit limited /auth routes many times in a single test. Specs that cover the
// limiter itself turn it on with enableRateLimit().
export const rateLimitControl = {
  enabled: false,
  stores: [] as MemoryStore[],
};

export const enableRateLimit = () => {
  rateLimitControl.enabled = true;
};

// Called from setup.ts before every test so no test inherits another's hit counts.
export const resetRateLimit = async () => {
  rateLimitControl.enabled = false;
  await Promise.all(rateLimitControl.stores.map((store) => store.resetAll()));
};
