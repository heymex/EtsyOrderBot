const config = require('./config');
const tokenStore = require('./token-store');
const { fetchTextWithTimeout } = require('./http');

const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const API_ROOT = 'https://openapi.etsy.com/v3/application';

const SCOPES = ['listings_r', 'listings_w', 'transactions_r', 'shops_r'].join(' ');

function userIdFromAccessToken(accessToken) {
  const prefix = accessToken.split('.')[0];
  const n = Number(prefix);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Could not parse user id from access token');
  }
  return n;
}

async function postForm(url, params) {
  const body = new URLSearchParams(params);
  const { response: res, text } = await fetchTextWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
    { timeoutMs: config.requestTimeoutMs }
  );
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(json.error || json.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function exchangeAuthorizationCode(code, codeVerifier) {
  return postForm(TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: config.apiKey,
    redirect_uri: config.redirectUri,
    code,
    code_verifier: codeVerifier,
  });
}

async function refreshAccessToken(refreshToken) {
  return postForm(TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: config.apiKey,
    refresh_token: refreshToken,
  });
}

function buildAuthUrl({ state, codeChallenge }) {
  const u = new URL('https://www.etsy.com/oauth/connect');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', config.apiKey);
  u.searchParams.set('redirect_uri', config.redirectUri);
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

async function persistTokenResponse(tokenJson, existing = {}) {
  const expiresAt =
    Date.now() + (Number(tokenJson.expires_in) || 3600) * 1000 - 60_000;
  await tokenStore.writeTokens({
    ...existing,
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    expires_at: expiresAt,
  });
}

async function getValidTokens() {
  let data = await tokenStore.readTokens();
  if (!data?.refresh_token) return null;

  if (!data.access_token || Date.now() >= (data.expires_at || 0)) {
    const refreshed = await refreshAccessToken(data.refresh_token);
    await persistTokenResponse(refreshed, {
      shop_id: data.shop_id,
      shop_name: data.shop_name,
    });
    data = await tokenStore.readTokens();
  }
  return data;
}

async function apiFetch(accessToken, pathname, options = {}) {
  const url = `${API_ROOT}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const headers = {
    'x-api-key': config.xApiKeyHeader,
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    ...options.headers,
  };
  const { response: res, text } = await fetchTextWithTimeout(
    url,
    { ...options, headers },
    { timeoutMs: config.requestTimeoutMs }
  );
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(json.error || json.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function shopFromResponse(response) {
  if (response?.shop_id) return response;
  return response?.results?.[0] || null;
}

async function ensureShopMeta(tokens) {
  if (tokens.shop_id) return tokens;
  const userId = userIdFromAccessToken(tokens.access_token);
  const shops = await apiFetch(
    tokens.access_token,
    `/users/${userId}/shops`
  );
  const shop = shopFromResponse(shops);
  if (!shop?.shop_id) {
    throw new Error('No shop found for this Etsy account');
  }
  const next = {
    ...tokens,
    shop_id: shop.shop_id,
    shop_name: shop.shop_name || String(shop.shop_id),
  };
  await tokenStore.writeTokens({
    access_token: next.access_token,
    refresh_token: next.refresh_token,
    expires_at: next.expires_at,
    shop_id: next.shop_id,
    shop_name: next.shop_name,
  });
  return next;
}

async function getShop(tokens) {
  const t = await ensureShopMeta(tokens);
  return apiFetch(t.access_token, `/shops/${t.shop_id}`);
}

function buildReceiptQuery({
  limit = 25,
  offset = 0,
  wasPaid,
  wasShipped,
  wasCanceled,
} = {}) {
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    sort_on: 'created',
    sort_order: 'desc',
  });
  if (typeof wasPaid === 'boolean') q.set('was_paid', String(wasPaid));
  if (typeof wasShipped === 'boolean') q.set('was_shipped', String(wasShipped));
  if (typeof wasCanceled === 'boolean') q.set('was_canceled', String(wasCanceled));
  return q;
}

async function getReceipts(tokens, options = {}) {
  const t = await ensureShopMeta(tokens);
  const q = buildReceiptQuery(options);
  return apiFetch(t.access_token, `/shops/${t.shop_id}/receipts?${q}`);
}

async function getListings(tokens, { state = 'active', limit = 50, offset = 0 } = {}) {
  const t = await ensureShopMeta(tokens);
  const q = new URLSearchParams({
    state,
    limit: String(limit),
    offset: String(offset),
  });
  return apiFetch(t.access_token, `/shops/${t.shop_id}/listings?${q}`);
}

async function getListing(tokens, listingId) {
  const t = await ensureShopMeta(tokens);
  const json = await apiFetch(
    t.access_token,
    `/shops/${t.shop_id}/listings/${listingId}`
  );
  if (json?.results?.[0]) return json.results[0];
  return json;
}

/**
 * Partial update (Etsy Open API v3 PATCH). Fields are sent as form-urlencoded body.
 * @param {Record<string, string>} fields supported by updateListing (e.g. title, state)
 */
async function patchListing(tokens, listingId, fields) {
  const t = await ensureShopMeta(tokens);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== '') body.set(k, String(v));
  }
  if ([...body.keys()].length === 0) {
    throw new Error('No listing fields to update');
  }
  return apiFetch(t.access_token, `/shops/${t.shop_id}/listings/${listingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

module.exports = {
  SCOPES,
  userIdFromAccessToken,
  exchangeAuthorizationCode,
  persistTokenResponse,
  getValidTokens,
  buildAuthUrl,
  getShop,
  shopFromResponse,
  buildReceiptQuery,
  getReceipts,
  getListings,
  getListing,
  patchListing,
};
