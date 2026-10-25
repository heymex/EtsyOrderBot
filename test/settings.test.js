const test = require('node:test');
const assert = require('node:assert/strict');

const { boundedSecondsToMs } = require('../src/settings');

test('uses the configured interval when it is finite and within bounds', () => {
  assert.equal(
    boundedSecondsToMs('300', { defaultSeconds: 120, minSeconds: 60, maxSeconds: 3600 }),
    300_000
  );
});

test('falls back to the default for non-finite intervals', () => {
  for (const value of ['Infinity', '-Infinity', 'NaN', 'not-a-number']) {
    assert.equal(
      boundedSecondsToMs(value, { defaultSeconds: 300, minSeconds: 60, maxSeconds: 3600 }),
      300_000
    );
  }
});

test('clamps finite intervals to safe minimum and maximum values', () => {
  assert.equal(
    boundedSecondsToMs('0.1', { defaultSeconds: 300, minSeconds: 60, maxSeconds: 3600 }),
    60_000
  );
  assert.equal(
    boundedSecondsToMs('999999999', { defaultSeconds: 300, minSeconds: 60, maxSeconds: 3600 }),
    3_600_000
  );
});
