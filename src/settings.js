function boundedSecondsToMs(value, { defaultSeconds, minSeconds, maxSeconds }) {
  const parsed = Number(value);
  const seconds = Number.isFinite(parsed) ? parsed : defaultSeconds;
  return Math.round(Math.min(maxSeconds, Math.max(minSeconds, seconds)) * 1000);
}

module.exports = { boundedSecondsToMs };
