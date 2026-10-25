const test = require('node:test');
const assert = require('node:assert/strict');

const { createMonitorRuntime, monitorHttpStatus } = require('../src/monitor-runtime');

test('records successful Etsy monitor checks for the health endpoint', async () => {
  const runtime = createMonitorRuntime({
    check: async () => ({ status: 'ok', alertsSent: 1, openOrders: 2 }),
    now: () => 12345,
    logger: { error() {} },
  });

  const status = await runtime.runOnce();
  assert.deepEqual(status, {
    status: 'ok',
    alertsSent: 1,
    openOrders: 2,
    last_checked_at: 12345,
    last_success_at: 12345,
    error: null,
  });
  assert.deepEqual(runtime.getStatus(), status);
});

test('records check failures without crashing the server loop', async () => {
  const errors = [];
  const runtime = createMonitorRuntime({
    check: async () => { throw new Error('Etsy unavailable'); },
    now: () => 67890,
    logger: { error: (message) => errors.push(message) },
  });

  const status = await runtime.runOnce();
  assert.equal(status.status, 'error');
  assert.equal(status.last_checked_at, 67890);
  assert.equal(status.last_success_at, null);
  assert.equal(status.error, 'Etsy unavailable');
  assert.equal(errors.length, 1);
});

test('reports healthy only when order monitoring is operational', () => {
  assert.equal(monitorHttpStatus({ status: 'ok' }), 200);
  for (const status of ['starting', 'error', 'disconnected', 'notifications-disabled']) {
    assert.equal(monitorHttpStatus({ status }), 503);
  }
});
