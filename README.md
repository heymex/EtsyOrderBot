# OrderBot

A personal Etsy seller tool for managing shop operations via the [Etsy Open API v3](https://developers.etsy.com/documentation/). OrderBot provides a streamlined interface for viewing sales data and managing listings — built for individual shop owners who want more control over their workflow.

---

## Features

- 📦 **Order dashboard** — view and browse recent transactions and receipts
- 📊 **Sales data** — read shop revenue and order history
- 🛍️ **Listing management** — view and bulk-edit shop listings
- 🚨 **Order monitoring** — poll Etsy every five minutes and send immediate webhook alerts
- 🔁 **Persistent reminders** — repeat alerts for paid, unshipped orders until Etsy reports them shipped
- ❤️ **Health status** — inspect monitor state at `/health` and on the dashboard

---

## Prerequisites

- An Etsy seller account
- An approved Etsy API key — register at [etsy.com/developers/register](https://www.etsy.com/developers/register)
- Node.js (v16 or higher) — or the relevant runtime for your environment

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/orderbot.git
cd orderbot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

```env
ETSY_API_KEY=your_keystring_here
ETSY_SHARED_SECRET=your_shared_secret_here
ETSY_REDIRECT_URI=https://your-callback-url.example.com/callback
NOTIFICATION_WEBHOOK_URL=https://hooks.slack.com/services/your/incoming/webhook
```

---

## Authentication

OrderBot uses Etsy's **OAuth 2.0 Authorization Code flow with PKCE**.

1. Start the app and visit the `/auth` route to begin the OAuth flow
2. You'll be redirected to Etsy to approve access
3. After approval, your access token and refresh token are stored locally

Access tokens expire after **1 hour**. OrderBot automatically refreshes them using the refresh token, which is valid for **90 days**.

Required OAuth scopes:
- `listings_r` / `listings_w` — read and edit listings
- `transactions_r` — read sales and order data
- `shops_r` — read shop information

For full details on the auth flow, see [Etsy's authentication docs](https://developers.etsy.com/documentation/essentials/authentication).

---

## Usage

```bash
npm start
```

Then open your browser to `http://localhost:3000`.

The order monitor starts with the web server. By default it checks Etsy every five minutes, follows every page of paid/unshipped/non-canceled receipts, and repeats reminders every six hours. It stores delivery state in `.data/order-monitor.json`, so restarts do not cause duplicate alerts. Each successful alert is saved immediately, preventing duplicates if a later alert in the same batch fails. Override the defaults with `ETSY_MONITOR_INTERVAL_SECONDS` and `ETSY_REMINDER_HOURS`; unsafe polling intervals are clamped between one minute and one hour.

Etsy and webhook requests time out after 15 seconds by default so a stalled network request cannot halt monitoring. Override this with `HTTP_TIMEOUT_SECONDS` (clamped between 1 and 60 seconds).

The webhook payload is Slack Incoming Webhook compatible (`{"text":"..."}`). When `NOTIFICATION_WEBHOOK_SECRET` is set, OrderBot signs the exact JSON body with HMAC-SHA256 in `X-Hub-Signature-256`, which allows delivery through an authenticated Hermes webhook route. Alerts intentionally omit buyer names, email addresses, and shipping addresses. An alert is only recorded as delivered after the webhook accepts it; failed deliveries are retried on the next polling cycle.

After deployment, visit `/health`. A connected and functioning monitor reports `status: "ok"` with HTTP 200. Every non-operational state returns HTTP 503: `disconnected` means Etsy OAuth still needs to be completed, and `notifications-disabled` means `NOTIFICATION_WEBHOOK_URL` is missing.

---

## API Reference

This project uses the [Etsy Open API v3](https://developers.etsy.com/documentation/reference). Base URL: `https://openapi.etsy.com`

Key endpoints used:

| Feature | Endpoint |
|---|---|
| List shop receipts | `GET /v3/application/shops/{shop_id}/receipts` |
| Get shop listings | `GET /v3/application/shops/{shop_id}/listings` |
| Update a listing | `PUT /v3/application/shops/{shop_id}/listings/{listing_id}` |
| Get shop info | `GET /v3/application/shops/{shop_id}` |

---

## Notes

- This app is intended for **personal use only** — it is not distributed to third parties
- API keys should never be committed to version control; use environment variables
- Per Etsy's API Terms of Use, keys must not be shared publicly or used by unauthorized parties

---

## License

MIT
