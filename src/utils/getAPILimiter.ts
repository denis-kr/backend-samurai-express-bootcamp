import rateLimit from "express-rate-limit";

export const getApiLimiter = () =>
  rateLimit({
    windowMs: 10000,
    max: 5,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

export default getApiLimiter;
