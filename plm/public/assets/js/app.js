/* =====================================================================
   Prima License Manager — Application JavaScript
   Handles sidebar, theme toggle, notifications polling, dashboard charts,
   DataTables initialisation, confirm dialogs and small UI helpers.
   ===================================================================== */
(function () {
    'use strict';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    const csrfToken = () => (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
    // Absolute origin plus the app's base path (e.g. "/license") when the
    // application is installed in a subdirectory. PLM_BASE is injected by the
    // layout; it is already an absolute or root-relative base, so we only add
    // the origin when it is root-relative.
    const baseUrl = () => {
        const b = (window.PLM_BASE || '').replace(/\/+$/, '');
        if (/^https?:\/\//i.test(b)) return b;
        return window.location.origin + b;
    };

    /* ---------- Sidebar ---------- */
    function initSidebar() {
        const sidebar = $('#appSidebar');
        const overlay = $('#sidebarOverlay');
        const open = () => { sidebar && sidebar.classList.add('open'); overlay && overlay.classList.add('show'); };
        const close = () => { sidebar && sidebar.classList.remove('open'); overlay && overlay.classList.remove('show'); };

        $('#sidebarToggle') && $('#sidebarToggle').addEventListener('click', open);
        $('#sidebarClose') && $('#sidebarClose').addEventListener('click', close);
        overlay && overlay.addEventListener('click', close);
    }

    /* ---------- Theme toggle ---------- */
    function initTheme() {
        const btn = $('#themeToggle');
        if (!btn) return;
        btn.addEventListener('click', function () {
            const html = document.documentElement;
            const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-bs-theme', next);
            // Persist preference server-side.
            fetch(baseUrl() + '/profile/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                body: 'theme=' + next + '&locale=' + (document.documentElement.lang || 'en') + '&_csrf_token=' + encodeURIComponent(csrfToken())
            }).catch(() => {});
        });
    }

    /* ---------- Password visibility ---------- */
    function initPasswordToggles() {
        $$('[data-toggle-password]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const target = $(btn.getAttribute('data-toggle-password'));
                if (!target) return;
                const show = target.type === 'password';
                target.type = show ? 'text' : 'password';
                btn.textContent = show ? 'Hide' : 'Show';
            });
        });
    }

    /* ---------- Confirm dialogs ---------- */
    function initConfirms() {
        $$('form[data-confirm]').forEach(function (form) {
            form.addEventListener('submit', function (e) {
                if (!window.confirm(form.getAttribute('data-confirm'))) {
                    e.preventDefault();
                }
            });
        });
    }

    /* ---------- Counters ---------- */
    function initCounters() {
        $$('.stat-value[data-count]').forEach(function (el) {
            const target = parseInt(el.getAttribute('data-count'), 10) || 0;
            if (target === 0) return;
            let current = 0;
            const step = Math.max(1, Math.floor(target / 40));
            const timer = setInterval(function () {
                current += step;
                if (current >= target) { current = target; clearInterval(timer); }
                el.textContent = current.toLocaleString();
            }, 20);
        });
    }

    /* ---------- DataTables ---------- */
    function initDataTables() {
        if (!window.jQuery || !jQuery.fn.DataTable) return;
        $$('table[data-datatable]').forEach(function (table) {
            jQuery(table).DataTable({
                pageLength: 15,
                lengthMenu: [10, 15, 25, 50, 100],
                order: [],
                language: { search: '', searchPlaceholder: 'Search…' }
            });
        });
    }

    /* ---------- Notifications ---------- */
    function initNotifications() {
        const badge = $('#notifBadge');
        const list = $('#notifList');
        if (!badge) return;

        function load() {
            fetch(baseUrl() + '/notifications', { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' } })
                .then(r => r.ok ? r.json() : null)
                .then(function (data) {
                    if (!data) return;
                    if (data.unread > 0) { badge.textContent = data.unread; badge.classList.remove('d-none'); }
                    else { badge.classList.add('d-none'); }
                    if (list && Array.isArray(data.items)) {
                        if (data.items.length === 0) {
                            list.innerHTML = '<div class="notif-empty text-muted small p-3">No notifications.</div>';
                        } else {
                            list.innerHTML = data.items.map(function (n) {
                                return '<a class="dropdown-item py-2 ' + (n.is_read == 1 ? '' : 'fw-semibold') + '" href="' +
                                    (n.link || baseUrl() + '/notifications') + '"><div>' + escapeHtml(n.title) +
                                    '</div><small class="text-muted">' + escapeHtml(n.message || '') + '</small></a>';
                            }).join('');
                        }
                    }
                }).catch(() => {});
        }
        load();
        setInterval(load, 60000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    /* ---------- Dashboard charts ---------- */
    function initDashboard() {
        if (!window.PLM_DASHBOARD || !window.Chart) return;

        const palette = {
            primary: '#2471a3', accent: '#e84c3d', success: '#1e9e5a',
            warning: '#f0932b', info: '#3498db', purple: '#8e44ad', grey: '#95a5a6'
        };
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--plm-border') || '#e2e8f0';

        fetch(baseUrl() + '/dashboard/chart-data', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(r => r.json())
            .then(function (d) {
                drawLine('revenueChart', d.revenue, 'Revenue', palette.primary, gridColor);
                drawDoughnut('typeChart', d.types, Object.values(palette));
                drawDoughnut('statusChart', d.status, [palette.success, palette.accent, palette.warning, palette.grey, palette.info]);
                drawBar('activationChart', d.activations, 'Activations', palette.info, gridColor);
            }).catch(() => {});

        function drawLine(id, data, label, color, grid) {
            const el = document.getElementById(id); if (!el || !data) return;
            new Chart(el, {
                type: 'line',
                data: { labels: data.labels, datasets: [{ label: label, data: data.data, borderColor: color, backgroundColor: hexA(color, .12), fill: true, tension: .35, pointRadius: 3 }] },
                options: baseOpts(grid)
            });
        }
        function drawBar(id, data, label, color, grid) {
            const el = document.getElementById(id); if (!el || !data) return;
            new Chart(el, {
                type: 'bar',
                data: { labels: data.labels, datasets: [{ label: label, data: data.data, backgroundColor: color, borderRadius: 4 }] },
                options: baseOpts(grid)
            });
        }
        function drawDoughnut(id, data, colors) {
            const el = document.getElementById(id); if (!el || !data) return;
            new Chart(el, {
                type: 'doughnut',
                data: { labels: data.labels, datasets: [{ data: data.data, backgroundColor: colors }] },
                options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } } }, cutout: '60%' }
            });
        }
        function baseOpts(grid) {
            return {
                responsive: true, maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid } } }
            };
        }
        function hexA(hex, a) {
            const n = parseInt(hex.slice(1), 16);
            return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
        }
    }

    /* ---------- License type → expiry auto-fill ---------- */
    function initLicenseForm() {
        const typeSel = $('#licenseType');
        const issue = $('#issueDate');
        const expire = $('#expireDate');
        if (!typeSel || !issue || !expire) return;

        const durations = { trial: 14, monthly: 30, quarterly: 90, semi_annual: 182, yearly: 365, lifetime: null, developer: 365, enterprise: 365 };
        function recompute() {
            const days = durations[typeSel.value];
            if (days === null) { expire.value = ''; expire.disabled = true; expire.placeholder = 'Lifetime'; return; }
            expire.disabled = false;
            if (issue.value) {
                const d = new Date(issue.value);
                d.setDate(d.getDate() + days);
                expire.value = d.toISOString().slice(0, 10);
            }
        }
        typeSel.addEventListener('change', recompute);
        issue.addEventListener('change', recompute);
    }

    /* ---------- Copy to clipboard ---------- */
    function initCopy() {
        $$('[data-copy]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const text = btn.getAttribute('data-copy');
                navigator.clipboard.writeText(text).then(function () {
                    const old = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = old; }, 1500);
                });
            });
        });
    }

    /* ---------- Test mail ---------- */
    function initTestMail() {
        const btn = $('#testMailBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            const email = ($('#testMailInput') || {}).value || '';
            const result = $('#testMailResult');
            btn.disabled = true;
            fetch(baseUrl() + '/settings/test-mail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                body: 'test_email=' + encodeURIComponent(email) + '&_csrf_token=' + encodeURIComponent(csrfToken())
            }).then(r => r.json()).then(function (d) {
                if (result) { result.textContent = d.message; result.className = 'small mt-2 ' + (d.success ? 'text-success' : 'text-danger'); }
            }).finally(() => { btn.disabled = false; });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initSidebar();
        initTheme();
        initPasswordToggles();
        initConfirms();
        initCounters();
        initDataTables();
        initNotifications();
        initDashboard();
        initLicenseForm();
        initCopy();
        initTestMail();
    });
})();
