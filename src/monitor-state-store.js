const fs = require('fs/promises');
const path = require('path');

function createStateStore(filePath) {
  return {
    async read() {
      try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return { orders: {} };
        throw error;
      }
    },
    async write(state) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(state, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      await fs.rename(temporaryPath, filePath);
    },
  };
}

module.exports = { createStateStore };
