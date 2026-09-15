const API_CONFIG = Object.freeze({
    baseUrl: ''
});

const AUTH_TOKEN_KEY = 'securelab_auth_token';
const appState = {
    currentUser: null,
    kullanicilar: [],
    kartlar: [],
    kapilar: [],
    yetkilendirmeler: [],
    bekleyenKartlar: []
};

const tableViewStates = new Map();
const TABLE_FILTER_CONFIG = Object.freeze({
    'dashboard-access-table': {
        searchPlaceholder: 'Kullanıcı, kart UID veya kapı ara',
        hasDate: true,
        pageSize: 10,
        filters: [
            { key: 'role', label: 'Rol', column: 2 },
            { key: 'method', label: 'Yöntem', column: 3 },
            { key: 'door', label: 'Kapı', column: 4 },
            { key: 'status', label: 'Sonuç', column: 5 }
        ]
    },
    'admin-access-table': {
        searchPlaceholder: 'Kullanıcı veya yöntem ara',
        hasDate: true,
        pageSize: 10,
        filters: [
            { key: 'role', label: 'Rol', column: 2 },
            { key: 'method', label: 'Yöntem', column: 3 },
            { key: 'status', label: 'Sonuç', column: 4 }
        ]
    },
    'admin-users-table': {
        searchPlaceholder: 'Ad, e-posta veya hesap durumu ara',
        hasDate: false,
        pageSize: 10,
        filters: [
            { key: 'role', label: 'Rol', column: 2 },
            { key: 'status', label: 'Hesap durumu', column: 3 }
        ]
    },
    'history-access-table': {
        searchPlaceholder: 'Kullanıcı, kart UID veya kapı ara',
        hasDate: true,
        pageSize: 20,
        filters: [
            { key: 'role', label: 'Rol', column: 2 },
            { key: 'method', label: 'Yöntem', column: 3 },
            { key: 'door', label: 'Kapı', column: 4 },
            { key: 'status', label: 'Sonuç', column: 5 }
        ]
    },
    'authorized-users-table': {
        searchPlaceholder: 'Kullanıcı veya kart UID ara',
        hasDate: false,
        pageSize: 10,
        filters: [
            { key: 'role', label: 'Rol', column: 1 },
            { key: 'cardStatus', label: 'Kart durumu', column: 1 },
            { key: 'status', label: 'Yetki durumu', column: 4 }
        ]
    },
    'fault-records-table': {
        searchPlaceholder: 'Arıza açıklaması veya kullanıcı ara',
        hasDate: true,
        pageSize: 10,
        filters: [
            { key: 'issueType', label: 'Arıza türü', column: 1 },
            { key: 'status', label: 'Durum', column: 3 }
        ]
    }
});

class ApiError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

function getAuthToken() {
    return sessionStorage.getItem(AUTH_TOKEN_KEY)
        || localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token, persist = false) {
    if (typeof token !== 'string' || !token.trim()) {
        throw new Error('Geçerli bir oturum anahtarı alınamadı.');
    }

    const selectedStorage = persist ? localStorage : sessionStorage;
    const unusedStorage = persist ? sessionStorage : localStorage;
    unusedStorage.removeItem(AUTH_TOKEN_KEY);
    selectedStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    appState.currentUser = null;
}

function buildAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function redirectToLogin() {
    if (!window.location.pathname.endsWith('/login.html')) {
        window.location.replace('login.html');
    }
}

function revealAuthenticatedPage() {
    document.documentElement.classList.remove('auth-pending');
}

async function apiRequest(endpoint, options = {}) {
    const requestOptions = { ...options };
    const headers = new Headers(options.headers || {});
    const tokenHeaders = buildAuthHeaders();

    Object.entries(tokenHeaders).forEach(([name, value]) => headers.set(name, value));

    if (requestOptions.body && !(requestOptions.body instanceof FormData) && typeof requestOptions.body !== 'string') {
        headers.set('Content-Type', 'application/json');
        requestOptions.body = JSON.stringify(requestOptions.body);
    }

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }

    requestOptions.headers = headers;

    let response;
    try {
        response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, requestOptions);
    } catch (error) {
        throw new ApiError('Backend bağlantısı kurulamadı. Servisin çalıştığını kontrol edin.', 0);
    }

    const responseText = await response.text();
    let responseData = null;

    if (responseText) {
        try {
            responseData = JSON.parse(responseText);
        } catch (error) {
            if (!response.ok) {
                throw new ApiError('Sunucudan geçersiz bir hata yanıtı alındı.', response.status);
            }
            throw new ApiError('Sunucudan beklenen JSON yanıtı alınamadı.', response.status);
        }
    }

    if (!response.ok) {
        const message = responseData?.message
            || responseData?.hata
            || responseData?.error
            || (response.status === 403
                ? 'Bu işlem için yetkiniz bulunmuyor.'
                : 'İstek tamamlanamadı.');

        if (response.status === 401 && endpoint !== '/api/auth/login') {
            clearAuthToken();
            redirectToLogin();
        }

        throw new ApiError(message, response.status, responseData);
    }

    return responseData;
}

function handleApiError(error) {
    if (error instanceof ApiError) {
        if (error.status === 403) return 'Bu işlem için yetkiniz bulunmuyor.';
        if (error.status >= 500) return 'Sunucuda bir sorun oluştu. Lütfen daha sonra tekrar deneyin.';
        return error.message;
    }

    return 'Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.';
}

function getStateCell(container) {
    if (!(container instanceof HTMLTableSectionElement)) return container;

    const row = document.createElement('tr');
    row.className = 'integration-state-row';
    const cell = document.createElement('td');
    const table = container.closest('table');
    cell.colSpan = table?.querySelectorAll('thead th').length || 1;
    row.appendChild(cell);
    container.replaceChildren(row);
    return cell;
}

function showLoading(container) {
    if (!container) return;
    const target = getStateCell(container);
    target.className = 'api-state integration-loading';
    target.replaceChildren();
    const skeleton = createElement('div', 'table-skeleton');
    for (let index = 0; index < 3; index += 1) {
        const row = createElement('div', 'skeleton-row');
        row.append(
            createElement('span', 'skeleton-block skeleton-wide'),
            createElement('span', 'skeleton-block'),
            createElement('span', 'skeleton-block skeleton-short')
        );
        skeleton.appendChild(row);
    }
    const label = createElement('span', 'sr-only', 'Veriler yükleniyor');
    target.append(skeleton, label);
}

function showEmpty(container, message = 'Kayıt bulunamadı.') {
    if (!container) return;
    const target = getStateCell(container);
    target.className = 'api-state integration-empty';
    target.replaceChildren();
    const state = createElement('div', 'empty-state-panel');
    state.append(
        createElement('span', 'empty-state-symbol', '○'),
        createElement('strong', '', message),
        createElement('span', '', 'Yeni kayıt oluştuğunda burada görüntülenecek.')
    );
    target.appendChild(state);
}

function showError(container, message) {
    if (!container) return;
    const target = getStateCell(container);
    target.className = 'api-state form-message-error integration-error';
    target.replaceChildren();
    const permissionDenied = /yetki|izin/i.test(String(message || ''));
    const state = createElement('div', permissionDenied ? 'permission-state-panel' : 'error-state-panel');
    state.append(
        createElement('span', 'empty-state-symbol', permissionDenied ? '⌁' : '!'),
        createElement('strong', '', permissionDenied
            ? 'Bu alanı görüntüleme yetkiniz bulunmuyor'
            : 'Veriler şu anda yüklenemiyor'),
        createElement('span', '', permissionDenied
            ? 'Bu işlem için bir yöneticiyle iletişime geçebilirsiniz.'
            : 'Bağlantınızı kontrol edip tekrar deneyin.')
    );
    if (!permissionDenied) {
        const retry = createElement('button', 'btn-secondary btn-sm', 'Tekrar Dene');
        retry.type = 'button';
        retry.addEventListener('click', () => window.location.reload());
        state.appendChild(retry);
    }
    target.appendChild(state);
    target.hidden = false;
}

function renderEmptyState(container, message) {
    showEmpty(container, message);
}

function renderErrorState(container, message) {
    showError(container, message);
}

function renderPermissionState(container) {
    showError(container, 'Bu alanı görüntüleme yetkiniz bulunmuyor.');
}

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function createBadge(text, variant = 'neutral') {
    return createElement('span', `badge badge-${variant}`, text);
}

const THEME_STORAGE_KEY = 'securelab-theme';

function getStoredTheme() {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
        return null;
    }
}

function getPreferredTheme() {
    const stored = getStoredTheme();
    if (stored === 'dark' || stored === 'light') return stored;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
}

function updateThemeToggleButtons(theme) {
    document.querySelectorAll('.theme-toggle').forEach((button) => {
        button.setAttribute('aria-pressed', String(theme === 'dark'));
        button.setAttribute('aria-label', theme === 'dark' ? 'Aydınlık moda geç' : 'Karanlık moda geç');
    });
}

function setTheme(theme) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, resolved);
    } catch (error) {
        /* localStorage kullanılamıyorsa tema yalnızca bu oturum için geçerli olur. */
    }
    updateThemeToggleButtons(resolved);
}

function initTheme() {
    setTheme(getPreferredTheme());
}

function createThemeToggleButton() {
    const button = createElement('button', 'theme-toggle');
    button.type = 'button';
    button.innerHTML = '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
    button.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        setTheme(isDark ? 'light' : 'dark');
    });
    return button;
}

function initThemeToggle() {
    if (document.querySelector('.theme-toggle')) {
        updateThemeToggleButtons(document.documentElement.getAttribute('data-theme'));
        return;
    }
    const topbar = document.querySelector('.topbar');
    const button = createThemeToggleButton();
    if (topbar) {
        const profile = topbar.querySelector('.topbar-profile');
        const systemPill = topbar.querySelector('.system-pill');
        if (profile) topbar.insertBefore(button, profile);
        else if (systemPill) topbar.insertBefore(button, systemPill.nextSibling);
        else topbar.appendChild(button);
    } else {
        button.classList.add('theme-toggle-floating');
        document.body.appendChild(button);
    }
    updateThemeToggleButtons(document.documentElement.getAttribute('data-theme'));
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = value;
    if (element.classList.contains('system-pill') || id.includes('system-state')) {
        const text = String(value || '').toLocaleLowerCase('tr-TR');
        element.dataset.state = /hata|ulaşılam|alınamad|bağlantı yok|yüklenemedi/.test(text)
            ? 'error'
            : /yüklen|bekliyor|kısmi/.test(text) ? 'warning' : 'success';
    }
}

function setInlineMessage(element, message = '', type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.className = `form-message form-message-${type}`;
    element.hidden = !message;
}

function normalizeDateValue(value) {
    const cleanedValue = String(value || '').trim().replace(/\s*\([^)]*\)\s*$/, '');
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanedValue);
    return isoDate ? `${isoDate[3]}.${isoDate[2]}.${isoDate[1]}` : cleanedValue;
}

function debounce(callback, wait = 180) {
    let timeoutId;
    return (...args) => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => callback(...args), wait);
    };
}

function escapeHTML(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML;
}

function createStatusBadge(text, variant = 'neutral') {
    return createBadge(text, variant);
}

function ensureToastRegion() {
    let region = document.getElementById('toast-region');
    if (region) return region;
    region = createElement('div', 'toast-region');
    region.id = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');
    document.body.appendChild(region);
    return region;
}

function showToast(message, type = 'info', duration = 4200) {
    if (!message) return null;
    const region = ensureToastRegion();
    const toast = createElement('div', `toast toast-${type}`);
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const icon = createElement('span', 'toast-icon', type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '!' : 'i');
    icon.setAttribute('aria-hidden', 'true');
    const content = createElement('div', 'toast-content');
    content.append(
        createElement('strong', '', type === 'success' ? 'İşlem tamamlandı' : type === 'error' ? 'İşlem tamamlanamadı' : type === 'warning' ? 'Dikkat' : 'Bilgilendirme'),
        createElement('span', '', message)
    );
    const closeButton = createElement('button', 'toast-close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Bildirimi kapat');
    const close = () => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 180);
    };
    closeButton.addEventListener('click', close);
    toast.append(icon, content, closeButton);
    region.appendChild(toast);
    window.setTimeout(close, duration);
    return toast;
}

function setButtonLoading(button, loading, label = 'İşleniyor…') {
    if (!button) return;
    if (loading) {
        button.dataset.originalLabel = button.textContent;
        button.disabled = true;
        button.classList.add('is-loading');
        button.textContent = label;
    } else {
        button.classList.remove('is-loading');
        button.disabled = false;
        if (button.dataset.originalLabel) {
            button.textContent = button.dataset.originalLabel;
            delete button.dataset.originalLabel;
        }
    }
}

