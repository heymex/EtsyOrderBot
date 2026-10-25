require('dotenv').config();
const { boundedSecondsToMs } = require('./settings');

function required(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v.trim();
}

const apiKey = process.env.ETSY_API_KEY?.trim();
const sharedSecret = process.env.ETSY_SHARED_SECRET?.trim();
const redirectUri = process.env.ETSY_REDIRECT_URI?.trim();
const sessionSecret = process.env.SESSION_SECRET?.trim();
const notificationWebhookUrl = process.env.NOTIFICATION_WEBHOOK_URL?.trim();
const notificationWebhookSecret = process.env.NOTIFICATION_WEBHOOK_SECRET?.trim();
const monitorIntervalMs = boundedSecondsToMs(process.env.ETSY_MONITOR_INTERVAL_SECONDS, {
  defaultSeconds: 300,
  minSeconds: 60,
  maxSeconds: 3600,
});
const reminderMs = boundedSecondsToMs(
  Number(process.env.ETSY_REMINDER_HOURS) * 60 * 60,
  { defaultSeconds: 6 * 60 * 60, minSeconds: 60, maxSeconds: 30 * 24 * 60 * 60 }
);
const requestTimeoutMs = boundedSecondsToMs(process.env.HTTP_TIMEOUT_SECONDS, {
  defaultSeconds: 15,
  minSeconds: 1,
  maxSeconds: 60,
});

let callbackPath = '/callback';
if (redirectUri) {
  try {
    callbackPath = new URL(redirectUri).pathname || '/callback';
  } catch {
    throw new Error('ETSY_REDIRECT_URI must be a valid URL');
  }
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  apiKey,
  sharedSecret,
  redirectUri,
  sessionSecret,
  notificationWebhookUrl,
  notificationWebhookSecret,
  monitorIntervalMs,
  reminderMs,
  requestTimeoutMs,
  callbackPath,
  validate() {
    required('ETSY_API_KEY');
    required('ETSY_SHARED_SECRET');
    required('ETSY_REDIRECT_URI');
    required('SESSION_SECRET');
  },
  get xApiKeyHeader() {
    return `${apiKey}:${sharedSecret}`;
  },
};
