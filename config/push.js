const webpush = require('web-push');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BHOd4pOZuHeJWqoPdUHjAFx9YS05SJSBj5M6-kwX_hAM2IKSs9dXAA68X6epBz2tjyMkDXfCMJrQ5MRUNfpnLxE';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'zWBqRBj8Un0UQFTrK5-6v_8mBXJGs4ARLv_viMvtbQ4';

webpush.setVapidDetails(
  'mailto:contact@ouba.app',
  vapidPublicKey,
  vapidPrivateKey
);

module.exports = { webpush, vapidPublicKey };
