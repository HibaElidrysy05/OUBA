const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const keysFile = path.join(__dirname, '..', 'vapid-keys.json');

function loadOrGenerateKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
  }
  try {
    if (fs.existsSync(keysFile)) {
      return JSON.parse(fs.readFileSync(keysFile, 'utf8'));
    }
  } catch (e) {
    // ignore
  }
  const keys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2));
    console.log('Generated new VAPID keys');
  } catch (e) {
    console.error('Could not save VAPID keys:', e.message);
  }
  return keys;
}

const keys = loadOrGenerateKeys();

webpush.setVapidDetails(
  'mailto:contact@ouba.app',
  keys.publicKey,
  keys.privateKey
);

console.log('VAPID public key:', keys.publicKey);

module.exports = { webpush, vapidPublicKey: keys.publicKey };
