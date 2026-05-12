const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '.data');
const TOKEN_FILE = path.join(DATA_DIR, 'tokens.json');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readTokens() {
  try {
    const raw = await fs.readFile(TOKEN_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function writeTokens(data) {
  await ensureDir();
  await fs.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function clearTokens() {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

module.exports = {
  readTokens,
  writeTokens,
  clearTokens,
  tokenFilePath: TOKEN_FILE,
};