function openModal({
    title = 'İşlemi onaylayın',
    message = '',
    confirmText = 'Onayla',
    cancelText = 'Vazgeç',
    variant = 'primary',
    detail = ''
} = {}) {
    return new Promise((resolve) => {
        const previousFocus = document.activeElement;
        const dialog = createElement('dialog', 'app-modal');
        dialog.setAttribute('aria-labelledby', 'app-modal-title');

        const panel = createElement('div', 'app-modal-panel');
        const header = createElement('div', 'app-modal-header');
        const titleGroup = createElement('div', 'app-modal-title-group');
        titleGroup.append(
            createElement('span', `app-modal-symbol app-modal-symbol-${variant}`, variant === 'danger' ? '!' : '✓'),
            createElement('h2', '', title)
        );
        titleGroup.querySelector('h2').id = 'app-modal-title';
        const closeButton = createElement('button', 'btn-icon modal-close', '×');
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Pencereyi kapat');
        header.append(titleGroup, closeButton);

        const body = createElement('div', 'app-modal-body');
        body.appendChild(createElement('p', '', message));
        if (detail) body.appendChild(createElement('p', 'modal-detail', detail));
        const actions = createElement('div', 'app-modal-actions');
        const cancelButton = createElement('button', 'btn-secondary', cancelText);
        cancelButton.type = 'button';
        const confirmButton = createElement('button', variant === 'danger' ? 'btn-danger' : 'btn-primary', confirmText);
        confirmButton.type = 'button';
        actions.append(cancelButton, confirmButton);
        panel.append(header, body, actions);
        dialog.appendChild(panel);
        document.body.appendChild(dialog);

        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            dialog.close();
            dialog.remove();
            if (previousFocus instanceof HTMLElement) previousFocus.focus();
            resolve(result);
        };
        closeButton.addEventListener('click', () => finish(false));
        cancelButton.addEventListener('click', () => finish(false));
        confirmButton.addEventListener('click', () => finish(true));
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            finish(false);
        });
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) finish(false);
        });
        dialog.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') return;
            const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')];
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
        dialog.showModal();
        confirmButton.focus();
    });
}

function closeModal(dialog, result = false) {
    if (dialog instanceof HTMLDialogElement) {
        dialog.returnValue = String(result);
        dialog.close();
    }
}

function parseTableDate(value) {
    const normalized = normalizeDateValue(value);
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(normalized);
    if (!match) return null;
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateRangeLabel(state) {
    if (!state.dateStart && !state.dateEnd) return 'Tarih';
    if (state.datePresetLabel) return state.datePresetLabel;
    const start = state.dateStart ? normalizeDateValue(state.dateStart) : 'Başlangıç';
    const end = state.dateEnd ? normalizeDateValue(state.dateEnd) : 'Bitiş';
    return start === end ? start : `${start} – ${end}`;
}

function getTableRows(table) {
    return [...(table?.querySelectorAll('tbody tr') || [])]
        .filter((row) => !row.classList.contains('integration-state-row') && !row.classList.contains('filter-empty-row'));
}

function getFilterValue(row, filter) {
    const datasetValue = row.dataset[filter.key];
    if (datasetValue) return datasetValue.trim();
    return row.cells[filter.column]?.textContent?.trim() || '';
}

function ensureFilterEmptyRow(table, message) {
    const tableBody = table.querySelector('tbody');
    let row = tableBody.querySelector('.filter-empty-row');
    if (!row) {
        row = createElement('tr', 'filter-empty-row');
        const cell = document.createElement('td');
        cell.colSpan = table.querySelectorAll('thead th').length || 1;
        const state = createElement('div', 'table-empty-state');
        state.append(
            createElement('span', 'table-empty-icon', '⌕'),
            createElement('strong', '', 'Filtreye uygun kayıt bulunamadı'),
            createElement('span', '', message || 'Filtreleri değiştirerek tekrar deneyin.')
        );
        cell.appendChild(state);
        row.appendChild(cell);
        tableBody.appendChild(row);
    }
    return row;
}

function populateTableSelectFilters(state) {
    const rows = getTableRows(state.table);
    state.config.filters.forEach((filter) => {
        const select = state.toolbar.querySelector(`[data-filter-key="${filter.key}"]`);
        if (!select) return;
        const currentValue = state.values[filter.key] || '';
        const values = [...new Set(rows.map((row) => getFilterValue(row, filter)).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'tr-TR'));
        const placeholder = createElement('option', '', filter.label);
        placeholder.value = '';
        const options = [placeholder];
        values.forEach((value) => {
            const option = createElement('option', '', value);
            option.value = value;
            options.push(option);
        });
        select.replaceChildren(...options);
        select.value = values.includes(currentValue) ? currentValue : '';
        state.values[filter.key] = select.value;
        select.hidden = values.length < 2;
    });
}

function createFilterChip(state, label, onRemove) {
    const chip = createElement('button', 'filter-chip');
    chip.type = 'button';
    chip.setAttribute('aria-label', `${label} filtresini kaldır`);
    chip.append(createElement('span', '', label), createElement('span', 'filter-chip-remove', '×'));
    chip.addEventListener('click', () => {
        onRemove();
        state.page = 1;
        applyTableView(state);
    });
    return chip;
}

function updateFilterChips(state) {
    const chips = [];
    if (state.search) {
        chips.push(createFilterChip(state, `Arama: ${state.search}`, () => {
            state.search = '';
            state.searchInput.value = '';
        }));
    }
    if (state.dateStart || state.dateEnd) {
        chips.push(createFilterChip(state, formatDateRangeLabel(state), () => {
            state.dateStart = '';
            state.dateEnd = '';
            state.datePresetLabel = '';
            if (state.sourceInput) state.sourceInput.value = '';
            if (state.dateButton) state.dateButton.querySelector('[data-date-label]').textContent = 'Tarih';
        }));
    }
    state.config.filters.forEach((filter) => {
        const value = state.values[filter.key];
        if (!value) return;
        chips.push(createFilterChip(state, `${filter.label}: ${value}`, () => {
            state.values[filter.key] = '';
            const select = state.toolbar.querySelector(`[data-filter-key="${filter.key}"]`);
            if (select) select.value = '';
        }));
    });

    state.chipList.replaceChildren(...chips);
    state.chipBar.hidden = !chips.length;
    state.toolbar.classList.toggle('has-active-filter', Boolean(chips.length));
}

function updatePagination(state, matchingCount) {
    const pageCount = Math.max(1, Math.ceil(matchingCount / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), pageCount);
    const start = matchingCount ? (state.page - 1) * state.pageSize + 1 : 0;
    const end = Math.min(state.page * state.pageSize, matchingCount);
    state.pagination.querySelector('[data-page-summary]').textContent = `${start}–${end} / ${matchingCount} kayıt`;
    state.pagination.querySelector('[data-page-number]').textContent = `Sayfa ${state.page} / ${pageCount}`;
    state.pagination.querySelector('[data-page-prev]').disabled = state.page <= 1;
    state.pagination.querySelector('[data-page-next]').disabled = state.page >= pageCount;
}

function applyTableView(state) {
    const rows = getTableRows(state.table);
    const normalizedSearch = state.search.toLocaleLowerCase('tr-TR');
    const startDate = state.dateStart ? new Date(`${state.dateStart}T00:00:00`) : null;
    const endDate = state.dateEnd ? new Date(`${state.dateEnd}T23:59:59`) : null;
    const matching = rows.filter((row) => {
        const searchText = (row.dataset.searchText || row.textContent || '').toLocaleLowerCase('tr-TR');
        if (normalizedSearch && !searchText.includes(normalizedSearch)) return false;
        if (startDate || endDate) {
            const rowDate = parseTableDate(row.dataset.date || row.cells[0]?.textContent);
            if (!rowDate || (startDate && rowDate < startDate) || (endDate && rowDate > endDate)) return false;
        }
        return state.config.filters.every((filter) => {
            const selected = state.values[filter.key];
            return !selected || getFilterValue(row, filter) === selected;
        });
    });

    updatePagination(state, matching.length);
    const startIndex = (state.page - 1) * state.pageSize;
    const pageRows = new Set(matching.slice(startIndex, startIndex + state.pageSize));
    rows.forEach((row) => {
        row.hidden = !pageRows.has(row);
    });
    const emptyRow = ensureFilterEmptyRow(state.table, state.sourceInput?.dataset.emptyMessage);
    emptyRow.hidden = matching.length !== 0 || rows.length === 0;

    const countElement = document.getElementById(state.sourceInput?.dataset.countTarget);
    if (countElement) countElement.textContent = `${matching.length} kayıt`;
    updateFilterChips(state);
}

function clearAllFilters(state) {
    state.search = '';
    state.dateStart = '';
    state.dateEnd = '';
    state.datePresetLabel = '';
    state.values = {};
    state.page = 1;
    state.searchInput.value = '';
    if (state.sourceInput) state.sourceInput.value = '';
    if (state.dateButton) state.dateButton.querySelector('[data-date-label]').textContent = 'Tarih';
    state.toolbar.querySelectorAll('[data-filter-key]').forEach((select) => {
        select.value = '';
    });
    applyTableView(state);
    state.searchInput.focus();
}

function closePopover(popover, trigger) {
    if (!popover) return;
    popover.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
}

function openPopover(popover, trigger) {
    document.querySelectorAll('.filter-popover:not([hidden])').forEach((item) => {
        if (item !== popover) closePopover(item, document.querySelector(`[aria-controls="${item.id}"]`));
    });
    popover.hidden = false;
    trigger?.setAttribute('aria-expanded', 'true');
}

function buildDateControl(state, actions) {
    const wrapper = createElement('div', 'filter-control filter-date-control');
    const button = createElement('button', 'filter-button');
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    const popoverId = `${state.table.id}-date-popover`;
    button.setAttribute('aria-controls', popoverId);
    const calendarIcon = createElement('span', 'filter-button-icon', '□');
    calendarIcon.setAttribute('aria-hidden', 'true');
    const label = createElement('span', '', 'Tarih');
    label.dataset.dateLabel = '';
    button.append(calendarIcon, label, createElement('span', 'filter-chevron', '⌄'));

    const popover = createElement('div', 'filter-popover date-filter-popover');
    popover.id = popoverId;
    popover.hidden = true;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Tarih aralığı seçin');
    const presets = createElement('div', 'date-presets');
    [
        ['Bugün', 0, 0],
        ['Dün', -1, -1],
        ['Son 7 Gün', -6, 0],
        ['Son 30 Gün', -29, 0]
    ].forEach(([text, startOffset, endOffset]) => {
        const preset = createElement('button', 'date-preset', text);
        preset.type = 'button';
        preset.addEventListener('click', () => {
            const today = new Date();
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + startOffset);
            const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + endOffset);
            state.dateStart = toLocalIsoDate(start);
            state.dateEnd = toLocalIsoDate(end);
            state.datePresetLabel = text;
            if (state.sourceInput) state.sourceInput.value = state.dateStart;
            label.textContent = text;
            state.page = 1;
            closePopover(popover, button);
            applyTableView(state);
        });
        presets.appendChild(preset);
    });
    [
        ['Bu Ay', 0],
        ['Geçen Ay', -1]
    ].forEach(([text, monthOffset]) => {
        const preset = createElement('button', 'date-preset', text);
        preset.type = 'button';
        preset.addEventListener('click', () => {
            const today = new Date();
            const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
            const last = monthOffset === 0
                ? today
                : new Date(today.getFullYear(), today.getMonth(), 0);
            state.dateStart = toLocalIsoDate(first);
            state.dateEnd = toLocalIsoDate(last);
            state.datePresetLabel = text;
            if (state.sourceInput) state.sourceInput.value = state.dateStart;
            label.textContent = text;
            state.page = 1;
            closePopover(popover, button);
            applyTableView(state);
        });
        presets.appendChild(preset);
    });

    const custom = createElement('div', 'custom-date-range');
    custom.appendChild(createElement('strong', '', 'Özel Aralık'));
    const fields = createElement('div', 'custom-date-fields');
    const startLabel = createElement('label', '', 'Başlangıç');
    const startInput = document.createElement('input');
    startInput.type = 'date';
    startInput.className = 'form-control';
    startLabel.appendChild(startInput);
    const endLabel = createElement('label', '', 'Bitiş');
    const endInput = document.createElement('input');
    endInput.type = 'date';
    endInput.className = 'form-control';
    endLabel.appendChild(endInput);
    fields.append(startLabel, endLabel);
    const customActions = createElement('div', 'custom-date-actions');
    const clearButton = createElement('button', 'btn-secondary btn-sm', 'Temizle');
    clearButton.type = 'button';
    const applyButton = createElement('button', 'btn-primary btn-sm', 'Uygula');
    applyButton.type = 'button';
    clearButton.addEventListener('click', () => {
        startInput.value = '';
        endInput.value = '';
        state.dateStart = '';
        state.dateEnd = '';
        state.datePresetLabel = '';
        if (state.sourceInput) state.sourceInput.value = '';
        label.textContent = 'Tarih';
        state.page = 1;
        closePopover(popover, button);
        applyTableView(state);
    });
    applyButton.addEventListener('click', () => {
        if (!startInput.value && !endInput.value) return;
        state.dateStart = startInput.value || endInput.value;
        state.dateEnd = endInput.value || startInput.value;
        if (state.dateStart > state.dateEnd) {
            [state.dateStart, state.dateEnd] = [state.dateEnd, state.dateStart];
        }
        state.datePresetLabel = '';
        if (state.sourceInput) state.sourceInput.value = state.dateStart;
        label.textContent = formatDateRangeLabel(state);
        state.page = 1;
        closePopover(popover, button);
        applyTableView(state);
    });
    customActions.append(clearButton, applyButton);
    custom.append(fields, customActions);
    popover.append(presets, custom);
    button.addEventListener('click', () => {
        if (popover.hidden) {
            startInput.value = state.dateStart;
            endInput.value = state.dateEnd;
            openPopover(popover, button);
            window.setTimeout(() => presets.querySelector('button')?.focus(), 0);
        } else {
            closePopover(popover, button);
        }
    });
    wrapper.append(button, popover);
    actions.appendChild(wrapper);
    state.dateButton = button;
}

