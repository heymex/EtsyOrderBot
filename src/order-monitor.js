function evaluateReceipts({
  receipts,
  state = { orders: {} },
  now = Date.now(),
  reminderMs = 6 * 60 * 60 * 1000,
  completeOpenSet = false,
}) {
  const nextState = {
    ...state,
    orders: { ...(state.orders || {}) },
  };
  const alerts = [];
  const seenIds = new Set();

  for (const receipt of receipts) {
    const id = String(receipt.receipt_id);
    seenIds.add(id);
    const previous = nextState.orders[id];
    const actionable = receipt.is_paid && !receipt.is_shipped && !receipt.is_canceled;

    if (!actionable) {
      if (previous?.status === 'open') {
        nextState.orders[id] = { ...previous, status: 'closed', closed_at: now };
      }
      continue;
    }

    const isNew = !previous || previous.status !== 'open';
    const reminderDue =
      !isNew && now - Number(previous.last_alerted_at || 0) >= reminderMs;

    if (isNew || reminderDue) {
      alerts.push({ receipt, kind: isNew ? 'new' : 'reminder' });
    }

    nextState.orders[id] = {
      ...previous,
      first_seen_at: previous?.first_seen_at || now,
      last_alerted_at: isNew || reminderDue ? now : previous.last_alerted_at,
      status: 'open',
    };
    delete nextState.orders[id].closed_at;
  }

  if (completeOpenSet) {
    for (const [id, order] of Object.entries(nextState.orders)) {
      if (order.status === 'open' && !seenIds.has(id)) {
        nextState.orders[id] = { ...order, status: 'closed', closed_at: now };
      }
    }
  }

  return { alerts, state: nextState };
}

module.exports = { evaluateReceipts };
