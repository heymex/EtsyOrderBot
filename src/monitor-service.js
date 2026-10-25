const { evaluateReceipts } = require('./order-monitor');
const { formatOrderAlert } = require('./notifier');

async function fetchAllOpenReceipts({ getReceipts, tokens, pageSize = 100 }) {
  const receipts = [];
  let offset = 0;
  while (true) {
    const page = await getReceipts(tokens, {
      limit: pageSize,
      offset,
      wasPaid: true,
      wasShipped: false,
      wasCanceled: false,
    });
    const results = page.results || [];
    receipts.push(...results);
    const total = Number(page.count);
    if (results.length < pageSize || (Number.isFinite(total) && receipts.length >= total)) {
      return receipts;
    }
    offset += results.length;
  }
}

async function runOrderCheck({
  getTokens,
  getReceipts,
  stateStore,
  notificationUrl,
  notificationSecret,
  send,
  now = Date.now(),
  reminderMs,
  requestTimeoutMs,
}) {
  const tokens = await getTokens();
  if (!tokens) return { status: 'disconnected', alertsSent: 0, openOrders: 0 };
  if (!notificationUrl) {
    return { status: 'notifications-disabled', alertsSent: 0, openOrders: 0 };
  }

  const [receipts, state] = await Promise.all([
    fetchAllOpenReceipts({ getReceipts, tokens }),
    stateStore.read(),
  ]);
  const evaluated = evaluateReceipts({
    receipts,
    state,
    now,
    reminderMs,
    completeOpenSet: true,
  });

  const alertIds = new Set(
    evaluated.alerts.map((alert) => String(alert.receipt.receipt_id))
  );
  const deliveredState = {
    ...evaluated.state,
    orders: { ...evaluated.state.orders },
  };
  for (const id of alertIds) {
    if (state.orders?.[id]) deliveredState.orders[id] = state.orders[id];
    else delete deliveredState.orders[id];
  }

  for (const alert of evaluated.alerts) {
    const text = formatOrderAlert({
      kind: alert.kind,
      shopName: tokens.shop_name,
      receipt: alert.receipt,
    });
    await send({
      url: notificationUrl,
      text,
      secret: notificationSecret,
      timeoutMs: requestTimeoutMs,
    });
    const id = String(alert.receipt.receipt_id);
    deliveredState.orders[id] = evaluated.state.orders[id];
    await stateStore.write(deliveredState);
  }

  if (evaluated.alerts.length === 0) {
    await stateStore.write(evaluated.state);
  }
  const openOrders = Object.values(evaluated.state.orders).filter(
    (order) => order.status === 'open'
  ).length;
  return { status: 'ok', alertsSent: evaluated.alerts.length, openOrders };
}

module.exports = { runOrderCheck, fetchAllOpenReceipts };
