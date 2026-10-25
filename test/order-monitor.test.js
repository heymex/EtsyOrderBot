const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateReceipts } = require('../src/order-monitor');

test('alerts immediately for a paid unshipped order, including on first scan', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  const receipt = {
    receipt_id: 123,
    is_paid: true,
    is_shipped: false,
    is_canceled: false,
    create_timestamp: Math.floor((now - 60_000) / 1000),
  };

  const result = evaluateReceipts({
    receipts: [receipt],
    state: { orders: {} },
    now,
    reminderMs: 6 * 60 * 60 * 1000,
  });

  assert.deepEqual(result.alerts.map((item) => item.receipt.receipt_id), [123]);
  assert.equal(result.state.orders['123'].first_seen_at, now);
  assert.equal(result.state.orders['123'].last_alerted_at, now);
  assert.equal(result.state.orders['123'].status, 'open');
});

test('does not repeat an alert before the reminder interval', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  const receipt = { receipt_id: 123, is_paid: true, is_shipped: false };
  const previousAlert = now - 60 * 60 * 1000;

  const result = evaluateReceipts({
    receipts: [receipt],
    state: {
      orders: {
        123: { first_seen_at: now - 2 * 60 * 60 * 1000, last_alerted_at: previousAlert, status: 'open' },
      },
    },
    now,
    reminderMs: 6 * 60 * 60 * 1000,
  });

  assert.equal(result.alerts.length, 0);
  assert.equal(result.state.orders['123'].last_alerted_at, previousAlert);
});

test('repeats an alert after the reminder interval', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  const receipt = { receipt_id: 123, is_paid: true, is_shipped: false };

  const result = evaluateReceipts({
    receipts: [receipt],
    state: {
      orders: {
        123: { first_seen_at: now - 7 * 60 * 60 * 1000, last_alerted_at: now - 6 * 60 * 60 * 1000, status: 'open' },
      },
    },
    now,
    reminderMs: 6 * 60 * 60 * 1000,
  });

  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].kind, 'reminder');
  assert.equal(result.state.orders['123'].last_alerted_at, now);
});

test('marks a previously tracked order closed when Etsy reports it shipped', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  const result = evaluateReceipts({
    receipts: [{ receipt_id: 123, is_paid: true, is_shipped: true }],
    state: {
      orders: {
        123: { first_seen_at: now - 1000, last_alerted_at: now - 1000, status: 'open' },
      },
    },
    now,
    reminderMs: 1000,
  });

  assert.equal(result.alerts.length, 0);
  assert.equal(result.state.orders['123'].status, 'closed');
  assert.equal(result.state.orders['123'].closed_at, now);
});

test('closes tracked orders missing from a complete open-order result set', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  const result = evaluateReceipts({
    receipts: [],
    state: {
      orders: {
        123: { first_seen_at: now - 1000, last_alerted_at: now - 1000, status: 'open' },
      },
    },
    now,
    reminderMs: 1000,
    completeOpenSet: true,
  });

  assert.equal(result.state.orders['123'].status, 'closed');
  assert.equal(result.state.orders['123'].closed_at, now);
});
