const express = require('express');
const session = require('express-session');
const config = require('./config');
const { randomState, createPkcePair } = require('./pkce');
const tokenStore = require('./token-store');
const etsy = require('./etsy-api');
const { escapeHtml, layout } = require('./render');

config.validate();

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

async function loadTokens(_req, res, next) {
  try {
    res.locals.tokens = await etsy.getValidTokens();
    next();
  } catch (e) {
    next(e);
  }
}

function formatEtsyMoney(money) {
  if (!money || money.amount == null) return '—';
  const div = Number(money.divisor) || 100;
  const n = Number(money.amount) / div;
  const cur = money.currency_code || 'USD';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur,
    }).format(n);
  } catch {
    return `${n} ${cur}`;
  }
}

app.get('/', loadTokens, (req, res) => {
  const { tokens } = res.locals;
  if (!tokens) {
    const body = `
      <div class="card">
        <h1>OrderBot</h1>
        <p class="muted">Connect your Etsy seller account to view orders and listings.</p>
        <p><a class="btn" href="/auth">Sign in with Etsy</a></p>
        <p class="muted">Use an HTTPS callback registered in your Etsy app (tunnel for local dev).</p>
      </div>`;
    return res.type('html').send(layout({ title: 'Home', body }));
  }

  const body = `
    <h1>Dashboard</h1>
    <p class="muted">Signed in${tokens.shop_name ? ` — ${escapeHtml(tokens.shop_name)}` : ''}.</p>
    <div class="card">
      <p><a href="/orders">Recent orders</a> · <a href="/listings">Shop listings</a></p>
    </div>`;
  res.type('html').send(layout({ title: 'Home', body }));
});

app.get('/auth', (req, res) => {
  const state = randomState();
  const { codeVerifier, codeChallenge } = createPkcePair();
  req.session.oauth = { state, codeVerifier };
  const url = etsy.buildAuthUrl({ state, codeChallenge });
  res.redirect(url);
});

app.get(config.callbackPath, async (req, res) => {
  const { code, state, error, error_description: errDesc } = req.query;
  const saved = req.session.oauth;
  req.session.oauth = null;

  if (error) {
    return res.status(400).type('html').send(
      layout({
        title: 'Auth error',
        body: `<div class="alert error">${escapeHtml(error)}: ${escapeHtml(errDesc || '')}</div><p><a href="/">Home</a></p>`,
      })
    );
  }

  if (!saved || state !== saved.state || !code) {
    return res.status(400).type('html').send(
      layout({
        title: 'Auth error',
        body: `<div class="alert error">Invalid OAuth state. Start again from <a href="/auth">/auth</a>.</div>`,
      })
    );
  }

  try {
    const tokenJson = await etsy.exchangeAuthorizationCode(code, saved.codeVerifier);
    await etsy.persistTokenResponse(tokenJson, {});
    res.redirect('/');
  } catch (e) {
    const detail =
      e.body && typeof e.body === 'object'
        ? JSON.stringify(e.body)
        : e.message;
    res.status(500).type('html').send(
      layout({
        title: 'Token error',
        body: `<div class="alert error">Could not exchange code for tokens.<pre style="white-space:pre-wrap">${escapeHtml(detail)}</pre></div><p><a href="/auth">Retry</a></p>`,
      })
    );
  }
});

app.get('/logout', async (_req, res) => {
  await tokenStore.clearTokens();
  res.redirect('/');
});

