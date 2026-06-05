(function () {
  try {
    window.appSocket = io({ transports: ['websocket', 'polling'] });

    function updateOnlineStatus(userId, status) {
      const dots = document.querySelectorAll('.status-dot[data-user-id="' + userId + '"]');
      dots.forEach(function (dot) {
        dot.className = 'status-dot ' + status;
        var txt = dot.nextElementSibling;
        if (txt && txt.classList.contains('status-text')) {
          txt.textContent = status === 'online' ? 'Online' : 'Offline';
        }
      });
    }

    function applyInitialStatus(onlineIds) {
      var allDots = document.querySelectorAll('.status-dot[data-user-id]');
      allDots.forEach(function (dot) {
        var uid = dot.dataset.userId;
        var status = onlineIds.indexOf(uid) !== -1 ? 'online' : 'offline';
        dot.className = 'status-dot ' + status;
        var txt = dot.nextElementSibling;
        if (txt && txt.classList.contains('status-text')) {
          txt.textContent = status === 'online' ? 'Online' : 'Offline';
        }
      });
    }

    function showGlobalToast(msg, type, link) {
      var existing = document.querySelector('.global-toast');
      if (existing) existing.remove();

      var toast = document.createElement('div');
      toast.className = 'global-toast toast toast-' + (type || 'info');
      if (link) {
        var a = document.createElement('a');
        a.href = link;
        a.style.color = 'inherit';
        a.style.textDecoration = 'none';
        a.textContent = msg;
        toast.appendChild(a);
      } else {
        toast.textContent = msg;
      }
      document.body.appendChild(toast);
      setTimeout(function () { toast.classList.add('show'); }, 10);
      setTimeout(function () {
        toast.classList.remove('show');
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
      }, 4000);
    }

    window.showGlobalToast = showGlobalToast;

    window.appSocket.on('connect', function () {
      var userId = document.body.dataset.userId;
      if (userId) {
        window.appSocket.emit('user-online', userId);
      }
    });

    window.appSocket.on('initial-status', function (onlineIds) {
      applyInitialStatus(onlineIds);
    });

    window.appSocket.on('user-status', function (data) {
      updateOnlineStatus(data.userId, data.status);
    });

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    window.appSocket.on('new-message-alert', function (data) {
      var senderName = data.sender ? (data.sender.displayName || data.sender.username) : 'Someone';
      if (data.mentioned) {
        var mentionMsg = senderName + ' mentioned you in ' + data.groupName;
        showGlobalToast(mentionMsg, 'info', data.chatUrl);
      } else {
        var prefix = data.type === 'group' ? '[' + data.groupName + '] ' : '';
        showGlobalToast(prefix + senderName + ': ' + data.content, 'info', data.chatUrl);
      }

      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        var notifBody = data.mentioned
          ? senderName + ' mentioned you in ' + data.groupName
          : data.content;
        var notifTitle = data.type === 'group'
          ? 'Ouba - ' + data.groupName
          : 'Ouba - ' + senderName;
        new Notification(notifTitle, {
          body: notifBody,
          icon: data.sender && data.sender.profilePic ? data.sender.profilePic : '/favicon.ico'
        });
      }
    });
  } catch (e) {
    console.error('Socket init error:', e);
  }
})();
