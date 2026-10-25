const test = require('node:test');
const assert = require('node:assert/strict');

const { runOrderCheck, fetchAllOpenReceipts } = require('../src/monitor-service');

function fakeOrder() {
  return {
    receipt_id: 123,
    is_paid: true,
    is_shipped: false,
    grandtotal: { amount: 2500, divisor: 100, currency_code: 'USD' },
    transactions: [{ title: 'Gothic Decor' }],
  };
}

test('paginates every paid, unshipped, non-canceled receipt', async () => {
  const calls = [];
  const firstPage = Array.from({ length: 100 }, (_, index) => ({ receipt_id: index + 1 }));
  const secondPage = [{ receipt_id: 101 }];
  const getReceipts = async (_tokens, options) => {
    calls.push(options);
    return options.offset === 0
      ? { count: 101, results: firstPage }
      : { count: 101, results: secondPage };
  };

  const receipts = await fetchAllOpenReceipts({ getReceipts, tokens: {}, pageSize: 100 });

  assert.equal(receipts.length, 101);
  assert.deepEqual(calls, [
    { limit: 100, offset: 0, wasPaid: true, wasShipped: false, wasCanceled: false },
    { limit: 100, offset: 100, wasPaid: true, wasShipped: false, wasCanceled: false },
  ]);
});

test('fetches orders, sends alerts, and persists state only after delivery succeeds', async () => {
  const writes = [];
  const messages = [];
  const result = await runOrderCheck({
    getTokens: async () => ({ shop_name: 'TheObsidianChamber' }),
    getReceipts: async () => ({ results: [fakeOrder()] }),
    stateStore: {
      read: async () => ({ orders: {} }),
      write: async (state) => writes.push(state),
    },
    notificationUrl: 'https://hooks.example.invalid/secret',
    notificationSecret: 'hmac-secret',
    send: async (message) => messages.push(message),
    now: Date.parse('2026-01-01T12:00:00Z'),
    reminderMs: 60_000,
    requestTimeoutMs: 12_345,
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.alertsSent, 1);
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /NEW ETSY ORDER/);
  assert.equal(messages[0].timeoutMs, 12_345);
  assert.equal(messages[0].secret, 'hmac-secret');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].orders['123'].status, 'open');
});

test('does not persist an alert as delivered when notification delivery fails', async () => {
  let writes = 0;
  await assert.rejects(
    runOrderCheck({
      getTokens: async () => ({ shop_name: 'TheObsidianChamber' }),
      getReceipts: async () => ({ results: [fakeOrder()] }),
      stateStore: {
        read: async () => ({ orders: {} }),
        write: async () => { writes += 1; },
      },
      notificationUrl: 'https://hooks.example.invalid/secret',
      send: async () => { throw new Error('delivery failed'); },
      now: Date.parse('2026-01-01T12:00:00Z'),
      reminderMs: 60_000,
    }),
    /delivery failed/
  );
  assert.equal(writes, 0);
});

test('persists each successful delivery before attempting the next alert', async () => {
  const writes = [];
  let attempts = 0;
  await assert.rejects(
    runOrderCheck({
      getTokens: async () => ({ shop_name: 'TheObsidianChamber' }),
      getReceipts: async () => ({
        results: [
          { ...fakeOrder(), receipt_id: 123 },
          { ...fakeOrder(), receipt_id: 456 },
        ],
      }),
      stateStore: {
        read: async () => ({ orders: {} }),
        write: async (state) => writes.push(structuredClone(state)),
      },
      notificationUrl: 'https://hooks.example.invalid/secret',
      send: async () => {
        attempts += 1;
        if (attempts === 2) throw new Error('second delivery failed');
      },
      now: Date.parse('2026-01-01T12:00:00Z'),
      reminderMs: 60_000,
    }),
    /second delivery failed/
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0].orders['123'].status, 'open');
  assert.equal(writes[0].orders['456'], undefined);
});

test('reports disconnected without polling when Etsy has not been authorized', async () => {
  let polled = false;
  const result = await runOrderCheck({
    getTokens: async () => null,
    getReceipts: async () => { polled = true; },
    stateStore: { read: async () => ({ orders: {} }), write: async () => {} },
    notificationUrl: 'https://hooks.example.invalid/secret',
    send: async () => {},
  });
  assert.equal(result.status, 'disconnected');
  assert.equal(polled, false);
});