function createPagination(state) {
    const pagination = createElement('div', 'table-pagination');
    const pageSizeWrap = createElement('label', 'page-size-control');
    pageSizeWrap.appendChild(createElement('span', '', 'Sayfa başına'));
    const pageSize = document.createElement('select');
    pageSize.className = 'compact-select';
    [10, 20, 50].forEach((size) => {
        const option = createElement('option', '', String(size));
        option.value = String(size);
        option.selected = size === state.pageSize;
        pageSize.appendChild(option);
    });
    pageSize.addEventListener('change', () => {
        state.pageSize = Number(pageSize.value);
        state.page = 1;
        applyTableView(state);
    });
    pageSizeWrap.appendChild(pageSize);
    const summary = createElement('span', 'pagination-summary', '0–0 / 0 kayıt');
    summary.dataset.pageSummary = '';
    const controls = createElement('div', 'pagination-controls');
    const previous = createElement('button', 'btn-icon btn-sm', '‹');
    previous.type = 'button';
    previous.dataset.pagePrev = '';
    previous.setAttribute('aria-label', 'Önceki sayfa');
    const number = createElement('span', 'page-number', 'Sayfa 1 / 1');
    number.dataset.pageNumber = '';
    const next = createElement('button', 'btn-icon btn-sm', '›');
    next.type = 'button';
    next.dataset.pageNext = '';
    next.setAttribute('aria-label', 'Sonraki sayfa');
    previous.addEventListener('click', () => {
        state.page -= 1;
        applyTableView(state);
    });
    next.addEventListener('click', () => {
        state.page += 1;
        applyTableView(state);
    });
    controls.append(previous, number, next);
    pagination.append(pageSizeWrap, summary, controls);
    const wrap = state.table.closest('.table-wrap');
    wrap?.insertAdjacentElement('afterend', pagination);
    state.pagination = pagination;
}

function enhanceTableToolbar(sourceInput) {
    const tableId = sourceInput.dataset.tableFilter;
    const table = document.getElementById(tableId);
    const config = TABLE_FILTER_CONFIG[tableId];
    const toolbar = sourceInput.closest('.table-toolbar');
    if (!table || !config || !toolbar || tableViewStates.has(tableId)) return;

    const state = {
        table,
        toolbar,
        sourceInput,
        config,
        search: '',
        dateStart: '',
        dateEnd: '',
        datePresetLabel: '',
        values: {},
        page: 1,
        pageSize: config.pageSize
    };

    const mainRow = createElement('div', 'filter-toolbar-main');
    const controls = createElement('div', 'filter-toolbar-controls');
    const searchWrap = createElement('div', 'toolbar-search');
    const searchIcon = createElement('span', 'toolbar-search-icon', '⌕');
    searchIcon.setAttribute('aria-hidden', 'true');
    const isTextSource = sourceInput.dataset.filterMode === 'text';
    const searchInput = isTextSource ? sourceInput : document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'toolbar-search-input';
    searchInput.placeholder = config.searchPlaceholder;
    searchInput.setAttribute('aria-label', config.searchPlaceholder);
    const searchClear = createElement('button', 'search-clear', '×');
    searchClear.type = 'button';
    searchClear.setAttribute('aria-label', 'Aramayı temizle');
    searchClear.hidden = true;
    searchWrap.append(searchIcon, searchInput, searchClear);
    controls.appendChild(searchWrap);
    state.searchInput = searchInput;

    if (!isTextSource) {
        sourceInput.classList.add('legacy-filter-source');
        sourceInput.tabIndex = -1;
    }
    if (config.hasDate) buildDateControl(state, controls);

    config.filters.forEach((filter) => {
        const select = document.createElement('select');
        select.className = 'filter-select';
        select.dataset.filterKey = filter.key;
        select.setAttribute('aria-label', `${filter.label} filtresi`);
        const option = createElement('option', '', filter.label);
        option.value = '';
        select.appendChild(option);
        select.addEventListener('change', () => {
            state.values[filter.key] = select.value;
            state.page = 1;
            applyTableView(state);
        });
        controls.appendChild(select);
    });

    const actions = createElement('div', 'filter-toolbar-actions');
    const countElement = document.getElementById(sourceInput.dataset.countTarget);
    if (countElement) {
        countElement.classList.add('table-count');
        actions.appendChild(countElement);
    }
    const refreshButton = createElement('button', 'btn-secondary btn-sm toolbar-refresh', 'Yenile');
    refreshButton.type = 'button';
    refreshButton.addEventListener('click', () => window.location.reload());
    const clearButton = createElement('button', 'btn-ghost btn-sm toolbar-clear-all', 'Tümünü Temizle');
    clearButton.type = 'button';
    clearButton.addEventListener('click', () => clearAllFilters(state));
    actions.append(refreshButton, clearButton);
    mainRow.append(controls, actions);

    const chipBar = createElement('div', 'active-filter-bar');
    chipBar.hidden = true;
    const chipList = createElement('div', 'active-filter-chips');
    const chipClear = createElement('button', 'chip-clear-all', 'Tümünü Temizle');
    chipClear.type = 'button';
    chipClear.addEventListener('click', () => clearAllFilters(state));
    chipBar.append(chipList, chipClear);
    state.chipBar = chipBar;
    state.chipList = chipList;

    toolbar.replaceChildren(mainRow, chipBar);
    if (!isTextSource) toolbar.appendChild(sourceInput);
    tableViewStates.set(tableId, state);
    createPagination(state);

    const applySearch = debounce(() => {
        state.search = searchInput.value.trim();
        searchClear.hidden = !state.search;
        state.page = 1;
        applyTableView(state);
    });
    searchInput.addEventListener('input', applySearch);
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        state.search = '';
        searchClear.hidden = true;
        state.page = 1;
        applyTableView(state);
        searchInput.focus();
    });
    populateTableSelectFilters(state);
    applyTableView(state);
}

function applyTableFilter(filterInput) {
    const state = tableViewStates.get(filterInput.dataset.tableFilter);
    if (!state) return;
    if (filterInput.dataset.filterMode === 'text') {
        state.search = filterInput.value.trim();
    } else if (filterInput.value) {
        state.dateStart = filterInput.value;
        state.dateEnd = filterInput.value;
    } else {
        state.dateStart = '';
        state.dateEnd = '';
    }
    applyTableView(state);
}

function initTableFilters() {
    document.querySelectorAll('[data-table-filter]').forEach(enhanceTableToolbar);
    document.addEventListener('click', (event) => {
        document.querySelectorAll('.filter-popover:not([hidden])').forEach((popover) => {
            const trigger = document.querySelector(`[aria-controls="${popover.id}"]`);
            if (!popover.contains(event.target) && !trigger?.contains(event.target)) {
                closePopover(popover, trigger);
            }
        });
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.filter-popover:not([hidden])').forEach((popover) => {
            const trigger = document.querySelector(`[aria-controls="${popover.id}"]`);
            closePopover(popover, trigger);
            trigger?.focus();
        });
    });
}

function refreshTableFilter(tableId) {
    const state = tableViewStates.get(tableId);
    if (!state) return;
    populateTableSelectFilters(state);
    applyTableView(state);
}

function createSidebarLink(item, currentPage) {
    const link = document.createElement('a');
    link.href = item.href;
    if (item.logout) link.classList.add('logout-link');
    if (item.admin) link.dataset.adminLink = '';
    const active = item.pages.includes(currentPage);
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', item.path);
    icon.appendChild(path);
    link.append(icon, createElement('span', '', item.label));
    return link;
}

function buildNavigation() {
    const navigation = createElement('nav', 'navbar');
    navigation.id = 'main-navigation';
    navigation.setAttribute('aria-label', 'Ana navigasyon');
    const brand = createElement('div', 'brand');
    const mark = createElement('span', 'brand-mark');
    mark.setAttribute('aria-hidden', 'true');
    const brandIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    brandIcon.setAttribute('viewBox', '0 0 24 24');
    brandIcon.setAttribute('fill', 'none');
    brandIcon.setAttribute('stroke', 'currentColor');
    const brandPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    brandPath.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4');
    brandIcon.appendChild(brandPath);
    mark.appendChild(brandIcon);
    const copy = createElement('div', 'brand-copy');
    copy.append(createElement('div', 'logo', 'SecureLab'), createElement('small', '', 'Erişim Yönetim Platformu'));
    brand.append(mark, copy);
    navigation.append(
        brand,
        createElement('div', 'nav-section-label', 'Yönetim'),
        createElement('div', 'nav-links')
    );
    const meta = createElement('div', 'sidebar-meta');
    const metaRow = createElement('div', 'sidebar-meta-row');
    metaRow.append(
        createElement('span', 'sidebar-avatar', 'SL'),
        (() => {
            const user = document.createElement('div');
            user.append(createElement('strong', '', 'Güvenli Oturum'), createElement('small', '', 'Kullanıcı'));
            return user;
        })()
    );
    meta.appendChild(metaRow);
    navigation.appendChild(meta);
    return navigation;
}

function normalizeStandaloneLayout() {
    const standalone = document.querySelector('body[data-page="issue-report"] > .standalone-page');
    if (!standalone) return;
    const existingChildren = [...standalone.children];
    const shell = createElement('div', 'app-shell');
    const navigation = buildNavigation();
    const backdrop = createElement('div', 'menu-backdrop');
    backdrop.setAttribute('aria-hidden', 'true');
    standalone.className = 'main-panel issue-report-panel';
    const topbar = createElement('header', 'topbar');
    const context = createElement('div', 'topbar-context');
    context.append(createElement('span', 'topbar-context-icon', '＋'), createElement('span', '', 'Teknik Destek / Yeni Bildirim'));
    const status = createElement('span', 'system-pill', 'Form hazır');
    status.id = 'issue-report-system-state';
    status.dataset.state = 'success';
    topbar.append(context, status);
    const container = createElement('div', 'container issue-report-container');
    existingChildren.forEach((child) => container.appendChild(child));
    standalone.append(topbar, container);
    shell.append(navigation, backdrop, standalone);
    document.body.replaceChildren(shell);
}

