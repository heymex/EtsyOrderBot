const test = require('node:test');
const assert = require('node:assert/strict');

const { formatOrderAlert, sendWebhook } = require('../src/notifier');

test('formats a new order alert without exposing buyer contact or address details', () => {
  const text = formatOrderAlert({
    kind: 'new',
    shopName: 'TheObsidianChamber',
    receipt: {
      receipt_id: 456,
      name: 'Private Buyer',
      buyer_email: 'buyer@example.com',
      grandtotal: { amount: 4299, divisor: 100, currency_code: 'USD' },
      transactions: [{ title: 'Gothic Shrine' }, { title: 'Skull Candle Holder' }],
    },
  });

  assert.match(text, /NEW ETSY ORDER/);
  assert.match(text, /#456/);
  assert.match(text, /\$42\.99/);
  assert.match(text, /Gothic Shrine/);
  assert.match(text, /Skull Candle Holder/);
  assert.doesNotMatch(text, /Private Buyer/);
  assert.doesNotMatch(text, /buyer@example\.com/);
});

test('posts Slack-compatible JSON to the configured webhook', async () => {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return { ok: true, status: 200, text: async () => 'ok' };
  };

  await sendWebhook({
    url: 'https://hooks.example.invalid/secret',
    text: 'Order alert',
    secret: 'test-secret',
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://hooks.example.invalid/secret');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].headers['Content-Type'], 'application/json');
  assert.equal(
    calls[0][1].headers['X-Hub-Signature-256'],
    'sha256=097c11e5233b1c3efd340239c5a59c390df1c5e87f0520bed5c7b1cd1ee7e100'
  );
  assert.deepEqual(JSON.parse(calls[0][1].body), { text: 'Order alert' });
});

test('throws when the notification webhook rejects an alert', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'broken' });
  await assert.rejects(
    sendWebhook({ url: 'https://hooks.example.invalid/secret', text: 'Order alert', fetchImpl }),
    /Notification webhook returned HTTP 500/
  );
});
