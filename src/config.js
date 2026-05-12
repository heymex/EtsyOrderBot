require('dotenv').config();

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
