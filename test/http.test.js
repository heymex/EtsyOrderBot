const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchWithTimeout, fetchTextWithTimeout } = require('../src/http');

test('returns successful HTTP responses before the timeout', async () => {
  const response = { ok: true, status: 200 };
  const actual = await fetchWithTimeout('https://example.invalid', {}, {
    timeoutMs: 50,
    fetchImpl: async () => response,
  });
  assert.equal(actual, response);
});

test('aborts a stalled HTTP request after the configured timeout', async () => {
  const stalledFetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });

  await assert.rejects(
    fetchWithTimeout('https://example.invalid', {}, { timeoutMs: 5, fetchImpl: stalledFetch }),
    /HTTP request timed out after 5ms/
  );
});

test('keeps the timeout active while consuming the response body', async () => {
  const completeFetch = async () => ({ ok: true, status: 200, text: async () => 'done' });
  const completed = await fetchTextWithTimeout('https://example.invalid', {}, {
    timeoutMs: 50,
    fetchImpl: completeFetch,
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.text, 'done');

  const headersOnlyFetch = async (_url, options) => ({
    ok: true,
    status: 200,
    text: async () =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), {
          once: true,
        });
      }),
  });

  await assert.rejects(
    fetchTextWithTimeout('https://example.invalid', {}, {
      timeoutMs: 5,
      fetchImpl: headersOnlyFetch,
    }),
    /HTTP request timed out after 5ms/
  );
});
