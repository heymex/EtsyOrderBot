const crypto = require('crypto');
const { fetchWithTimeout } = require('./http');

function formatMoney(money) {
  if (!money || money.amount == null) return 'total unavailable';
  const value = Number(money.amount) / (Number(money.divisor) || 100);
  const currency = money.currency_code || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatOrderAlert({ kind, shopName, receipt }) {
  const heading = kind === 'reminder' ? 'ETSY ORDER REMINDER' : 'NEW ETSY ORDER';
  const itemTitles = (receipt.transactions || [])
    .map((transaction) => transaction.title)
    .filter(Boolean);
  const items = itemTitles.length ? itemTitles.join(', ') : 'Open Etsy to view items';
  return [
    `🚨 ${heading} — ${shopName || 'your shop'}`,
    `Order #${receipt.receipt_id} · ${formatMoney(receipt.grandtotal)}`,
    `Items: ${items}`,
    'Action: review the order and production deadline in Etsy.',
  ].join('\n');
}

async function sendWebhook({
  url,
  text,
  secret,
  fetchImpl = fetch,
  timeoutMs = 15_000,
}) {
  const body = JSON.stringify({ text });
  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Hub-Signature-256'] = `sha256=${signature}`;
  }
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers,
      body,
    },
    { fetchImpl, timeoutMs }
  );
  if (!response.ok) {
    throw new Error(`Notification webhook returned HTTP ${response.status}`);
  }
}

module.exports = { formatOrderAlert, sendWebhook };
