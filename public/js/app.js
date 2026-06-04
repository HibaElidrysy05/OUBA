(function () {
  try {
    window.appSocket = io({ transports: ['websocket', 'polling'] });

    function updateOnlineStatus(userId, status) {
      const dots = document.querySelectorAll(`.status-dot[data-user-id="${userId}"]`);
      dots.forEach(dot => {
        dot.className = `status-dot ${status}`;
        const txt = dot.nextElementSibling;
        if (txt && txt.classList.contains('status-text')) {
          txt.textContent = status === 'online' ? 'Online' : 'Offline';
        }
      });
    }

    function applyInitialStatus(onlineIds) {
      const allDots = document.querySelectorAll('.status-dot[data-user-id]');
      allDots.forEach(dot => {
        const uid = dot.dataset.userId;
        const isOnline = onlineIds.includes(uid);
        dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
      });
    }

    window.appSocket.on('connect', () => {
      const userId = document.body.dataset.userId;
      if (userId) {
        window.appSocket.emit('user-online', userId);
      }
    });

    window.appSocket.on('initial-status', (onlineIds) => {
      applyInitialStatus(onlineIds);
    });

    window.appSocket.on('user-status', (data) => {
      updateOnlineStatus(data.userId, data.status);
    });

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    window.appSocket.on('notification', (data) => {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        const senderName = data.sender ? (data.sender.displayName || data.sender.username) : 'Someone';
        new Notification(`Ouba - ${senderName}`, {
          body: data.content || 'Sent you a message',
          icon: data.sender && data.sender.profilePic ? data.sender.profilePic : '/favicon.ico'
        });
      }
    });
  } catch (e) {
    console.error('Socket init error:', e);
  }
})();
