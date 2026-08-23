import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // The notifications page polls /api/events every few seconds, and the
  // admin panel's several tabs each fetch on mount - 100 req/15min was
  // sized for the original MVP's occasional button presses, not this.
  max: 2000,
  // A plain string message is sent as text/plain by express-rate-limit,
  // which broke apiService's `response.json()` parsing ("Unexpected
  // token" instead of a real error). Match the app's ApiResponse shape.
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
