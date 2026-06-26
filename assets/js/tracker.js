/**
 * DiuDiu777 Visitor Tracker
 * Lightweight, non-blocking page visit tracking.
 * Sends page_path, referrer, and user_agent to the tracking backend.
 */
(function () {
  'use strict';

  var BACKEND_URL = window.VISITOR_TRACKER_URL;
  if (!BACKEND_URL) return;

  // Remove trailing slash from backend URL
  BACKEND_URL = BACKEND_URL.replace(/\/+$/, '');

  var data = {
    page_path: window.location.pathname || '/',
    referrer: document.referrer || '',
    user_agent: navigator.userAgent ? navigator.userAgent.slice(0, 500) : ''
  };

  // Use sendBeacon for reliable, non-blocking delivery
  if (navigator.sendBeacon) {
    var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    navigator.sendBeacon(BACKEND_URL + '/api/track', blob);
  } else {
    // Fallback: fetch with keepalive
    fetch(BACKEND_URL + '/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true
    }).catch(function () {
      // Silently ignore errors - tracking should never break the page
    });
  }
})();
