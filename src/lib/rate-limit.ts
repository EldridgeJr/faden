import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limits per user, counted in Upstash Redis.
// A counter in memory would not work on Vercel: every request can run in
// another instance, and each instance would have its own empty counter.
//
// Every chat question costs money (embedding + model). The limits protect
// the OpenAI budget if an account is misused. A normal user never hits them.

// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
const redis = Redis.fromEnv();

// Sliding window: always counts the last minute, not a fixed clock minute.
// So nobody can send 10 questions at 12:00:59 and 10 more at 12:01:00.
const perMinute = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "faden:chat:minute",
});

const perDay = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, "1 d"),
  prefix: "faden:chat:day",
});

// true: the user may ask. false: too many questions, try again later.
export async function allowChatRequest(userId: string): Promise<boolean> {
  // Both counters go up, even if the first one already says no. That is fine:
  // a user over the limit has to wait anyway.
  const [minute, day] = await Promise.all([perMinute.limit(userId), perDay.limit(userId)]);
  return minute.success && day.success;
}

// Studio items (podcast, flashcards) have their own counters. A podcast costs
// many times a chat answer (script + speech), so the limits are lower.
const studioPerHour = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "faden:studio:hour",
});

const studioPerDay = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 d"),
  prefix: "faden:studio:day",
});

// true: the user may create a studio item. false: try again later.
export async function allowStudioRequest(userId: string): Promise<boolean> {
  const [hour, day] = await Promise.all([studioPerHour.limit(userId), studioPerDay.limit(userId)]);
  return hour.success && day.success;
}
