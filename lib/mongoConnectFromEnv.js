const dns = require('dns');
const mongoose = require('mongoose');

function stripEnvUri(value) {
  if (value == null || typeof value !== 'string') return '';
  const t = value.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

const mongooseOpts = {
  serverSelectionTimeoutMS: 15_000,
};

/** Same URI order as server.js; throws if nothing is configured or every attempt fails. */
async function connectMongoFromEnv() {
  const direct = stripEnvUri(process.env.MONGO_URI_DIRECT);
  const primary = stripEnvUri(process.env.MONGO_URI);

  if (!direct && !primary) {
    throw new Error('Set MONGO_URI or MONGO_URI_DIRECT in backend/.env');
  }

  const attempts = [];
  if (direct) attempts.push({ uri: direct, label: 'MONGO_URI_DIRECT (standard / non-SRV)' });
  if (primary) attempts.push({ uri: primary, label: 'MONGO_URI' });

  const previousDns = dns.getServers();
  let lastErr = null;

  for (let i = 0; i < attempts.length; i += 1) {
    const { uri, label } = attempts[i];
    try {
      if (uri.startsWith('mongodb+srv://')) {
        try {
          dns.setDefaultResultOrder('ipv4first');
        } catch {
          /* Node < 17 */
        }
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      }

      await mongoose.connect(uri, mongooseOpts);
      console.log(`MongoDB connected (${label})`);
      if (previousDns.length) dns.setServers(previousDns);
      return;
    } catch (err) {
      lastErr = err;
      await mongoose.disconnect().catch(() => {});
      console.error(`MongoDB attempt failed (${label}):`, err.message || err);
    }
  }

  if (previousDns.length) dns.setServers(previousDns);
  throw lastErr || new Error('Could not connect to MongoDB');
}

module.exports = { connectMongoFromEnv, stripEnvUri };
