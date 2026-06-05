const webpush = require('web-push');

function getKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  return {
    publicKey: 'BOmLcfhKwJo408nQAvRtRh2fHvtsbI1rX9GjJXAMFeXn29POjw5RM4byMSkIgxhEFFJdxf0r48axvWWMGRokzFI',
    privateKey: 'MnTbD-buJjAxAirxBnTjmTCZIuVXIY_mFjpSkzpkSFY'
  };
}

const keys = getKeys();

webpush.setVapidDetails('mailto:contact@ouba.app', keys.publicKey, keys.privateKey);

console.log('VAPID public key:', keys.publicKey);

module.exports = { webpush, vapidPublicKey: keys.publicKey };