function normalizeNavigation() {
    normalizeStandaloneLayout();
    const navigation = document.querySelector('.navbar');
    if (!navigation) return;
    const brand = navigation.querySelector('.brand');
    if (brand && !brand.querySelector('.sidebar-close-button')) {
        const closeButton = createElement('button', 'sidebar-close-button');
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Menüyü kapat');
        closeButton.setAttribute('aria-controls', 'main-navigation');
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M18 6 6 18M6 6l12 12');
        icon.appendChild(path);
        closeButton.appendChild(icon);
        brand.appendChild(closeButton);
    }
    const currentPage = document.body.dataset.page || '';
    const links = navigation.querySelector('.nav-links') || createElement('div', 'nav-links');
    const items = [
        { label: 'Ana Sayfa', href: 'index.html', pages: ['dashboard'], path: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
        { label: 'Kullanıcılar', href: 'admin.html', pages: ['admin'], path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6', admin: true },
        { label: 'Geçici Şifre', href: 'gecici-sifre.html', pages: ['temporary-pin'], path: 'M7.5 10a5.5 5.5 0 1 0 5.5 5.5M12 11l8-8M15 6l3 3' },
        { label: 'Giriş Geçmişi', href: 'gecmis-girisler.html', pages: ['access-history'], path: 'M3 12a9 9 0 1 0 3-6.7L3 8V3m9 4v5l3 2' },
        { label: 'Yetkilendirme', href: 'yetkilendirme.html', pages: ['authorization'], path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 0 2 2 4-4', admin: true },
        { label: 'Arıza Geçmişi', href: 'ariza-gecmisi.html', pages: ['issue-history'], path: 'M14.7 6.3a4 4 0 0 0-5-5L7 4l3 3 2.7-2.7a4 4 0 0 0 2 2ZM5 8l-3 3 10 10 3-3' },
        { label: 'Hesabım', href: 'hesabim.html', pages: ['account'], path: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
        { label: 'Çıkış Yap', href: 'login.html', pages: [], path: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', logout: true }
    ];
    links.replaceChildren(...items.map((item) => createSidebarLink(item, currentPage)));
    if (!links.parentElement) navigation.appendChild(links);

    const topbar = document.querySelector('.topbar');
    if (topbar) {
        let menuToggle = document.querySelector('.menu-toggle');
        if (!menuToggle) {
            menuToggle = createElement('button', 'menu-toggle', '☰');
            menuToggle.type = 'button';
            menuToggle.setAttribute('aria-label', 'Menüyü aç');
            menuToggle.setAttribute('aria-controls', 'main-navigation');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
        menuToggle.classList.remove('floating-menu-toggle');
        topbar.prepend(menuToggle);
        if (!topbar.querySelector('.topbar-profile')) {
            const profile = createElement('a', 'topbar-profile');
            profile.href = 'hesabim.html';
            profile.setAttribute('aria-label', 'Hesabım sayfasına git');
            profile.append(
                createElement('span', 'topbar-profile-avatar', 'SL'),
                (() => {
                    const copy = createElement('span', 'topbar-profile-copy');
                    copy.append(createElement('strong', '', 'SecureLab'), createElement('small', '', 'Güvenli oturum'));
                    return copy;
                })()
            );
            topbar.appendChild(profile);
        }
    }
}

function updateAuthenticatedUserUi(user) {
    const name = `${user?.ad || ''} ${user?.soyad || ''}`.trim() || 'SecureLab Kullanıcısı';
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('tr-TR') || 'SL';
    document.querySelectorAll('.sidebar-meta-row, .topbar-profile').forEach((container) => {
        const strong = container.querySelector('strong');
        const small = container.querySelector('small');
        const avatar = container.querySelector('.sidebar-avatar, .topbar-profile-avatar');
        if (strong) strong.textContent = name;
        if (small) small.textContent = humanizeEnum(user?.rol);
        if (avatar) avatar.textContent = initials;
    });
}

function initNavigation() {
    const menuToggle = document.querySelector('.menu-toggle');
    const closeButton = document.querySelector('.sidebar-close-button');
    const menuBackdrop = document.querySelector('.menu-backdrop');
    const navigation = document.querySelector('.navbar');

    function setMenuState(isOpen) {
        document.body.classList.toggle('menu-open', isOpen);
        navigation?.setAttribute('aria-hidden', String(!isOpen && window.matchMedia('(max-width: 992px)').matches));
        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            menuToggle.setAttribute('aria-label', isOpen ? 'Menüyü kapat' : 'Menüyü aç');
        }
        menuBackdrop?.setAttribute('aria-hidden', String(!isOpen));
    }

    if (!menuToggle || !navigation) return;

    menuToggle.addEventListener('click', () => {
        setMenuState(!document.body.classList.contains('menu-open'));
    });
    closeButton?.addEventListener('click', (event) => {
        // .sidebar-close-button artık tıklanabilir .brand bağlantısının
        // içinde yer alıyor; tıklamanın ana sayfaya yönlendirmeyi de
        // tetiklemesini önlemek için olayın yukarı yayılmasını durduruyoruz.
        event.preventDefault();
        event.stopPropagation();
        setMenuState(false);
        menuToggle.focus();
    });
    menuBackdrop?.addEventListener('click', () => setMenuState(false));
    navigation.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMenuState(false));
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
            setMenuState(false);
            menuToggle.focus();
        }
    });
    window.addEventListener('resize', debounce(() => {
        if (window.matchMedia('(min-width: 993px)').matches) setMenuState(false);
    }, 100));
    setMenuState(false);
}

function initLogout() {
    document.querySelectorAll('.logout-link').forEach((link) => {
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                await apiRequest('/api/auth/logout', { method: 'POST' });
            } catch (error) {
                // Logout endpoint'i durum tutmuyor; yerel token her durumda temizlenir.
            } finally {
                clearAuthToken();
                window.location.assign('login.html');
            }
        });
    });
}

async function getCurrentUser() {
    const response = await apiRequest('/api/auth/me');
    if (!response?.user?.kullaniciId) {
        throw new ApiError('Oturum kullanıcı bilgisi doğrulanamadı.', 401);
    }
    appState.currentUser = response.user;
    return response.user;
}

async function requireAuthentication() {
    if (!getAuthToken()) {
        redirectToLogin();
        return false;
    }

    try {
        const user = await getCurrentUser();
        if (!enforceRoleAccess(user)) return false;
        revealAuthenticatedPage();
        return true;
    } catch (error) {
        clearAuthToken();
        redirectToLogin();
        return false;
    }
}

function getRoleDestination(role) {
    const destinations = {
        admin: 'admin.html',
        hoca: 'index.html',
        sistem: 'index.html'
    };
    return destinations[role] || null;
}

function enforceRoleAccess(user) {
    const role = user?.rol || '';
    const allowedRoles = String(document.body.dataset.roles || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    document.querySelectorAll('[data-admin-link], a[href="admin.html"], a[href="yetkilendirme.html"]').forEach((link) => {
        if (role !== 'admin') link.hidden = true;
    });
    updateAuthenticatedUserUi(user);

    document.querySelectorAll('.sidebar-meta-row').forEach((meta) => {
        const name = `${user?.ad || ''} ${user?.soyad || ''}`.trim();
        const strong = meta.querySelector('strong');
        const small = meta.querySelector('small');
        if (strong && name) strong.textContent = name;
        if (small) small.textContent = humanizeEnum(role);
    });

    if (allowedRoles.length && !allowedRoles.includes(role)) {
        const destination = getRoleDestination(role) || 'login.html';
        window.location.replace(`${destination}?yetki=reddedildi`);
        return false;
    }
    return true;
}

async function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const emailInput = document.getElementById('login-identity');
    const pinInput = document.getElementById('login-password');
    const submitButton = document.getElementById('login-submit');
    const message = document.getElementById('login-message');
    const forgotButton = document.getElementById('forgot-password-button');
    const passwordToggle = document.getElementById('password-toggle');
    const rememberInput = document.getElementById('login-remember');

    if (getAuthToken()) {
        try {
            const user = await getCurrentUser();
            const destination = getRoleDestination(user?.rol);
            if (destination) {
                window.location.replace(destination);
                return;
            }
        } catch (error) {
            clearAuthToken();
        }
    }

    forgotButton?.addEventListener('click', async () => {
        const eposta = emailInput.value.trim();
        if (!eposta) {
            setInlineMessage(message, 'Önce e-posta adresinizi yazın.', 'error');
            emailInput.focus();
            return;
        }

        forgotButton.disabled = true;
        setInlineMessage(message, 'Şifre yenileme bağlantısı hazırlanıyor…', 'info');
        try {
            const response = await apiRequest('/api/auth/forgot-password', {
                method: 'POST',
                body: { eposta }
            });
            setInlineMessage(message, response?.message || 'Şifre yenileme isteği alındı.', 'success');
            if (response?.resetUrl) {
                const link = createElement('a', 'form-message-link', 'Geliştirme ortamında şifreyi şimdi yenile');
                link.href = response.resetUrl;
                message.append(document.createElement('br'), link);
            }
        } catch (error) {
            setInlineMessage(message, handleApiError(error), 'error');
        } finally {
            forgotButton.disabled = false;
        }
    });

    passwordToggle?.addEventListener('click', () => {
        const willShow = pinInput.type === 'password';
        pinInput.type = willShow ? 'text' : 'password';
        passwordToggle.setAttribute('aria-pressed', String(willShow));
        passwordToggle.setAttribute('aria-label', willShow ? 'Şifreyi gizle' : 'Şifreyi göster');
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const eposta = emailInput.value.trim();
        const pin = pinInput.value;

        if (!eposta || !pin) {
            setInlineMessage(message, 'E-posta ve PIN / şifre alanları zorunludur.', 'error');
            return;
        }

        const originalContent = Array.from(submitButton.childNodes, (node) => node.cloneNode(true));
        submitButton.disabled = true;
        submitButton.textContent = 'Giriş yapılıyor…';
        setInlineMessage(message);

        try {
            const response = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: { eposta, pin }
            });

            const destination = getRoleDestination(response?.user?.rol);
            if (!response?.token || !destination) {
                throw new ApiError('Giriş yanıtındaki token veya rol bilgisi doğrulanamadı.');
            }

            setAuthToken(response.token, Boolean(rememberInput?.checked));
            window.location.assign(destination);
        } catch (error) {
            clearAuthToken();
            setInlineMessage(message, handleApiError(error), 'error');
            submitButton.disabled = false;
            submitButton.replaceChildren(...originalContent);
        }
    });
}

async function getKullanicilar() {
    return apiRequest('/api/kullanicilar');
}

async function getKullaniciOzeti() {
    return apiRequest('/api/kullanicilar/ozet');
}

async function createKullanici(payload) {
    return apiRequest('/api/kullanicilar', {
        method: 'POST',
        body: payload
    });
}

function initPasswordResetPage() {
    const form = document.getElementById('password-reset-form');
    const message = document.getElementById('password-reset-message');
    const submitButton = document.getElementById('password-reset-submit');
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!form || !submitButton) return;

    if (!token) {
        setInlineMessage(message, 'Şifre yenileme bağlantısı eksik veya geçersiz.', 'error');
        submitButton.disabled = true;
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const yeniSifre = String(formData.get('yeniSifre') || '');
        const yeniSifreTekrar = String(formData.get('yeniSifreTekrar') || '');
        if (yeniSifre !== yeniSifreTekrar) {
            setInlineMessage(message, 'Yeni şifreler eşleşmiyor.', 'error');
            return;
        }

        setButtonLoading(submitButton, true, 'Şifre yenileniyor…');
        try {
            const response = await apiRequest('/api/auth/reset-password', {
                method: 'POST',
                body: { token, yeniSifre, yeniSifreTekrar }
            });
            form.reset();
            clearAuthToken();
            setInlineMessage(message, response?.message || 'Şifreniz yenilendi.', 'success');
            const loginLink = createElement('a', 'form-message-link', 'Giriş sayfasına dön');
            loginLink.href = 'login.html?sifre=yenilendi';
            message.append(document.createElement('br'), loginLink);
            submitButton.hidden = true;
            window.history.replaceState({}, document.title, 'sifre-sifirla.html');
        } catch (error) {
            setInlineMessage(message, handleApiError(error), 'error');
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

async function deleteKullanici(kullaniciId) {
    return apiRequest(`/api/kullanicilar/${encodeURIComponent(kullaniciId)}`, {
        method: 'DELETE'
    });
}

async function getKapiSifreGecmisi(kullaniciId) {
    return apiRequest(`/api/kullanicilar/${encodeURIComponent(kullaniciId)}/pin-gecmisi`);
}

async function changeOwnWebPassword(payload) {
    return apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: payload
    });
}

function renderPinHistoryTable(tableId, payload) {
    const table = document.getElementById(tableId);
    const tableBody = table?.querySelector('tbody');
    if (!tableBody) return;
    const records = Array.isArray(payload?.kayitlar) ? payload.kayitlar : [];
    if (!records.length) {
        showEmpty(tableBody, 'Bu kullanıcı için henüz kaydedilmiş bir kapı şifresi bulunmuyor.');
        return;
    }

    const includeSource = tableId === 'account-pin-history-table';
    const fragment = document.createDocumentFragment();
    records.forEach((record) => {
        const row = document.createElement('tr');
        const pinCell = document.createElement('td');
        pinCell.appendChild(createElement('code', 'pin-history-code', record.pin || '••••••'));
        if (record.gizli) {
            pinCell.appendChild(createElement('span', 'cell-secondary', 'Geçiş öncesi güvenli kayıt'));
        }
        const statusCell = document.createElement('td');
        statusCell.appendChild(createBadge(record.durum || (record.aktif ? 'Güncel' : 'Geçmiş'), record.aktif ? 'success' : 'neutral'));
        const createdCell = createElement('td', 'cell-secondary', formatDateTime(record.olusturulma));
        const expiresCell = createElement(
            'td',
            'cell-secondary',
            record.gecerlilikBitis ? formatDateTime(record.gecerlilikBitis) : 'Süresiz'
        );
        row.append(pinCell, statusCell, createdCell, expiresCell);
        if (includeSource) {
            const sourceLabels = {
                manuel: 'Kullanıcı yenilemesi',
                otomatik: 'Günlük otomatik',
                yonetici: 'Yönetici oluşturması',
                baslangic: 'Başlangıç kaydı',
                eski_kayit: 'Geçiş öncesi kayıt'
            };
            row.appendChild(createElement('td', 'cell-secondary', sourceLabels[record.kaynak] || record.kaynak || 'Sistem'));
        }
        fragment.appendChild(row);
    });
    tableBody.replaceChildren(fragment);
}

