function createMonitorRuntime({ check, now = Date.now, logger = console }) {
  let status = {
    status: 'starting',
    alertsSent: 0,
    openOrders: 0,
    last_checked_at: null,
    last_success_at: null,
    error: null,
  };
  let running = false;

  async function runOnce() {
    if (running) return { ...status, skipped: 'already-running' };
    running = true;
    try {
      const result = await check();
      const checkedAt = now();
      status = {
        ...result,
        last_checked_at: checkedAt,
        last_success_at: checkedAt,
        error: null,
      };
    } catch (error) {
      status = {
        ...status,
        status: 'error',
        last_checked_at: now(),
        error: error.message || String(error),
      };
      logger.error(`Order monitor check failed: ${status.error}`);
    } finally {
      running = false;
    }
    return status;
  }

  function getStatus() {
    return { ...status };
  }

  return { runOnce, getStatus };
}

function monitorHttpStatus(monitor) {
  return monitor.status === 'ok' ? 200 : 503;
}

module.exports = { createMonitorRuntime, monitorHttpStatus };
