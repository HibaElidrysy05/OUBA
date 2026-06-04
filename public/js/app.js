(function () {
  try {
    window.appSocket = io({ transports: ['websocket', 'polling'] });
    window.appSocket.on('connect', () => {
      const userId = document.body.dataset.userId;
      if (userId) {
        window.appSocket.emit('user-online', userId);
      }
    });
  } catch (e) {
    console.error('Socket init error:', e);
  }
})();