function renderAdminUsers() {
    const tableBody = document.querySelector('#admin-users-table tbody');
    if (!tableBody) return;
    const users = appState.kullanicilar;
    setText('admin-users-count', `${users.length} kullanıcı`);
    if (!users.length) {
        showEmpty(tableBody, 'Henüz kayıtlı kullanıcı bulunmuyor.');
        return;
    }

    const sortedUsers = [...users].sort((left, right) => {
        if (left.rol === 'admin') return -1;
        if (right.rol === 'admin') return 1;
        return `${left.ad} ${left.soyad}`.localeCompare(`${right.ad} ${right.soyad}`, 'tr');
    });
    const fragment = document.createDocumentFragment();
    sortedUsers.forEach((user) => {
        const row = document.createElement('tr');
        const userName = `${user.ad || ''} ${user.soyad || ''}`.trim() || 'İsimsiz kullanıcı';
        row.dataset.role = humanizeEnum(user.rol);
        row.dataset.status = humanizeEnum(user.durum);
        row.dataset.searchText = `${userName} ${user.eposta || ''} ${row.dataset.role} ${row.dataset.status}`;

        const nameCell = document.createElement('td');
        nameCell.append(
            createElement('strong', 'cell-primary', userName),
            createElement('span', 'cell-secondary', user.rol === 'admin' ? 'Tek yönetici hesabı' : 'Standart kullanıcı')
        );
        const emailCell = createElement('td', 'cell-secondary', user.eposta || 'E-posta tanımlı değil');
        const roleCell = document.createElement('td');
        roleCell.appendChild(createBadge(humanizeEnum(user.rol), user.rol === 'admin' ? 'warning' : 'info'));
        const statusCell = document.createElement('td');
        statusCell.appendChild(createBadge(humanizeEnum(user.durum), user.durum === 'aktif' ? 'success' : 'danger'));
        const pinCell = document.createElement('td');
        const historyButton = createElement('button', 'btn-secondary btn-sm', 'Şifreleri Gör');
        historyButton.type = 'button';
        historyButton.dataset.userHistory = String(user.kullaniciId);
        historyButton.dataset.userName = userName;
        pinCell.appendChild(historyButton);

        const actionCell = document.createElement('td');
        if (user.rol === 'admin') {
            actionCell.appendChild(createElement('span', 'badge badge-neutral', 'Korunan hesap'));
        } else {
            const deleteButton = createElement('button', 'btn-danger btn-sm', 'Kullanıcıyı Sil');
            deleteButton.type = 'button';
            deleteButton.dataset.userDelete = String(user.kullaniciId);
            deleteButton.dataset.userName = userName;
            actionCell.appendChild(deleteButton);
        }
        row.append(nameCell, emailCell, roleCell, statusCell, pinCell, actionCell);
        fragment.appendChild(row);
    });
    tableBody.replaceChildren(fragment);
    refreshTableFilter('admin-users-table');
}

function renderKullanicilar(data) {
    appState.kullanicilar = Array.isArray(data) ? data : [];
    const activeUsers = appState.kullanicilar.filter((user) => user.durum === 'aktif').length;
    setText('admin-user-count', String(appState.kullanicilar.length));
    setText('admin-active-user-count', String(activeUsers));
    setText('admin-passive-user-count', String(appState.kullanicilar.length - activeUsers));
    setText('auth-user-count', String(appState.kullanicilar.length));
    setText('auth-user-count-badge', `${appState.kullanicilar.length} tanımlı kullanıcı`);
    setText('authorization-user-count', String(appState.kullanicilar.length));
    setText('admin-user-detail', `${appState.kullanicilar.length} kullanıcı backend’den alındı`);
    renderAdminUsers();

    const select = document.getElementById('auth-full-name');
    if (!select) return;

    const placeholder = createElement('option', '', appState.kullanicilar.length
        ? 'Kullanıcı seçin'
        : 'Kayıtlı kullanıcı bulunamadı');
    placeholder.value = '';
    select.replaceChildren(placeholder);

    appState.kullanicilar.forEach((user) => {
        const option = createElement('option', '', `${user.ad || ''} ${user.soyad || ''}`.trim());
        option.value = String(user.kullaniciId);
        option.dataset.role = user.rol || '';
        select.appendChild(option);
    });
}

async function getKartlar() {
    return apiRequest('/api/kartlar');
}

async function getOnayBekleyenKartlar() {
    const response = await apiRequest('/api/kartlar/onay-bekleyenler');
    return Array.isArray(response?.data) ? response.data : [];
}

function renderKartlar(data) {
    appState.kartlar = Array.isArray(data) ? data : [];
    setText('admin-card-count', String(appState.kartlar.length));
    setText('admin-card-detail', `${appState.kartlar.length} kart backend’den alındı`);

    const list = document.getElementById('rfid-card-options');
    if (!list) return;
    list.replaceChildren();
    appState.kartlar.forEach((card) => {
        const option = document.createElement('option');
        option.value = card.kartUid;
        option.label = card.durum || '';
        list.appendChild(option);
    });
}

async function getKapilar() {
    return apiRequest('/api/kapilar');
}

function renderKapilar(data) {
    const doors = Array.isArray(data) ? data : [];
    appState.kapilar = doors;
    const activeDoors = doors.filter((door) => door.durum === 'aktif');
    setText('admin-door-count', String(doors.length));
    setText('admin-door-state', doors.length ? `${activeDoors.length} aktif` : 'Kayıt yok');
    setText('admin-door-detail', doors.length
        ? `${doors.length} kapı kaydından ${activeDoors.length} tanesi aktif`
        : 'Backend kapı kaydı döndürmedi');
    setText('admin-door-status', doors[0]?.durum ? humanizeEnum(doors[0].durum) : 'Kayıt yok');
    setText('dashboard-door-value', String(doors.length));
    setText('dashboard-door-detail', doors.length
        ? `${activeDoors.length} kapı aktif`
        : 'Backend kapı kaydı döndürmedi');
    setText('dashboard-door-state', doors[0]?.durum ? humanizeEnum(doors[0].durum) : 'Kayıt yok');
}

async function getCihazlar() {
    return apiRequest('/api/cihazlar');
}

function renderCihazlar(data) {
    const devices = Array.isArray(data) ? data : [];
    const activeDevices = devices.filter((device) => device.durum === 'aktif');
    setText('admin-device-count', String(devices.length));
    setText('admin-device-state', devices.length ? `${activeDevices.length} aktif` : 'Kayıt yok');
    setText('admin-device-detail', devices.length
        ? `${devices.length} cihaz kaydından ${activeDevices.length} tanesi aktif`
        : 'Backend cihaz kaydı döndürmedi');
    setText('dashboard-device-state', devices.length
        ? `${activeDevices.length}/${devices.length} aktif`
        : 'Kayıt yok');
}

async function getCihazDurumlari() {
    return apiRequest('/api/cihaz-durumlari');
}

function renderCihazDurumlari(data) {
    const statuses = Array.isArray(data) ? data : [];
    const latest = [...statuses].sort((a, b) => {
        return new Date(b.sonHeartbeat || b.guncellenmeTarihi || 0) - new Date(a.sonHeartbeat || a.guncellenmeTarihi || 0);
    })[0];

    setText('admin-device-connection', latest?.cihazDurumTip
        ? humanizeEnum(latest.cihazDurumTip)
        : 'Durum kaydı yok');
    setText('admin-device-state', latest?.cihazDurumTip
        ? humanizeEnum(latest.cihazDurumTip)
        : 'Durum kaydı yok');
    setText('dashboard-heartbeat', latest?.sonHeartbeat || latest?.guncellenmeTarihi
        ? formatDateTime(latest.sonHeartbeat || latest.guncellenmeTarihi)
        : 'Durum kaydı yok');
}

async function getKartYetkilendirmeler() {
    return apiRequest('/api/kart-yetkilendirmeler');
}

function humanizeEnum(value) {
    const labels = {
        aktif: 'Aktif',
        pasif: 'Pasif',
        askida: 'Askıda',
        iptal: 'İptal',
        kayip: 'Kayıp',
        hasarli: 'Hasarlı',
        bakimda: 'Bakımda',
        devredisi: 'Devre dışı',
        arizali: 'Arızalı',
        emekli: 'Emekli',
        cevrimici: 'Çevrimiçi',
        cevrimdisi: 'Çevrimdışı',
        hatali: 'Hatalı',
        hoca: 'Hoca',
        admin: 'Yönetici',
        sistem: 'Sistem',
        kart: 'RFID Kart',
        pin: 'PIN',
        izin: 'İzin verildi',
        red: 'Reddedildi',
        OPEN: 'Açık',
        IN_PROGRESS: 'İnceleniyor',
        RESOLVED: 'Çözüldü'
    };
    return labels[value] || String(value || '—');
}

function renderYetkilendirmeler(data) {
    appState.yetkilendirmeler = Array.isArray(data) ? data : [];
    const tableBody = document.getElementById('authorization-table-body');
    if (!tableBody) return;
    const selectedPendingUsers = new Map(
        [...tableBody.querySelectorAll('[data-pending-user-select]')]
            .map((select) => [select.dataset.pendingUserSelect, select.value])
    );

    const activeCount = appState.yetkilendirmeler.filter((item) => item.durum === 'aktif').length;
    const passiveCount = appState.yetkilendirmeler.length - activeCount;
    const pendingCount = appState.bekleyenKartlar.length;
    const usersWithCard = new Set(
        appState.yetkilendirmeler
            .map((permission) => permission.kullaniciId ?? permission.kullanici?.kullaniciId)
            .filter((userId) => userId != null)
            .map(String)
    );
    const usersWithoutCard = appState.kullanicilar.filter((user) => {
        return user.rol === 'hoca' && !usersWithCard.has(String(user.kullaniciId));
    });
    const visibleRowCount = appState.yetkilendirmeler.length + pendingCount + usersWithoutCard.length;
    setText('auth-active-count', String(activeCount));
    setText('auth-passive-count', String(passiveCount));
    setText('auth-table-count', `${visibleRowCount} kayıt`);
    setText('auth-pending-count', `${pendingCount} bekleyen istek`);
    setText('authorization-active-count', String(activeCount));
    setText('authorization-passive-count', String(passiveCount));
    setText('authorization-system-state', pendingCount ? `${pendingCount} istek bekliyor` : 'Yetkiler güncel');

    if (!visibleRowCount) {
        showEmpty(tableBody, 'Tanımlı hoca, kart yetkisi veya bekleyen istek bulunamadı.');
        return;
    }

    const fragment = document.createDocumentFragment();
    appState.bekleyenKartlar.forEach((card) => {
        const row = document.createElement('tr');
        row.className = 'authorization-request-row';
        row.dataset.pendingCardUid = card.kartUid;
        row.dataset.role = 'Yeni kart';
        row.dataset.cardStatus = 'Onay bekliyor';
        row.dataset.status = 'Onay bekliyor';
        row.dataset.searchText = `${card.kartUid || ''} yeni kart onay bekliyor`;

        const userCell = document.createElement('td');
        const userSelect = document.createElement('select');
        userSelect.className = 'form-control pending-user-select';
        userSelect.dataset.pendingUserSelect = card.kartUid;
        userSelect.setAttribute('aria-label', `${card.kartUid} kartı için kullanıcı seçin`);

        const placeholder = createElement('option', '', 'Kullanıcı seçin');
        placeholder.value = '';
        userSelect.appendChild(placeholder);
        appState.kullanicilar.forEach((user) => {
            const option = createElement('option', '', `${user.ad || ''} ${user.soyad || ''}`.trim());
            option.value = String(user.kullaniciId);
            userSelect.appendChild(option);
        });
        userSelect.value = selectedPendingUsers.get(card.kartUid) || '';
        userCell.appendChild(userSelect);

        const roleCell = document.createElement('td');
        roleCell.appendChild(createBadge('Yeni kart', 'warning'));

        const cardCell = document.createElement('td');
        cardCell.appendChild(createElement('code', '', card.kartUid || '—'));

        const scanCell = createElement(
            'td',
            'cell-secondary',
            card.sonOkutmaZamani ? formatDateTime(card.sonOkutmaZamani) : 'Kart okutuldu'
        );

        const statusCell = document.createElement('td');
        statusCell.appendChild(createBadge('Onay bekliyor', 'warning'));

        const actionCell = document.createElement('td');
        const actionGroup = document.createElement('div');
        actionGroup.className = 'pending-action-group';

        const approveButton = createElement('button', 'btn-primary table-action-btn', 'Yetki Ver');
        approveButton.type = 'button';
        approveButton.dataset.pendingAction = 'approve';
        approveButton.dataset.cardUid = card.kartUid;

        const rejectButton = createElement('button', 'btn-danger table-action-btn', 'Reddet');
        rejectButton.type = 'button';
        rejectButton.dataset.pendingAction = 'reject';
        rejectButton.dataset.cardUid = card.kartUid;

        actionGroup.append(approveButton, rejectButton);
        actionCell.appendChild(actionGroup);
        row.append(userCell, roleCell, cardCell, scanCell, statusCell, actionCell);
        fragment.appendChild(row);
    });

    appState.yetkilendirmeler.forEach((permission) => {
        const row = document.createElement('tr');
        const user = permission.kullanici || {};
        const userName = `${user.ad || ''} ${user.soyad || ''}`.trim() || 'Bilinmeyen';
        row.dataset.role = humanizeEnum(user.rol);
        row.dataset.cardStatus = 'Tanımlı';
        row.dataset.status = permission.durum === 'aktif' ? 'Yetkili' : humanizeEnum(permission.durum);
        row.dataset.searchText = `${userName} ${permission.kartUid || ''} ${row.dataset.role} ${row.dataset.status}`;
        const nameCell = createElement('td', 'cell-primary', userName);
        const roleCell = document.createElement('td');
        roleCell.appendChild(createBadge(humanizeEnum(user.rol), user.rol === 'hoca' ? 'info' : 'neutral'));
        const cardCell = document.createElement('td');
        cardCell.appendChild(createElement('code', '', permission.kartUid || '—'));
        const pinCell = createElement('td', 'cell-secondary', 'API tarafından paylaşılmaz');
        const statusCell = document.createElement('td');
        const isActive = permission.durum === 'aktif';
        statusCell.appendChild(createBadge(isActive ? 'Yetkili' : humanizeEnum(permission.durum), isActive ? 'success' : 'danger'));
        const actionCell = document.createElement('td');
        const button = createElement('button', `switch-btn ${isActive ? 'btn-passive' : 'btn-active'}`, isActive ? 'Yetkiyi Kaldır' : 'Yetki Ver');
        button.type = 'button';
        button.dataset.permissionId = String(permission.kartYetkiId);
        button.dataset.currentStatus = permission.durum;
        actionCell.appendChild(button);
        row.append(nameCell, roleCell, cardCell, pinCell, statusCell, actionCell);
        fragment.appendChild(row);
    });

    usersWithoutCard.forEach((user) => {
        const row = document.createElement('tr');
        const userName = `${user.ad || ''} ${user.soyad || ''}`.trim() || 'Bilinmeyen';
        row.className = 'authorization-unassigned-row';
        row.dataset.role = humanizeEnum(user.rol);
        row.dataset.cardStatus = 'Kart atanmadı';
        row.dataset.status = humanizeEnum(user.durum);
        row.dataset.searchText = `${userName} ${user.eposta || ''} ${row.dataset.role} kart atanmadı`;

        const nameCell = document.createElement('td');
        nameCell.append(
            createElement('strong', 'cell-primary', userName),
            createElement('span', 'cell-secondary', user.eposta || 'E-posta tanımlı değil')
        );

        const roleCell = document.createElement('td');
        roleCell.appendChild(createBadge(humanizeEnum(user.rol), 'info'));

        const cardCell = document.createElement('td');
        cardCell.append(
            createElement('code', '', '—'),
            createElement('span', 'cell-secondary', 'Kart atanmadı')
        );

        const assignmentCell = createElement(
            'td',
            'cell-secondary',
            'Yeni kart okutulduğunda bu kullanıcıya atanabilir'
        );

        const statusCell = document.createElement('td');
        statusCell.appendChild(createBadge('Kart bekleniyor', 'neutral'));

        const actionCell = document.createElement('td');
        actionCell.appendChild(createElement('span', 'cell-secondary', 'Kart okutun'));

        row.append(nameCell, roleCell, cardCell, assignmentCell, statusCell, actionCell);
        fragment.appendChild(row);
    });

    tableBody.replaceChildren(fragment);
    refreshTableFilter('authorized-users-table');
}

