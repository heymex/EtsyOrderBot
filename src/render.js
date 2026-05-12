function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const styles = `
:root { font-family: system-ui, sans-serif; background: #0f1419; color: #e7e9ea; }
a { color: #1d9bf0; }
header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; border-bottom: 1px solid #2f3336; }
nav a { margin-right: 1rem; }
main { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { text-align: left; padding: 0.5rem 0.4rem; border-bottom: 1px solid #2f3336; vertical-align: top; }
th { color: #8b98a5; font-weight: 600; }
.card { background: #16181c; border: 1px solid #2f3336; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
.muted { color: #8b98a5; font-size: 0.85rem; }
.btn { display: inline-block; padding: 0.45rem 0.9rem; border-radius: 6px; background: #1d9bf0; color: #fff; text-decoration: none; border: none; cursor: pointer; font-size: 0.9rem; }
.btn.secondary { background: #2f3336; color: #e7e9ea; }
.btn.danger { background: #536471; }
input[type="text"], textarea { width: 100%; max-width: 36rem; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid #2f3336; background: #0f1419; color: #e7e9ea; }
label { display: block; margin: 0.75rem 0 0.25rem; color: #8b98a5; font-size: 0.85rem; }
.alert { padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; }
.alert.error { background: #3a1212; border: 1px solid #6b1c1c; }
.alert.ok { background: #0d2818; border: 1px solid #1a4d2e; }
`;

function layout({ title, body, nav = true }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — OrderBot</title>
  <style>${styles}</style>
</head>
<body>
  ${nav ? `<header>
    <strong>OrderBot</strong>
    <nav>
      <a href="/">Home</a>
      <a href="/orders">Orders</a>
      <a href="/listings">Listings</a>
      <a href="/auth" class="btn" style="padding:0.35rem 0.7rem;font-size:0.8rem">Connect Etsy</a>
      <a href="/logout" class="btn secondary" style="padding:0.35rem 0.7rem;font-size:0.8rem">Log out</a>
    </nav>
  </header>` : ''}
  <main>${body}</main>
</body>
</html>`;
}

module.exports = { escapeHtml, layout };
