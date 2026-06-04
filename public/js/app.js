(function () {
  try {
    window.appSocket = io({ transports: ['websocket', 'polling'] });

    window.appSocket.on('connect', () => {
      const userId = document.body.dataset.userId;
      if (userId) {
        window.appSocket.emit('user-online', userId);
      }
    });

    window.appSocket.on('user-status', (data) => {
      const dots = document.querySelectorAll(`[data-user-id="${data.userId}"] .status-dot`);
      dots.forEach(dot => {
        if (data.status === 'online') {
          dot.className = 'status-dot online';
        } else {
          dot.className = 'status-dot offline';
        }
      });
    });
  } catch (e) {
    console.log('Socket init error:', e);
  }
})();
