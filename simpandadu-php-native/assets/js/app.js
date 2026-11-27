/**
 * SIMPANDADU - JavaScript Interaktif (Vanilla JS)
 */
(function () {
  'use strict';

  // 1. Sidebar Mobile Toggle
  var mobileBtn = document.getElementById('mobileMenuBtn');
  var sidebar = document.getElementById('appSidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', function (ev) {
      if (
        sidebar.classList.contains('open') &&
        !sidebar.contains(ev.target) &&
        !mobileBtn.contains(ev.target)
      ) {
        sidebar.classList.remove('open');
      }
    });
  }

  // 2. Toggle Tampil / Sembunyikan Password
  document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-toggle-password');
      var input = document.getElementById(targetId);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Sembunyikan';
      } else {
        input.type = 'password';
        btn.textContent = 'Tampilkan';
      }
    });
  });

  // 3. Lonceng Notifikasi Keamanan Header
  var bellBtn = document.getElementById('notifBellBtn');
  var notifDropdown = document.getElementById('notifDropdown');
  var notifList = document.getElementById('notifList');
  var notifBadge = document.getElementById('notifBadge');
  var markAllBtn = document.getElementById('notifMarkAllBtn');

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fetchNotifications() {
    if (!notifList) return;
    fetch('api/notifications.php', { credentials: 'same-origin' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.notifications)) return;
        if (notifBadge) {
          if (data.unreadCount > 0) {
            notifBadge.textContent = data.unreadCount > 99 ? '99+' : String(data.unreadCount);
            notifBadge.style.display = 'inline-flex';
          } else {
            notifBadge.style.display = 'none';
          }
        }
        notifList.textContent = '';
        if (data.notifications.length === 0) {
          var emptyDiv = document.createElement('div');
          emptyDiv.style.cssText = 'padding:20px;text-align:center;color:#64748b;font-size:13px;';
          emptyDiv.textContent = 'Belum ada notifikasi keamanan.';
          notifList.appendChild(emptyDiv);
          return;
        }
        data.notifications.forEach(function (n) {
          var item = document.createElement('div');
          item.className = 'notif-item' + (n.isRead ? '' : ' unread');
          item.setAttribute('data-notif-id', String(n.id || ''));

          var titleEl = document.createElement('div');
          titleEl.style.cssText = 'font-weight:700;font-size:13px;color:#0b1f3a;';
          if (!n.isRead) {
            var dot = document.createElement('span');
            dot.style.cssText = 'display:inline-block;width:7px;height:7px;border-radius:50%;background:#1d4ed8;margin-right:6px;';
            titleEl.appendChild(dot);
          }
          titleEl.appendChild(document.createTextNode(String(n.title || '')));

          var msgEl = document.createElement('div');
          msgEl.style.cssText = 'font-size:12.5px;color:#334155;margin-top:3px;';
          msgEl.textContent = String(n.message || '');

          var timeEl = document.createElement('div');
          timeEl.className = 'tabular-nums';
          timeEl.style.cssText = 'font-size:11px;color:#64748b;margin-top:4px;';
          timeEl.textContent = String(n.formattedTime || n.createdAt || '');

          item.appendChild(titleEl);
          item.appendChild(msgEl);
          item.appendChild(timeEl);
          notifList.appendChild(item);
        });

        notifList.querySelectorAll('[data-notif-id]').forEach(function (item) {
          item.addEventListener('click', function () {
            var id = item.getAttribute('data-notif-id');
            var csrf = document.querySelector('meta[name="csrf-token"]');
            fetch('api/notifications.php', {
              method: 'POST',
              credentials: 'same-origin',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf ? csrf.getAttribute('content') : '',
              },
              body: JSON.stringify({ action: 'read', id: id }),
            }).then(fetchNotifications);
          });
        });
      })
      .catch(function () {});
  }

  if (bellBtn && notifDropdown) {
    bellBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      notifDropdown.classList.toggle('open');
      if (notifDropdown.classList.contains('open')) {
        fetchNotifications();
      }
    });
    document.addEventListener('click', function (ev) {
      if (!notifDropdown.contains(ev.target) && !bellBtn.contains(ev.target)) {
        notifDropdown.classList.remove('open');
      }
    });
    if (markAllBtn) {
      markAllBtn.addEventListener('click', function () {
        var csrf = document.querySelector('meta[name="csrf-token"]');
        fetch('api/notifications.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf ? csrf.getAttribute('content') : '',
          },
          body: JSON.stringify({ action: 'read_all' }),
        }).then(fetchNotifications);
      });
    }
    setInterval(fetchNotifications, 25000);
  }

  // 4. Modal Buka / Tutup Generik
  window.openModalById = function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('open');
  };
  window.closeModalById = function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('open');
  };
  document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) {
        backdrop.classList.remove('open');
      }
    });
  });

  // 5. Grafik Batang Kondisi Aset pada Canvas Dashboard
  var chartCanvas = document.getElementById('assetConditionChart');
  if (chartCanvas && chartCanvas.getContext) {
    var ctx = chartCanvas.getContext('2d');
    var baik = Number(chartCanvas.getAttribute('data-baik') || 0);
    var perbaikan = Number(chartCanvas.getAttribute('data-perbaikan') || 0);
    var rusak = Number(chartCanvas.getAttribute('data-rusak') || 0);
    var items = [
      { label: 'Baik', val: baik, color: '#15803d' },
      { label: 'Perlu Perbaikan', val: perbaikan, color: '#d97706' },
      { label: 'Rusak Berat', val: rusak, color: '#b91c1c' },
    ];
    var w = chartCanvas.width;
    var h = chartCanvas.height;
    var maxVal = Math.max(baik, perbaikan, rusak, 1);
    ctx.clearRect(0, 0, w, h);

    var padBottom = 38;
    var padTop = 26;
    var barAreaH = h - padBottom - padTop;
    var slotW = w / items.length;

    items.forEach(function (it, idx) {
      var barW = Math.min(72, slotW * 0.5);
      var barH = (it.val / maxVal) * barAreaH;
      var x = idx * slotW + (slotW - barW) / 2;
      var y = padTop + (barAreaH - barH);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(x, padTop, barW, barAreaH);

      ctx.fillStyle = it.color;
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(it.val), x + barW / 2, y - 7);

      ctx.fillStyle = '#475569';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(it.label, x + barW / 2, h - 14);
    });
  }
})();