app.get('/orders', loadTokens, async (req, res, next) => {
  const { tokens } = res.locals;
  if (!tokens) {
    return res.redirect('/');
  }
  try {
    const data = await etsy.getReceipts(tokens, { limit: 50, offset: 0 });
    const rows = (data.results || [])
      .map((r) => {
        const id = r.receipt_id;
        const created = r.create_timestamp
          ? new Date(r.create_timestamp * 1000).toLocaleString()
          : '—';
        const total = formatEtsyMoney(r.grandtotal);
        const buyer = r.name || r.buyer_email || r.first_line || '—';
        return `<tr>
          <td>${escapeHtml(String(id))}</td>
          <td>${escapeHtml(created)}</td>
          <td>${escapeHtml(buyer)}</td>
          <td>${escapeHtml(total)}</td>
          <td>${r.is_paid ? 'paid' : '—'}</td>
          <td>${r.is_shipped ? 'shipped' : '—'}</td>
        </tr>`;
      })
      .join('');

    const sum = (data.results || []).reduce((acc, r) => {
      const g = r.grandtotal;
      if (!g || g.amount == null) return acc;
      const div = Number(g.divisor) || 100;
      return acc + Number(g.amount) / div;
    }, 0);
    const firstCur = data.results?.[0]?.grandtotal?.currency_code;
    const summary = firstCur
      ? new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: firstCur,
        }).format(sum)
      : '—';

    const body = `
      <h1>Orders</h1>
      <p class="muted">Latest receipts (up to 50). Total shown uses raw API amounts; verify currency in Etsy if you use multiple.</p>
      <p><strong>Page total (first page):</strong> ${escapeHtml(summary)}</p>
      <table>
        <thead><tr><th>ID</th><th>Created</th><th>Buyer</th><th>Total</th><th>Paid</th><th>Shipped</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="muted">No receipts returned.</td></tr>'}</tbody>
      </table>`;
    res.type('html').send(layout({ title: 'Orders', body }));
  } catch (e) {
    next(e);
  }
});

app.get('/listings', loadTokens, async (req, res, next) => {
  const { tokens } = res.locals;
  if (!tokens) {
    return res.redirect('/');
  }
  try {
    const data = await etsy.getListings(tokens, { state: 'active', limit: 100 });
    const saved = req.query.saved === '1';
    const rows = (data.results || [])
      .map((L) => {
        const id = L.listing_id;
        const title = L.title || '(no title)';
        const price = formatEtsyMoney(L.price);
        return `<tr>
          <td>${escapeHtml(String(id))}</td>
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(price)}</td>
          <td><a href="/listings/${id}/edit">Edit</a></td>
        </tr>`;
      })
      .join('');

    const body = `
      <h1>Listings</h1>
      ${saved ? '<div class="alert ok">Listing saved.</div>' : ''}
      <p class="muted">Active listings. Use Edit to change the title (more fields can be added later).</p>
      <table>
        <thead><tr><th>ID</th><th>Title</th><th>Price</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="muted">No listings.</td></tr>'}</tbody>
      </table>`;
    res.type('html').send(layout({ title: 'Listings', body }));
  } catch (e) {
    next(e);
  }
});

app.get('/listings/:id/edit', loadTokens, async (req, res, next) => {
  const { tokens } = res.locals;
  if (!tokens) {
    return res.redirect('/');
  }
  const id = req.params.id;
  try {
    const L = await etsy.getListing(tokens, id);
    const title = L.title || '';
    const body = `
      <h1>Edit listing</h1>
      <p class="muted">Listing #${escapeHtml(id)}</p>
      <form method="post" action="/listings/${escapeHtml(id)}/edit">
        <label for="title">Title</label>
        <input id="title" name="title" type="text" value="${escapeHtml(title)}" required maxlength="140" />
        <p style="margin-top:1rem">
          <button class="btn" type="submit">Save</button>
          <a class="btn secondary" href="/listings">Cancel</a>
        </p>
      </form>`;
    res.type('html').send(layout({ title: 'Edit listing', body }));
  } catch (e) {
    next(e);
  }
});

app.post('/listings/:id/edit', loadTokens, async (req, res, next) => {
  const { tokens } = res.locals;
  if (!tokens) {
    return res.redirect('/');
  }
  const id = req.params.id;
  const title = (req.body.title || '').trim();
  if (!title) {
    return res.redirect(`/listings/${id}/edit`);
  }
  try {
    await etsy.patchListing(tokens, id, { title });
    res.redirect(`/listings?saved=1`);
  } catch (e) {
    next(e);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const msg = err.message || 'Unexpected error';
  const detail = err.body ? JSON.stringify(err.body) : '';
  res.status(err.status || 500).type('html').send(
    layout({
      title: 'Error',
      body: `<div class="alert error">${escapeHtml(msg)}</div>${
        detail ? `<pre style="white-space:pre-wrap">${escapeHtml(detail)}</pre>` : ''
      }<p><a href="/">Home</a></p>`,
    })
  );
});

app.listen(config.port, () => {
  console.log(`OrderBot http://localhost:${config.port}`);
  console.log(`OAuth callback path: ${config.callbackPath} (must match ETSY_REDIRECT_URI)`);
});