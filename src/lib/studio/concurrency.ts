// Runs fn for every item, at most `limit` at the same time.
// The results keep the order of the items, no matter which call ends first.
//
// Why not Promise.all(items.map(fn))? That starts all calls at once:
// 30 speech requests in the same second can hit OpenAI's rate limit.
// One after the other would be safe but slow.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  // After the first error no worker starts a new call: the result is lost
  // anyway, and every further speech call would cost money.
  let failed = false;

  // Each worker takes the next free index until none is left. JavaScript runs
  // one piece of code at a time, so "next++" never gives two workers the
  // same index.
  async function worker() {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