async function getErisimKayitlari(limit = 100, offset = 0) {
    return apiRequest(`/api/erisim-kayitlari?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`);
}

function createAccessRow(record, compact = false, includeDetails = false) {
    const row = document.createElement('tr');
    const eventDate = record.olayTamani || record.kayitTamani;
    row.dataset.date = formatDate(eventDate);

    const dateCell = document.createElement('td');
    if (compact) {
        dateCell.className = 'cell-primary';
        dateCell.textContent = formatTime(eventDate);
    } else {
        dateCell.append(
            createElement('span', 'cell-primary', formatDate(eventDate)),
            createElement('span', 'cell-secondary', formatTime(eventDate))
        );
    }

    const user = record.kullanici;
    const userCell = createElement('td', 'cell-primary', user
        ? `${user.ad || ''} ${user.soyad || ''}`.trim()
        : 'Bilinmeyen');
    const roleCell = createElement('td', '', user ? humanizeEnum(user.rol) : '—');
    const methodCell = createElement('td', '', humanizeEnum(record.dogrulamaYontemi));
    const doorCell = createElement('td', '', record.kapi?.ad || '—');
    const resultCell = document.createElement('td');
    const allowed = record.sonuc === 'izin';
    const resultText = allowed
        ? 'İzin verildi'
        : `Reddedildi${record.redNedeni ? `: ${record.redNedeni}` : ''}`;
    resultCell.appendChild(createBadge(resultText, allowed ? 'success' : 'danger'));
    row.dataset.role = user ? humanizeEnum(user.rol) : 'Bilgi yok';
    row.dataset.method = humanizeEnum(record.dogrulamaYontemi);
    row.dataset.door = record.kapi?.ad || 'Bilgi yok';
    row.dataset.status = allowed ? 'İzin verildi' : 'Reddedildi';
    row.dataset.searchText = [
        user ? `${user.ad || ''} ${user.soyad || ''}`.trim() : '',
        record.kartUid,
        record.okunanUid,
        record.kapi?.ad,
        humanizeEnum(record.dogrulamaYontemi),
        resultText
    ].filter(Boolean).join(' ');

    if (compact) {
        row.append(dateCell, userCell, roleCell, methodCell, resultCell);
    } else {
        row.append(dateCell, userCell, roleCell, methodCell, doorCell, resultCell);
        if (includeDetails) {
            const detailCell = document.createElement('td');
            const detailButton = createElement('button', 'btn-ghost btn-sm table-detail-button', 'Detay');
            detailButton.type = 'button';
            detailButton.addEventListener('click', () => {
                openModal({
                    title: 'Erişim kaydı detayı',
                    message: `${formatDateTime(eventDate)} · ${record.kapi?.ad || 'Kapı bilgisi yok'}`,
                    detail: [
                        `Kullanıcı: ${user ? `${user.ad || ''} ${user.soyad || ''}`.trim() : 'Bilinmeyen'}`,
                        `Rol: ${user ? humanizeEnum(user.rol) : '—'}`,
                        `Yöntem: ${humanizeEnum(record.dogrulamaYontemi)}`,
                        `Sonuç: ${resultText}`
                    ].join(' · '),
                    confirmText: 'Kapat',
                    cancelText: 'Geri',
                    variant: allowed ? 'primary' : 'danger'
                });
            });
            detailCell.appendChild(detailButton);
            row.appendChild(detailCell);
        }
    }
    return row;
}

function renderAccessTable(tableId, data, compact = false) {
    const table = document.getElementById(tableId);
    const tableBody = table?.querySelector('tbody');
    if (!tableBody) return;
    const records = Array.isArray(data) ? data : [];

    if (!records.length) {
        showEmpty(tableBody, 'Erişim kaydı bulunamadı.');
        const countTargets = {
            'admin-access-table': 'admin-access-count',
            'history-access-table': 'history-access-count',
            'dashboard-access-table': 'dashboard-access-count'
        };
        const countTarget = countTargets[tableId];
        setText(countTarget, '0 kayıt');
        return;
    }

    const fragment = document.createDocumentFragment();
    records.forEach((record) => fragment.appendChild(createAccessRow(
        record,
        compact,
        tableId === 'history-access-table'
    )));
    tableBody.replaceChildren(fragment);
    refreshTableFilter(tableId);
}

function renderAccessMetrics(data) {
    const records = Array.isArray(data) ? data : [];
    const allowed = records.filter((record) => record.sonuc === 'izin').length;
    const denied = records.filter((record) => record.sonuc === 'red').length;
    const card = records.filter((record) => record.dogrulamaYontemi === 'kart').length;
    const pin = records.filter((record) => record.dogrulamaYontemi === 'pin').length;

    setText('history-success-count', `${allowed} Kayıt`);
    setText('history-denied-count', `${denied} Kayıt`);
    setText('history-card-count', `${card} Geçiş`);
    setText('history-pin-count', `${pin} Geçiş`);
    setText('dashboard-success-value', String(allowed));
    setText('dashboard-denied-value', String(denied));
}

function renderAdminLastAccess(data) {
    const records = Array.isArray(data) ? data : [];
    const latest = records[0];
    setText('admin-last-access-time', latest ? formatTime(latest.olayTamani || latest.kayitTamani) : '—');
    setText('admin-last-access-result', latest ? humanizeEnum(latest.sonuc) : 'Kayıt yok');
    setText('admin-last-access-detail', latest
        ? `${humanizeEnum(latest.dogrulamaYontemi)} • ${latest.kapi?.ad || 'Kapı bilgisi yok'}`
        : 'Backend erişim kaydı döndürmedi');
    setText('admin-last-attempt', latest
        ? `${formatTime(latest.olayTamani || latest.kayitTamani)} (${humanizeEnum(latest.sonuc)})`
        : 'Kayıt yok');
    setText('admin-last-access', latest
        ? `${formatTime(latest.olayTamani || latest.kayitTamani)} (${humanizeEnum(latest.sonuc)})`
        : 'Kayıt yok');
}

async function loadAdminPinHistory(kullaniciId, userName) {
    const tableBody = document.querySelector('#admin-pin-history-table tbody');
    const label = document.getElementById('admin-pin-history-user');
    if (!tableBody) return;
    showLoading(tableBody);
    setText('admin-pin-history-user', `${userName} için kayıtlar yükleniyor`);
    try {
        const history = await getKapiSifreGecmisi(kullaniciId);
        renderPinHistoryTable('admin-pin-history-table', history);
        setText('admin-pin-history-user', `${userName} · ${history.kayitlar?.length || 0} kayıt`);
    } catch (error) {
        showError(tableBody, handleApiError(error));
        setText('admin-pin-history-user', 'Şifre geçmişi alınamadı');
    }
    label?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
}

function initAdminUserManagement() {
    const form = document.getElementById('admin-user-form');
    const formMessage = document.getElementById('admin-user-form-message');
    const submitButton = document.getElementById('admin-user-submit');
    const tableBody = document.querySelector('#admin-users-table tbody');

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
            ad: String(formData.get('ad') || '').trim(),
            soyad: String(formData.get('soyad') || '').trim(),
            eposta: String(formData.get('eposta') || '').trim(),
            webPassword: String(formData.get('webPassword') || ''),
            pin: String(formData.get('pin') || '')
        };
        if (!payload.webPassword) delete payload.webPassword;
        if (!payload.pin) delete payload.pin;

        setButtonLoading(submitButton, true, 'Kullanıcı oluşturuluyor…');
        setInlineMessage(formMessage, 'Kullanıcı hesabı güvenli biçimde oluşturuluyor…', 'info');
        try {
            const created = await createKullanici(payload);
            setText('generated-user-email', created.eposta || payload.eposta);
            setText('generated-user-password', created.initialPassword || '—');
            setText('generated-user-pin', created.initialPin || '—');
            const credentials = document.getElementById('admin-generated-credentials');
            if (credentials) credentials.hidden = false;
            form.reset();
            renderKullanicilar(await getKullanicilar());
            setInlineMessage(formMessage, 'Kullanıcı oluşturuldu. İlk giriş bilgilerini kullanıcıya güvenli biçimde iletin.', 'success');
            showToast('Yeni kullanıcı hesabı oluşturuldu.', 'success');
            await loadAdminPinHistory(created.kullaniciId, `${created.ad} ${created.soyad}`);
        } catch (error) {
            setInlineMessage(formMessage, handleApiError(error), 'error');
            showToast(handleApiError(error), 'error');
        } finally {
            setButtonLoading(submitButton, false);
        }
    });

    tableBody?.addEventListener('click', async (event) => {
        const historyButton = event.target.closest('[data-user-history]');
        if (historyButton) {
            await loadAdminPinHistory(historyButton.dataset.userHistory, historyButton.dataset.userName || 'Kullanıcı');
            return;
        }

        const deleteButton = event.target.closest('[data-user-delete]');
        if (!deleteButton) return;
        const confirmed = await openModal({
            title: 'Kullanıcı hesabını sil',
            message: `${deleteButton.dataset.userName || 'Bu kullanıcı'} sistemden kaldırılacak.`,
            detail: 'Kullanıcıya bağlı geçmiş kayıtlar varsa hesap silinmek yerine pasif duruma alınır.',
            confirmText: 'Kullanıcıyı Sil',
            variant: 'danger'
        });
        if (!confirmed) return;

        deleteButton.disabled = true;
        setInlineMessage(formMessage, 'Kullanıcı hesabı kaldırılıyor…', 'info');
        try {
            const response = await deleteKullanici(deleteButton.dataset.userDelete);
            renderKullanicilar(await getKullanicilar());
            setInlineMessage(formMessage, response?.mesaj || 'Kullanıcı hesabı kaldırıldı.', 'success');
            showToast(response?.mesaj || 'Kullanıcı hesabı kaldırıldı.', 'success');
        } catch (error) {
            deleteButton.disabled = false;
            setInlineMessage(formMessage, handleApiError(error), 'error');
            showToast(handleApiError(error), 'error');
        }
    });
}

