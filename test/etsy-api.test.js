const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReceiptQuery } = require('../src/etsy-api');

test('builds Etsy receipt filters for paid, unshipped, non-canceled orders', () => {
  const query = buildReceiptQuery({
    limit: 100,
    offset: 200,
    wasPaid: true,
    wasShipped: false,
    wasCanceled: false,
  });

  assert.equal(query.get('limit'), '100');
  assert.equal(query.get('offset'), '200');
  assert.equal(query.get('was_paid'), 'true');
  assert.equal(query.get('was_shipped'), 'false');
  assert.equal(query.get('was_canceled'), 'false');
  assert.equal(query.get('sort_on'), 'created');
  assert.equal(query.get('sort_order'), 'desc');
});
