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
        subscribePush(userId);
        setTimeout(function() { if (window.updateNotifButton) updateNotifButton(); }, 2000);
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
          icon: data.sender && data.sender.profilePic ? data.sender.profilePic : '/img/icon-192.png'
        });
      }
    });

    async function subscribePush(userId) {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      if (!('Notification' in window) || Notification.permission === 'denied') return;
      if (Notification.permission === 'default') {
        var perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      }
      try {
        var reg = await navigator.serviceWorker.ready;
        var resp = await fetch('/vapid-public-key');
        var data = await resp.json();
        if (!data.publicKey) { console.warn('No VAPID key'); return; }
        var savedKey = localStorage.getItem('vapid-public-key');
        if (savedKey !== data.publicKey) {
          var oldSub = await reg.pushManager.getSubscription();
          if (oldSub) {
            try {
              await fetch('/push-unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: oldSub.endpoint })
              });
            } catch (_) {}
            await oldSub.unsubscribe();
          }
          localStorage.removeItem('push-subscribed');
        }
        if (localStorage.getItem('push-subscribed') === 'true') return;
        var sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey)
        });
        await fetch('/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys })
        });
        localStorage.setItem('push-subscribed', 'true');
        localStorage.setItem('vapid-public-key', data.publicKey);
        if (window.updateNotifButton) window.updateNotifButton();
        console.log('Push subscribed successfully');
      } catch (e) {
        console.warn('Push subscription failed:', e);
      }
    }

    function urlBase64ToUint8Array(base64String) {
      var padding = '='.repeat((4 - base64String.length % 4) % 4);
      var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      var rawData = window.atob(base64);
      var output = new Uint8Array(rawData.length);
      for (var i = 0; i < rawData.length; ++i) {
        output[i] = rawData.charCodeAt(i);
      }
      return output;
    }

    window.toggleNotifications = async function () {
      if (!('Notification' in window)) { alert('Notifications not supported'); return; }
      if (Notification.permission === 'denied') {
        alert('Notifications are blocked. Enable them in Settings > Safari > Notifications');
        return;
      }
      if (Notification.permission === 'default') {
        var perm = await Notification.requestPermission();
        if (perm !== 'granted') { alert('Permission denied'); return; }
      }
      try {
        var reg = await navigator.serviceWorker.ready;
        var resp = await fetch('/vapid-public-key');
        var data = await resp.json();
        if (!data.publicKey) { alert('Server not ready for push yet'); return; }
        var sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey)
        });
        await fetch('/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys })
        });
        localStorage.setItem('push-subscribed', 'true');
        localStorage.setItem('vapid-public-key', data.publicKey);
        if (window.updateNotifButton) window.updateNotifButton();
        console.log('Push subscribed from button');
      } catch (e) {
        console.warn('Manual subscribe failed:', e);
        alert('Failed to enable notifications: ' + e.message);
      }
    };

    var installPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      installPrompt = e;
    });

    window.addEventListener('appinstalled', function () {
      installPrompt = null;
      localStorage.setItem('pwa-dismissed', '1');
    });

    window.installApp = function () {
      if (installPrompt) {
        installPrompt.prompt();
        return;
      }
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        alert('Tap Share icon \u2192 scroll down \u2192 tap "Add to Home Screen"');
      } else {
        alert('Open browser menu \u2192 "Add to Home Screen" or "Install App"');
      }
    };
  } catch (e) {
    console.error('Socket init error:', e);
  }
})();