async function initAccountPage() {
    const user = appState.currentUser || await getCurrentUser();
    setText('account-full-name', `${user.ad || ''} ${user.soyad || ''}`.trim() || '—');
    setText('account-email', user.eposta || 'E-posta tanımlı değil');
    setText('account-status', humanizeEnum(user.durum));
    setText('account-role-badge', humanizeEnum(user.rol));
    setText('account-system-state', 'Hesap bilgileri güncel');

    const pinTableBody = document.querySelector('#account-pin-history-table tbody');
    const pinMessage = document.getElementById('account-pin-message');
    showLoading(pinTableBody);
    try {
        const history = await getKapiSifreGecmisi(user.kullaniciId);
        renderPinHistoryTable('account-pin-history-table', history);
        setInlineMessage(pinMessage);
    } catch (error) {
        showError(pinTableBody, handleApiError(error));
        setInlineMessage(pinMessage, handleApiError(error), 'error');
    }

    const form = document.getElementById('account-password-form');
    const message = document.getElementById('account-password-message');
    const submitButton = document.getElementById('account-password-submit');
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
            mevcutSifre: String(formData.get('mevcutSifre') || ''),
            yeniSifre: String(formData.get('yeniSifre') || ''),
            yeniSifreTekrar: String(formData.get('yeniSifreTekrar') || '')
        };
        if (payload.yeniSifre !== payload.yeniSifreTekrar) {
            setInlineMessage(message, 'Yeni şifre ile şifre tekrarı eşleşmiyor.', 'error');
            return;
        }

        setButtonLoading(submitButton, true, 'Şifre güncelleniyor…');
        setInlineMessage(message, 'Web arayüzü şifreniz güncelleniyor…', 'info');
        try {
            const response = await changeOwnWebPassword(payload);
            form.reset();
            setInlineMessage(message, response?.message || 'Web şifreniz güncellendi.', 'success');
            clearAuthToken();
            window.setTimeout(() => window.location.replace('login.html?sifre=degisti'), 900);
        } catch (error) {
            setInlineMessage(message, handleApiError(error), 'error');
            showToast(handleApiError(error), 'error');
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

async function initAdminPage() {
    const tableBody = document.querySelector('#admin-users-table tbody');
    const status = document.getElementById('admin-api-status');
    showLoading(tableBody);
    setInlineMessage(status, 'Kullanıcı hesapları yükleniyor…', 'info');
    try {
        renderKullanicilar(await getKullanicilar());
        setInlineMessage(status);
        setText('admin-system-state', 'Kullanıcı listesi güncel');
    } catch (error) {
        showError(tableBody, handleApiError(error));
        setInlineMessage(status, handleApiError(error), 'error');
        setText('admin-system-state', 'Kullanıcılar yüklenemedi');
    }

    initAdminUserManagement();
}

async function initDashboardPage() {
    const tableBody = document.querySelector('#dashboard-access-table tbody');
    showLoading(tableBody);

    const requests = [
        ['users', getKullaniciOzeti(), (summary) => {
            const totalUsers = Number(summary?.toplam || 0);
            const activeUsers = Number(summary?.aktif || 0);
            setText('dashboard-user-value', String(activeUsers));
            setText('dashboard-user-detail', `${totalUsers} kullanıcıdan ${activeUsers} tanesi aktif`);
        }],
        ['doors', getKapilar(), renderKapilar],
        ['devices', getCihazlar(), renderCihazlar],
        ['statuses', getCihazDurumlari(), renderCihazDurumlari],
        ['records', getErisimKayitlari(20, 0), (records) => {
            renderAccessMetrics(records);
            renderAccessTable('dashboard-access-table', records, false);
        }]
    ];
    const results = await Promise.allSettled(requests.map(([, request]) => request));
    const failures = [];
    results.forEach((result, index) => {
        const [name, , render] = requests[index];
        if (result.status === 'fulfilled') render(result.value);
        else failures.push(name);
    });

    if (failures.includes('records')) showError(tableBody, 'Erişim kayıtları yüklenemedi.');
    setText('dashboard-system-state', failures.length ? 'Bazı veriler alınamadı' : 'Sistem verileri güncel');
    setText('dashboard-infra-state', failures.length ? 'Kısmi bağlantı' : 'Canlı API');
}

async function initAuthorizationPage() {
    const tableBody = document.getElementById('authorization-table-body');
    const message = document.getElementById('authorization-message');

    showLoading(tableBody);
    try {
        const [users, pendingCards, permissions] = await Promise.all([
            getKullanicilar(),
            getOnayBekleyenKartlar(),
            getKartYetkilendirmeler()
        ]);
        renderKullanicilar(users);
        appState.bekleyenKartlar = pendingCards;
        renderYetkilendirmeler(permissions);
    } catch (error) {
        showError(tableBody, handleApiError(error));
        setText('authorization-system-state', 'Yetkiler yüklenemedi');
        setInlineMessage(message, handleApiError(error), 'error');
        return;
    }

    let latestCardRefreshRunning = false;
    let pendingSignature = appState.bekleyenKartlar.map((card) => card.kartUid).join('|');
    const syncCardRequests = async () => {
        if (latestCardRefreshRunning) return;
        latestCardRefreshRunning = true;
        try {
            const [, pendingCards] = await Promise.all([
                loadLatestCardSummary(),
                getOnayBekleyenKartlar()
            ]);
            const nextSignature = pendingCards.map((card) => card.kartUid).join('|');
            if (nextSignature !== pendingSignature) {
                pendingSignature = nextSignature;
                appState.bekleyenKartlar = pendingCards;
                renderYetkilendirmeler(appState.yetkilendirmeler);
            }
        } finally {
            latestCardRefreshRunning = false;
        }
    };

    await syncCardRequests();
    window.setInterval(syncCardRequests, 2000);

    tableBody?.addEventListener('click', async (event) => {
        const requestButton = event.target.closest('[data-pending-action]');
        if (requestButton) {
            const row = requestButton.closest('[data-pending-card-uid]');
            const kartUid = requestButton.dataset.cardUid;
            const action = requestButton.dataset.pendingAction;
            const userSelect = row?.querySelector('[data-pending-user-select]');
            const selectedUserId = userSelect?.value || '';

            if (action === 'approve' && !selectedUserId) {
                setInlineMessage(message, 'Yetki vermeden önce satırdan kullanıcı seçin.', 'warning');
                showToast('Yetki vermeden önce kullanıcı seçin.', 'warning');
                userSelect?.focus();
                return;
            }

            const confirmed = await openModal({
                title: action === 'approve' ? 'Kart yetkisini onayla' : 'Kart isteğini reddet',
                message: action === 'approve'
                    ? `${kartUid} kartı seçilen kullanıcıya atanacak.`
                    : `${kartUid} kartının bekleyen isteği reddedilecek.`,
                detail: action === 'approve'
                    ? 'Kart, işlem tamamlandığında laboratuvar erişimi için kullanılabilir.'
                    : 'Kart tekrar okutulursa yeni bir istek oluşturabilir.',
                confirmText: action === 'approve' ? 'Yetki Ver' : 'Reddet',
                variant: action === 'approve' ? 'primary' : 'danger'
            });
            if (!confirmed) return;

            const rowButtons = row?.querySelectorAll('button') || [];
            rowButtons.forEach((button) => {
                button.disabled = true;
            });
            setInlineMessage(
                message,
                action === 'approve' ? 'Kart yetkisi veriliyor…' : 'Kart isteği reddediliyor…',
                'info'
            );

            try {
                if (action === 'approve') {
                    await apiRequest('/api/kartlar/onayla', {
                        method: 'POST',
                        body: { kartUid, userId: selectedUserId }
                    });
                } else {
                    await apiRequest('/api/kartlar/reddet', {
                        method: 'POST',
                        body: { kartUid }
                    });
                }

                const [pendingCards, permissions] = await Promise.all([
                    getOnayBekleyenKartlar(),
                    getKartYetkilendirmeler()
                ]);
                appState.bekleyenKartlar = pendingCards;
                pendingSignature = pendingCards.map((card) => card.kartUid).join('|');
                renderYetkilendirmeler(permissions);
                setInlineMessage(
                    message,
                    action === 'approve'
                        ? 'Kart yetkisi verildi ve istek tamamlandı.'
                        : 'Kart yetkilendirme isteği reddedildi.',
                    'success'
                );
                showToast(
                    action === 'approve' ? 'Kart yetkisi başarıyla verildi.' : 'Kart isteği reddedildi.',
                    'success'
                );
            } catch (error) {
                rowButtons.forEach((button) => {
                    button.disabled = false;
                });
                setInlineMessage(message, handleApiError(error), 'error');
                showToast(handleApiError(error), 'error');
            }
            return;
        }

        const button = event.target.closest('[data-permission-id]');
        if (!button) return;

        const previousStatus = button.dataset.currentStatus;
        const nextStatus = previousStatus === 'aktif' ? 'pasif' : 'aktif';
        const confirmed = await openModal({
            title: nextStatus === 'aktif' ? 'Kart yetkisini etkinleştir' : 'Kart yetkisini kaldır',
            message: nextStatus === 'aktif'
                ? 'Bu kart yeniden laboratuvar erişimi kazanacak.'
                : 'Bu kartın laboratuvar erişimi durdurulacak.',
            confirmText: nextStatus === 'aktif' ? 'Yetki Ver' : 'Yetkiyi Kaldır',
            variant: nextStatus === 'aktif' ? 'primary' : 'danger'
        });
        if (!confirmed) return;
        button.disabled = true;
        setInlineMessage(message, 'Yetki durumu güncelleniyor…', 'info');

        try {
            await apiRequest(`/api/kart-yetkilendirmeler/${encodeURIComponent(button.dataset.permissionId)}`, {
                method: 'PUT',
                body: { durum: nextStatus }
            });
            renderYetkilendirmeler(await getKartYetkilendirmeler());
            setInlineMessage(message, 'Yetki durumu backend üzerinde güncellendi.', 'success');
            showToast('Yetki durumu güncellendi.', 'success');
        } catch (error) {
            button.disabled = false;
            setInlineMessage(message, `${handleApiError(error)} Arayüzdeki önceki durum korundu.`, 'error');
            showToast(handleApiError(error), 'error');
        }
    });
}

async function loadLatestCardSummary() {
    try {
        const latest = await apiRequest('/api/kartlar/son-okutulan');
        setText('latest-card-uid', latest?.okunanUid || '—');
        setText('latest-card-state', latest?.okunanUid ? 'Hazır' : 'Bekliyor');
        const latestTimestamp = latest?.kayitTamani || latest?.olayTamani;
        setText('latest-card-detail', latestTimestamp
            ? `Son okuma: ${formatDateTime(latestTimestamp)}`
            : 'Henüz kart okutulmadı');
        return latest;
    } catch (error) {
        setText('latest-card-uid', '—');
        setText('latest-card-state', 'Bağlantı yok');
        setText('latest-card-detail', handleApiError(error));
        return null;
    }
}

async function fetchCardId() {
    const message = document.getElementById('authorization-message');
    const input = document.getElementById('rfidInput');
    const button = document.getElementById('fetch-card-button');
    if (!input || !button) return;

    button.disabled = true;
    setInlineMessage(message, 'Son okutulan kart alınıyor…', 'info');
    try {
        const latest = await apiRequest('/api/kartlar/son-okutulan');
        if (!latest?.okunanUid) throw new ApiError('Okutulmuş kart bulunamadı.');
        input.value = latest.okunanUid;
        setText('latest-card-uid', latest.okunanUid);
        setText('latest-card-state', 'Hazır');
        const latestTimestamp = latest?.kayitTamani || latest?.olayTamani;
        setText('latest-card-detail', latestTimestamp
            ? `Son okuma: ${formatDateTime(latestTimestamp)}`
            : 'Kart okuyucudan alındı');
        setInlineMessage(message, `Son okutulan kart yüklendi: ${latest.okunanUid}`, 'success');
    } catch (error) {
        setInlineMessage(message, handleApiError(error), 'error');
    } finally {
        button.disabled = false;
    }
}

async function renewCode() {
    const button = document.getElementById('renew-code-button');
    const code = document.getElementById('dailyCode');
    const message = document.getElementById('pin-message');
    if (!button || !code) return;

    button.disabled = true;
    setInlineMessage(message, 'Yeni PIN oluşturuluyor…', 'info');
    try {
        const user = appState.currentUser || await getCurrentUser();
        const response = await apiRequest(`/api/kullanicilar/${encodeURIComponent(user.kullaniciId)}/sifre-yenile`, {
            method: 'POST'
        });
        const newPin = response?.veri?.yeniPin;
        if (!newPin) throw new ApiError('Backend yanıtında yeni PIN alanı bulunamadı.');
        code.textContent = newPin;
        setText('pin-current-state', 'Yeni PIN hazır');
        setText('pin-system-state', 'PIN backend üzerinden yenilendi');
        setInlineMessage(message, 'Yeni PIN oluşturuldu. Güvenli biçimde saklayın; sayfadan ayrıldığınızda tekrar gösterilmez.', 'success');
        const copyButton = document.getElementById('copy-pin-button');
        if (copyButton) copyButton.disabled = false;
        showToast('Yeni PIN başarıyla oluşturuldu.', 'success');
    } catch (error) {
        code.textContent = '••••••';
        setText('pin-current-state', 'Üretilemedi');
        setText('pin-system-state', 'PIN servisi hatası');
        setInlineMessage(message, handleApiError(error), 'error');
        showToast(handleApiError(error), 'error');
    } finally {
        button.disabled = false;
    }
}

function initTemporaryPinPage() {
    const button = document.getElementById('renew-code-button');
    if (!button) return;
    const codeDisplay = document.querySelector('.code-display');
    if (codeDisplay && !document.getElementById('copy-pin-button')) {
        const copyButton = createElement('button', 'btn-secondary btn-sm copy-pin-button', 'PIN’i Kopyala');
        copyButton.id = 'copy-pin-button';
        copyButton.type = 'button';
        copyButton.disabled = true;
        copyButton.addEventListener('click', async () => {
            const pin = document.getElementById('dailyCode')?.textContent?.trim() || '';
            if (!/^\d{4,8}$/.test(pin)) return;
            try {
                await navigator.clipboard.writeText(pin);
                showToast('PIN panoya kopyalandı.', 'success');
            } catch (error) {
                showToast('PIN kopyalanamadı. Kodu elle seçebilirsiniz.', 'error');
            }
        });
        codeDisplay.appendChild(copyButton);
    }
    button.disabled = false;
    button.addEventListener('click', renewCode);
}

async function initAccessHistoryPage() {
    const tableBody = document.querySelector('#history-access-table tbody');
    showLoading(tableBody);
    try {
        const records = await getErisimKayitlari(100, 0);
        renderAccessTable('history-access-table', records, false);
        renderAccessMetrics(records);
        setText('history-system-state', 'Kayıtlar güncel');
    } catch (error) {
        showError(tableBody, handleApiError(error));
        setText('history-access-count', '0 kayıt');
        setText('history-system-state', 'Kayıtlar yüklenemedi');
    }
}

async function getArizalar() {
    const response = await apiRequest('/api/arizalar');
    if (!response?.success || !Array.isArray(response.data)) {
        throw new ApiError('Arıza listesi yanıtı doğrulanamadı.');
    }
    return response.data;
}

function renderArizalar(data) {
    const records = Array.isArray(data) ? data : [];
    const tableBody = document.querySelector('#fault-records-table tbody');
    if (!tableBody) return;

    const openCount = records.filter((record) => record.durum === 'OPEN' || record.durum === 'IN_PROGRESS').length;
    const resolvedCount = records.filter((record) => record.durum === 'RESOLVED').length;
    const latest = records[0];
    setText('fault-open-count', String(openCount));
    setText('fault-resolved-count', String(resolvedCount));
    setText('fault-last-type', latest?.arizaTuru || 'Kayıt yok');
    setText('fault-period', latest ? formatDate(latest.olusturulma) : 'Kayıt yok');
    setText('fault-record-count', `${records.length} kayıt`);
    setText('fault-system-state', 'Arıza kayıtları güncel');

    if (!records.length) {
        showEmpty(tableBody, 'Arıza bildirimi bulunamadı.');
        return;
    }

    const fragment = document.createDocumentFragment();
    records.forEach((record) => {
        const row = document.createElement('tr');
        row.dataset.date = formatDate(record.olusturulma);
        row.dataset.issueType = record.arizaTuru || 'Tür belirtilmedi';
        row.dataset.status = humanizeEnum(record.durum);
        row.dataset.searchText = [
            record.arizaTuru,
            record.aciklama,
            record.bildiren,
            humanizeEnum(record.durum)
        ].filter(Boolean).join(' ');

        const dateCell = document.createElement('td');
        dateCell.append(
            createElement('span', 'cell-primary', formatDate(record.olusturulma)),
            createElement('span', 'cell-secondary', formatTime(record.olusturulma))
        );
        const descriptionCell = document.createElement('td');
        descriptionCell.append(
            createElement('span', 'cell-primary', record.arizaTuru || 'Tür belirtilmedi'),
            createElement('span', 'cell-secondary', record.aciklama || 'Açıklama yok'),
            createElement('span', 'cell-secondary', record.bildiren ? `Bildiren: ${record.bildiren}` : 'Bildiren: Anonim')
        );
        const photoCell = document.createElement('td');
        if (record.fotografVerisi) {
            const link = createElement('a', 'fault-photo-link');
            link.href = record.fotografVerisi;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('aria-label', `${record.fotografAdi || 'Arıza fotoğrafını'} yeni sekmede görüntüle`);
            const thumbnail = document.createElement('img');
            thumbnail.className = 'fault-thumbnail';
            thumbnail.src = record.fotografVerisi;
            thumbnail.alt = '';
            thumbnail.loading = 'lazy';
            link.append(thumbnail, createElement('span', '', 'Görüntüle'));
            photoCell.appendChild(link);
        } else {
            photoCell.className = 'cell-secondary';
            photoCell.textContent = 'Ek yok';
        }
        const statusCell = document.createElement('td');
        const variant = record.durum === 'RESOLVED'
            ? 'success'
            : record.durum === 'IN_PROGRESS' ? 'warning' : 'danger';
        if (appState.currentUser?.rol === 'admin') {
            const statusOrder = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
            const currentIndex = Math.max(statusOrder.indexOf(record.durum), 0);
            const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
            const button = createElement('button', `status-cycle-button badge badge-${variant}`);
            button.type = 'button';
            button.dataset.issueId = String(record.arizaId);
            button.dataset.currentStatus = record.durum;
            button.dataset.nextStatus = nextStatus;
            button.setAttribute('aria-label', `${record.arizaTuru || 'Arıza'} durumu ${humanizeEnum(record.durum)}. Sonraki durum: ${humanizeEnum(nextStatus)}`);
            button.append(
                createElement('span', 'status-dot'),
                createElement('span', '', humanizeEnum(record.durum)),
                createElement('span', 'status-cycle-icon', '›')
            );
            statusCell.appendChild(button);
        } else {
            statusCell.appendChild(createBadge(humanizeEnum(record.durum), variant));
        }
        const detailButton = createElement('button', 'btn-ghost btn-sm fault-detail-button', 'Detay');
        detailButton.type = 'button';
        detailButton.addEventListener('click', () => {
            openModal({
                title: record.arizaTuru || 'Arıza kaydı',
                message: record.aciklama || 'Açıklama bulunmuyor.',
                detail: `${formatDateTime(record.olusturulma)} · ${record.bildiren || 'Anonim'} · ${humanizeEnum(record.durum)}`,
                confirmText: 'Kapat',
                cancelText: 'Geri',
                variant: record.durum === 'RESOLVED' ? 'primary' : 'danger'
            });
        });
        descriptionCell.appendChild(detailButton);
        row.append(dateCell, descriptionCell, photoCell, statusCell);
        fragment.appendChild(row);
    });
    tableBody.replaceChildren(fragment);
    refreshTableFilter('fault-records-table');
}

async function initIssueHistoryPage() {
    const status = document.getElementById('fault-integration-status');
    const tableBody = document.querySelector('#fault-records-table tbody');
    showLoading(tableBody);
    setInlineMessage(status, 'Arıza kayıtları backend’den yükleniyor…', 'info');

    try {
        renderArizalar(await getArizalar());
        setInlineMessage(status);
    } catch (error) {
        showError(tableBody, handleApiError(error));
        setText('fault-record-count', '0 kayıt');
        setText('fault-system-state', 'Arıza servisine ulaşılamadı');
        setInlineMessage(status, handleApiError(error), 'error');
    }

    tableBody?.addEventListener('click', async (event) => {
        const button = event.target.closest('.status-cycle-button[data-issue-id]');
        if (!button) return;
        const nextStatus = button.dataset.nextStatus;
        const confirmed = await openModal({
            title: 'Arıza durumunu güncelle',
            message: `Kayıt durumu “${humanizeEnum(nextStatus)}” olarak değiştirilecek.`,
            confirmText: 'Durumu Güncelle',
            variant: nextStatus === 'RESOLVED' ? 'primary' : 'danger'
        });
        if (!confirmed) return;
        button.disabled = true;
        setInlineMessage(status, 'Arıza durumu güncelleniyor…', 'info');
        try {
            await apiRequest(`/api/arizalar/${encodeURIComponent(button.dataset.issueId)}`, {
                method: 'PATCH',
                body: { status: nextStatus }
            });
            renderArizalar(await getArizalar());
            setInlineMessage(status, 'Arıza durumu güncellendi.', 'success');
            showToast('Arıza durumu güncellendi.', 'success');
        } catch (error) {
            button.disabled = false;
            setInlineMessage(status, handleApiError(error), 'error');
            showToast(handleApiError(error), 'error');
        }
    });
}

function updateFileName(input) {
    const labelText = document.getElementById('fileNameText');
    if (labelText && input.files?.length) labelText.textContent = input.files[0].name;
}

function initIssueReportPage() {
    const form = document.getElementById('issue-report-form');
    const message = document.getElementById('issue-report-message');
    const submitButton = document.getElementById('issue-report-submit');
    setInlineMessage(message, 'Bildirim metni ve isteğe bağlı fotoğraf güvenli biçimde gönderilir.', 'info');
    if (submitButton) submitButton.disabled = false;

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fullName = document.getElementById('report-full-name').value.trim();
        const emailUser = document.getElementById('report-email').value.trim();
        const issueType = document.getElementById('report-issue-type').value;
        const description = document.getElementById('report-description').value.trim();
        const photoFile = document.getElementById('filePicker').files?.[0]
            || document.getElementById('cameraInput').files?.[0]
            || null;

        if (!fullName || !emailUser || !issueType || !description) {
            setInlineMessage(message, 'Ad soyad, e-posta, arıza türü ve açıklama alanları zorunludur.', 'error');
            return;
        }

        const originalContent = Array.from(submitButton.childNodes, (node) => node.cloneNode(true));
        const reportedEmail = emailUser.includes('@') ? emailUser : `${emailUser}@subu.edu.tr`;
        submitButton.disabled = true;
        submitButton.textContent = 'Bildirim gönderiliyor…';
        setInlineMessage(message, 'Arıza bildirimi kaydediliyor…', 'info');

        try {
            if (photoFile && photoFile.size > 2_500_000) {
                throw new ApiError('Fotoğraf en fazla 2,5 MB olabilir.');
            }
            const photoData = photoFile ? await readFileAsDataUrl(photoFile) : null;
            const response = await apiRequest('/api/arizalar', {
                method: 'POST',
                body: {
                    reportedBy: `${fullName} (${reportedEmail})`.slice(0, 128),
                    issueType,
                    description,
                    photoName: photoFile?.name || null,
                    photoData
                }
            });
            if (!response?.success || !response?.report?.arizaId) {
                throw new ApiError('Arıza kayıt yanıtı doğrulanamadı.');
            }
            form.reset();
            setInlineMessage(message, response.message || 'Arıza bildirimi başarıyla kaydedildi.', 'success');
            showToast(response.message || 'Arıza bildirimi başarıyla kaydedildi.', 'success');
        } catch (error) {
            setInlineMessage(message, handleApiError(error), 'error');
            showToast(handleApiError(error), 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.replaceChildren(...originalContent);
        }
    });
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new ApiError('Fotoğraf okunamadı.'));
        reader.readAsDataURL(file);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    normalizeNavigation();
    initNavigation();
    initThemeToggle();
    initTableFilters();
    initLogout();

    const page = document.body.dataset.page;
    if (page === 'login') {
        await initLogin();
        return;
    }

    if (document.body.dataset.authRequired === 'true') {
        const authenticated = await requireAuthentication();
        if (!authenticated) return;
    }

    const initializers = {
        admin: initAdminPage,
        dashboard: initDashboardPage,
        account: initAccountPage,
        'password-reset': initPasswordResetPage,
        authorization: initAuthorizationPage,
        'temporary-pin': initTemporaryPinPage,
        'access-history': initAccessHistoryPage,
        'issue-history': initIssueHistoryPage,
        'issue-report': initIssueReportPage
    };

    const initializePage = initializers[page];
    if (initializePage) await initializePage();
});

