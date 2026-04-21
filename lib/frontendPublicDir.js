const path = require('path');

/** Root of Vite `public/` (served as `/…` on the frontend). Used to read/write payment QR assets. */
function resolveFrontendPublicDir() {
  if (process.env.FRONTEND_PUBLIC_DIR) {
    return path.resolve(process.env.FRONTEND_PUBLIC_DIR);
  }
  return path.join(__dirname, '..', '..', 'frontend', 'public');
}

module.exports = { resolveFrontendPublicDir };
