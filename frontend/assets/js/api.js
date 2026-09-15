/* SecureLab — fetch wrapper + auth token storage. Everything else depends on this file. */
(function () {
  'use strict';

  var API_BASE = ''; // same-origin
  var TOKEN_KEY = 'securelab_auth_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token, remember) {
    clearToken();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  async function apiRequest(path, options) {
    options = options || {};
    var method = options.method || 'GET';
    var body = options.body;
    var headers = options.headers || {};

    var token = getToken();
    var finalHeaders = Object.assign({ Accept: 'application/json' }, headers);
    if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
    if (token) finalHeaders['Authorization'] = 'Bearer ' + token;

    var response;
    try {
      response = await fetch(API_BASE + path, {
        method: method,
        headers: finalHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
    }

    var text = await response.text();
    var data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      if (response.status === 401 && path !== '/api/auth/login') {
        clearToken();
        if (!location.pathname.endsWith('login.html')) location.replace('login.html');
      }
      var message = data.message || data.hata || data.error ||
        (response.status === 403 ? 'Bu işlem için yetkiniz bulunmuyor.' : 'İşlem gerçekleştirilemedi.');
      var err = new Error(message);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  /**
   * Ensures the current page has a valid session.
   * On success resolves with the user object; on failure clears the token
   * and redirects to login.html.
   */
  async function requireAuth() {
    try {
      var res = await apiRequest('/api/auth/me');
      return res.user;
    } catch (e) {
      clearToken();
      if (!location.pathname.endsWith('login.html')) location.replace('login.html');
      return null;
    }
  }

  window.SecureAPI = {
    apiRequest: apiRequest,
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    requireAuth: requireAuth
  };
})();
