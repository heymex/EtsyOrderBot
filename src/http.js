async function fetchAndConsumeWithTimeout(
  url,
  options,
  { timeoutMs, fetchImpl, consume }
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    return await consume(response);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`HTTP request timed out after ${timeoutMs}ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithTimeout(
  url,
  options = {},
  { timeoutMs = 15_000, fetchImpl = fetch } = {}
) {
  return fetchAndConsumeWithTimeout(url, options, {
    timeoutMs,
    fetchImpl,
    consume: async (response) => response,
  });
}

async function fetchTextWithTimeout(
  url,
  options = {},
  { timeoutMs = 15_000, fetchImpl = fetch } = {}
) {
  return fetchAndConsumeWithTimeout(url, options, {
    timeoutMs,
    fetchImpl,
    consume: async (response) => ({ response, text: await response.text() }),
  });
}

module.exports = { fetchWithTimeout, fetchTextWithTimeout };
