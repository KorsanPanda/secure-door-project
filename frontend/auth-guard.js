(() => {
    const tokenKey = 'securelab_auth_token';
    document.documentElement.classList.add('auth-pending');

    const token = sessionStorage.getItem(tokenKey)
        || localStorage.getItem(tokenKey);

    if (!token) {
        window.location.replace('login.html');
    }
})();
