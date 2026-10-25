const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { createStateStore } = require('../src/monitor-state-store');

test('returns an empty monitor state when no state file exists', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'orderbot-state-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = createStateStore(path.join(dir, 'state.json'));
  assert.deepEqual(await store.read(), { orders: {} });
});

test('persists monitor state and reads it back', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'orderbot-state-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = createStateStore(path.join(dir, 'nested', 'state.json'));
  const expected = { orders: { 123: { status: 'open', last_alerted_at: 99 } } };
  await store.write(expected);
  assert.deepEqual(await store.read(), expected);
});
