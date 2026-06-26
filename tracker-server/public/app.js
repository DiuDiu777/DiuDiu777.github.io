// Visitor Stats Dashboard - app.js
(function () {
  'use strict';

  var API_BASE = '';
  var TOKEN = localStorage.getItem('visitor_stats_token') || '';
  var currentPeriod = 'day';

  // ---- Auth ----
  window.authenticate = function () {
    var input = document.getElementById('tokenInput');
    var errEl = document.getElementById('authError');
    TOKEN = input.value.trim();
    if (!TOKEN) {
      errEl.textContent = 'Please enter a token.';
      return;
    }
    // Test the token
    fetch(API_BASE + '/api/stats/summary?token=' + encodeURIComponent(TOKEN))
      .then(function (r) {
        if (!r.ok) throw new Error('Invalid token or server error');
        return r.json();
      })
      .then(function () {
        localStorage.setItem('visitor_stats_token', TOKEN);
        document.getElementById('authBox').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        refreshAll();
      })
      .catch(function (e) {
        errEl.textContent = 'Authentication failed: ' + e.message;
        localStorage.removeItem('visitor_stats_token');
        TOKEN = '';
      });
  };

  // ---- Data fetching ----
  function fetchStats() {
    return fetch(API_BASE + '/api/stats/summary?token=' + encodeURIComponent(TOKEN))
      .then(function (r) { return r.json(); });
  }

  function fetchPages() {
    return fetch(API_BASE + '/api/stats/pages?token=' + encodeURIComponent(TOKEN))
      .then(function (r) { return r.json(); });
  }

  function fetchVisitors() {
    return fetch(API_BASE + '/api/stats/visitors?token=' + encodeURIComponent(TOKEN) + '&limit=50')
      .then(function (r) { return r.json(); });
  }

  function fetchTimeline(period) {
    return fetch(API_BASE + '/api/stats/timeline?token=' + encodeURIComponent(TOKEN) + '&period=' + period)
      .then(function (r) { return r.json(); });
  }

  // ---- Render ----
  function renderCards(summary) {
    document.getElementById('cards').innerHTML =
      '<div class="card"><div class="number">' + (summary.total_visits || 0) + '</div><div class="label">Total Visits</div></div>' +
      '<div class="card"><div class="number">' + (summary.unique_ips || 0) + '</div><div class="label">Unique IPs (All Time)</div></div>' +
      '<div class="card"><div class="number">' + (summary.visits_today || 0) + '</div><div class="label">Visits Today</div></div>' +
      '<div class="card"><div class="number">' + (summary.unique_ips_today || 0) + '</div><div class="label">Unique IPs Today</div></div>';
  }

  function renderChart(timeline) {
    var trace = {
      x: timeline.labels,
      y: timeline.visits,
      type: 'scatter',
      mode: 'lines+markers',
      marker: { color: '#1a1a2e', size: 6 },
      line: { shape: 'spline', smoothing: 0.6, width: 2, color: '#1a1a2e' },
      fill: 'tozeroy',
      fillcolor: 'rgba(26, 26, 46, 0.08)'
    };
    var layout = {
      margin: { l: 40, r: 20, t: 10, b: 40 },
      xaxis: {
        tickfont: { size: 11 },
        gridcolor: '#f0f0f0',
        tickangle: timeline.period === 'hour' ? -45 : 0
      },
      yaxis: {
        tickfont: { size: 11 },
        gridcolor: '#f0f0f0',
        rangemode: 'tozero'
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    };
    Plotly.newPlot('chart', [trace], layout, { displayModeBar: false, responsive: true });
  }

  function renderPages(pages) {
    var html = '';
    if (!pages || pages.length === 0) {
      html = '<tr><td colspan="4" style="text-align:center;color:#aaa;">No data yet</td></tr>';
    } else {
      pages.forEach(function (p) {
        html += '<tr>' +
          '<td><code>' + esc(p.page_path) + '</code></td>' +
          '<td class="count">' + p.count + '</td>' +
          '<td class="count">' + p.unique_ips + '</td>' +
          '<td class="time-cell">' + (p.last_visit || '-') + '</td>' +
          '</tr>';
      });
    }
    document.getElementById('pagesTable').innerHTML = html;
  }

  function renderVisitors(visitors) {
    var html = '';
    if (!visitors || visitors.length === 0) {
      html = '<tr><td colspan="4" style="text-align:center;color:#aaa;">No data yet</td></tr>';
    } else {
      visitors.forEach(function (v) {
        html += '<tr>' +
          '<td><code>' + esc(v.ip_prefix) + '</code></td>' +
          '<td><code>' + esc(v.page_path) + '</code></td>' +
          '<td class="ua-cell" title="' + escAttr(v.user_agent || '') + '">' + esc(truncateUA(v.user_agent)) + '</td>' +
          '<td class="time-cell">' + (v.timestamp || '-') + '</td>' +
          '</tr>';
      });
    }
    document.getElementById('visitorsTable').innerHTML = html;
  }

  // ---- Helpers ----
  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function truncateUA(ua) {
    if (!ua) return '-';
    // Try to extract only the meaningful part (browser + OS)
    var match = ua.match(/\((.*?)\)/);
    if (match) {
      var after = ua.slice(ua.indexOf(')') + 1).trim();
      var firstSpace = after.indexOf(' ');
      return (firstSpace > 0 ? after.slice(0, firstSpace + 15) : after.slice(0, 30)) + '...';
    }
    return ua.slice(0, 40) + '...';
  }

  // ---- Actions ----
  window.switchPeriod = function (period) {
    currentPeriod = period;
    document.getElementById('btnDay').className = period === 'day' ? 'active' : '';
    document.getElementById('btnHour').className = period === 'hour' ? 'active' : '';
    fetchTimeline(period).then(renderChart).catch(function (e) { console.error(e); });
  };

  window.refreshAll = function () {
    if (!TOKEN) return;
    fetchStats()
      .then(function (data) { renderCards(data); return fetchPages(); })
      .then(function (data) { renderPages(data); return fetchVisitors(); })
      .then(function (data) { renderVisitors(data); return fetchTimeline(currentPeriod); })
      .then(function (data) { renderChart(data); })
      .catch(function (e) {
        console.error('Refresh error:', e);
        // If token expired/invalid, show auth again
        if (e.message && e.message.indexOf('401') !== -1) {
          localStorage.removeItem('visitor_stats_token');
          TOKEN = '';
          document.getElementById('authBox').style.display = 'block';
          document.getElementById('dashboard').style.display = 'none';
        }
      });
  };

  // ---- Init ----
  if (TOKEN) {
    // Try auto-login with saved token
    fetch(API_BASE + '/api/stats/summary?token=' + encodeURIComponent(TOKEN))
      .then(function (r) {
        if (!r.ok) throw new Error('invalid');
        return r.json();
      })
      .then(function () {
        document.getElementById('authBox').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        refreshAll();
      })
      .catch(function () {
        localStorage.removeItem('visitor_stats_token');
        TOKEN = '';
      });
  }

  // Enter key on token input
  document.getElementById('tokenInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') authenticate();
  });
})();
