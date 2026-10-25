const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReceiptQuery, shopFromResponse } = require('../src/etsy-api');

test('accepts Etsy shop responses returned as a top-level object', () => {
  assert.deepEqual(
    shopFromResponse({ shop_id: 63902525, shop_name: 'TheObsidianChamber' }),
    { shop_id: 63902525, shop_name: 'TheObsidianChamber' }
  );
});

test('accepts legacy Etsy shop responses wrapped in results', () => {
  const shop = { shop_id: 63902525, shop_name: 'TheObsidianChamber' };
  assert.equal(shopFromResponse({ results: [shop] }), shop);
});

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
