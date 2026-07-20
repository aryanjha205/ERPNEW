const API = '/api';
let recognition;

function initApp() {
    const session = getSession();
    session ? renderWorkspace(session) : renderLogin();
    document.getElementById('voice-btn')?.addEventListener('click', toggleVoiceAssistant);
    syncVoiceButton(Boolean(session));
    document.getElementById('registerCompanyModal')?.addEventListener('click', event => {
        if (!window.bootstrap && (event.target.matches('[data-bs-dismiss="modal"]') || event.target.closest('[data-bs-dismiss="modal"]'))) closeRegisterModal();
    });
}

function syncVoiceButton(isAuthenticated = Boolean(getSession())) {
    const button = document.getElementById('voice-btn');
    if (button) button.hidden = !isAuthenticated;
}

function getSession() {
    const store = localStorage.getItem('erp_token') ? localStorage : sessionStorage;
    const token = store.getItem('erp_token');
    const role = store.getItem('erp_role');
    return token && role ? {
        token,
        role,
        companyName: store.getItem('erp_company_name') || 'Workspace',
        companyCode: store.getItem('erp_company_code') || '',
        companyType: store.getItem('erp_company_type') || 'Custom Business'
    } : null;
}

function saveSession(data, remember = true) {
    const store = remember ? localStorage : sessionStorage;
    ['erp_token', 'erp_role', 'erp_company_name', 'erp_company_code', 'erp_company_type'].forEach(k => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
    });
    store.setItem('erp_token', data.access_token);
    store.setItem('erp_role', data.role);
    store.setItem('erp_company_name', data.company_name || 'Nexus ERP');
    store.setItem('erp_company_code', data.company_code || '');
    store.setItem('erp_company_type', data.company_type || 'Custom Business');
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

async function readApiResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    let body;
    if (contentType.includes('application/json')) {
        body = await response.json();
    } else {
        body = await response.text();
    }
    if (!response.ok) {
        const errorMsg = typeof body === 'object' && body.detail ? body.detail : (typeof body === 'string' && body ? body : 'The server could not complete this request. Please try again in a moment.');
        throw new Error(errorMsg);
    }
    return body;
}

function renderLogin() {
    syncVoiceButton(false);
    document.getElementById('app-root').innerHTML = `
      <div class="auth-wrapper"><div class="auth-shell">
        <section class="auth-aside"><div class="brand-lockup"><span class="brand-mark"><i class="bi bi-boxes"></i></span><span>Nexus</span></div><div class="auth-aside-copy"><span class="eyebrow">AI-native operations</span><h1>Run every part of your business from one calm workspace.</h1><p>Secure, multi-tenant ERP for the teams building what comes next.</p></div><div class="auth-feature"><i class="bi bi-shield-check"></i><div><strong>Private by design</strong><span>Every workspace is securely isolated.</span></div></div></section>
        <section class="auth-container"><div class="auth-mobile-brand"><span class="brand-mark"><i class="bi bi-boxes"></i></span> Nexus</div><div class="auth-header"><span class="eyebrow">Secure sign in</span><h2>Welcome back</h2><p>Use your workspace credentials to continue.</p></div>
          <form id="login-form">
            <div class="mb-3"><label class="form-label">Access type</label><select id="login-type" class="form-select"><option value="employee">Employee</option><option value="company_admin">Company administrator</option><option value="super_admin">Platform administrator</option></select></div>
            <div class="mb-3" id="company-code-field"><label class="form-label">Company code <span class="text-muted fw-normal">(optional)</span></label><input id="company-code" class="form-control text-uppercase" placeholder="COMP-X8A7K3" autocomplete="organization"></div>
            <div class="mb-3" id="email-field"><label class="form-label">Email address</label><input id="login-email" type="email" class="form-control" autocomplete="email" placeholder="you@company.com" required></div>
            <div class="mb-3"><label class="form-label d-flex justify-content-between" id="password-label">Password <button type="button" id="toggle-password" class="link-button">Show</button></label><input id="login-password" type="password" class="form-control" autocomplete="current-password" required></div>
            <label class="check-row mb-4"><input id="remember-session" type="checkbox" checked><span>Keep me signed in on this device</span></label>
            <button class="btn btn-primary w-100 btn-auth" type="submit"><span>Sign in securely</span><i class="bi bi-arrow-right"></i></button>
          </form>
          <div class="auth-divider"><span>New to Nexus?</span></div>
          <button type="button" class="btn btn-outline-secondary w-100 mb-2" onclick="openRegisterModal()"><i class="bi bi-building-add me-2"></i>Create a company workspace</button>
          <button type="button" class="btn btn-outline-info w-100" onclick="openEmployeeRegisterModal()"><i class="bi bi-person-plus me-2"></i>Register as Employee</button>
          <p class="auth-help">Employees should get a company code from their administrator.</p>
        </section></div></div>`;
    const type = document.getElementById('login-type');
    if (type) type.addEventListener('change', updateLoginFields);
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('toggle-password')?.addEventListener('click', () => {
        const input = document.getElementById('login-password');
        if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
            document.getElementById('toggle-password').textContent = input.type === 'password' ? 'Show' : 'Hide';
        }
    });
    updateLoginFields();
}

function updateLoginFields() {
    const typeEl = document.getElementById('login-type');
    if (!typeEl) return;
    const type = typeEl.value;
    const email = document.getElementById('email-field');
    const code = document.getElementById('company-code-field');
    const passLabel = document.getElementById('password-label');
    if (passLabel && passLabel.childNodes[0]) passLabel.childNodes[0].nodeValue = type === 'super_admin' ? 'Secure PIN ' : 'Password ';
    if (email) email.hidden = type === 'super_admin';
    if (code) code.hidden = type !== 'employee';
    const loginEmail = document.getElementById('login-email');
    if (loginEmail) loginEmail.required = type !== 'super_admin';
}

async function handleLogin(event) {
    event.preventDefault();
    const type = document.getElementById('login-type').value;
    const password = document.getElementById('login-password').value;
    const email = document.getElementById('login-email')?.value.trim() || '';
    const companyCode = document.getElementById('company-code')?.value.trim().toUpperCase() || '';
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span><span>Signing in…</span>';
    try {
        let endpoint, body;
        if (type === 'super_admin') { endpoint = '/auth/super-admin/login'; body = { pin: password }; }
        else if (type === 'company_admin') { endpoint = '/auth/company-admin/login'; body = { email, password }; }
        else if (companyCode) { endpoint = '/auth/employee/login-code'; body = { company_code: companyCode, employee_email: email, password }; }
        else { endpoint = '/auth/employee/login'; body = { email, password }; }
        const response = await fetch(API + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Sign in failed');
        saveSession(data, document.getElementById('remember-session')?.checked ?? true);
        renderWorkspace(getSession());
    } catch (error) { showToast(error.message, 'error'); }
    finally { button.disabled = false; button.innerHTML = '<span>Sign in securely</span><i class="bi bi-arrow-right ms-2"></i>'; }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('erp_theme', target);
    showToast(`Switched to ${target} mode`, 'success');
}

const COMPANY_TYPE_MODULES = {
    'Manufacturing': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Leaves', 'Payroll', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Projects', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'Chemical Industry': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Leaves', 'Payroll', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Notifications', 'Reports', 'Settings'],
    'Pharmaceutical': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Leaves', 'Payroll', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Notifications', 'Reports', 'Settings'],
    'Retail': ['Dashboard', 'Employees', 'Attendance', 'Customers', 'Inventory', 'Sales', 'Invoices', 'Notifications', 'Reports', 'Settings'],
    'Wholesale': ['Dashboard', 'Employees', 'Customers', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Notifications', 'Reports', 'Settings'],
    'Trading': ['Dashboard', 'Employees', 'Customers', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Notifications', 'Reports', 'Settings'],
    'Construction': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Payroll', 'Suppliers', 'Inventory', 'Purchases', 'Projects', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'Hospital': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Leaves', 'Payroll', 'Customers', 'Suppliers', 'Inventory', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'School': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Leaves', 'Payroll', 'Customers', 'Notifications', 'Reports', 'Settings'],
    'College': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Leaves', 'Payroll', 'Customers', 'Projects', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'Restaurant': ['Dashboard', 'Employees', 'Attendance', 'Payroll', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Notifications', 'Reports', 'Settings'],
    'Hotel': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Payroll', 'Customers', 'Suppliers', 'Inventory', 'Sales', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'Logistics': ['Dashboard', 'Employees', 'Attendance', 'Customers', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'Warehouse': ['Dashboard', 'Employees', 'Attendance', 'Suppliers', 'Inventory', 'Purchases', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'Agriculture': ['Dashboard', 'Employees', 'Attendance', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Notifications', 'Reports', 'Settings'],
    'Textile': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Payroll', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Notifications', 'Reports', 'Settings'],
    'Automobile': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Payroll', 'Customers', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Projects', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'Electronics': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Payroll', 'Customers', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Notifications', 'Reports', 'Settings'],
    'IT Company': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Leaves', 'Payroll', 'Customers', 'Invoices', 'Projects', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'Service Business': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Leaves', 'Payroll', 'Customers', 'Sales', 'Invoices', 'Projects', 'Tasks', 'Notifications', 'Reports', 'Settings'],
    'Custom Business': ['Dashboard', 'Employees', 'Departments', 'Attendance', 'Leaves', 'Payroll', 'Customers', 'Suppliers', 'Inventory', 'Sales', 'Purchases', 'Invoices', 'Projects', 'Tasks', 'Notifications', 'Reports', 'Settings'],
};

function renderWorkspace(session) {
    syncVoiceButton(true);
    if (session.role === 'super_admin') return renderSuperAdminDashboard();
    const root = document.getElementById('app-root');
    const availableModules = COMPANY_TYPE_MODULES[session.companyType] || COMPANY_TYPE_MODULES['Custom Business'];
    
    root.innerHTML = `
      <div class="app-layout">
        <aside class="sidebar">
          <div class="sidebar-brand">
            <span class="sidebar-brand-icon"><i class="bi bi-boxes"></i></span>
            <div>
              <h5 class="mb-0">${escapeHtml(session.companyName)}</h5>
              <small class="text-primary fw-semibold" style="font-size:0.75rem">${escapeHtml(session.companyType)}</small>
            </div>
          </div>
          <div class="sidebar-section">
            <p class="sidebar-section-title">Workspace</p>
            <nav class="sidebar-nav">
              ${availableModules.map(name => `<button class="sidebar-link ${name === 'Dashboard' ? 'active' : ''}" data-module="${name.toLowerCase()}"><i class="bi bi-${moduleIcon(name)}"></i>${name}</button>`).join('')}
            </nav>
          </div>
          <div class="sidebar-footer">
            <button class="sidebar-link" onclick="toggleTheme()"><i class="bi bi-circle-half"></i>Toggle Theme</button>
            <button class="sidebar-link text-danger" onclick="logout()"><i class="bi bi-box-arrow-right"></i>Sign out</button>
          </div>
        </aside>
        <main class="main-content">
          <button class="btn btn-ghost mobile-menu-btn" onclick="document.querySelector('.sidebar').classList.toggle('open')"><i class="bi bi-list"></i></button>
          <div id="workspace-content"></div>
        </main>
      </div>`;
    root.querySelectorAll('[data-module]').forEach(button => button.addEventListener('click', () => {
        root.querySelectorAll('[data-module]').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        loadModule(button.dataset.module);
    }));
    // Apply initialized theme
    const savedTheme = localStorage.getItem('erp_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    loadModule('dashboard');
}

function moduleIcon(name) {
    return ({
        Dashboard: 'grid-1x2',
        Employees: 'people-fill',
        Departments: 'diagram-3',
        Attendance: 'calendar-check',
        Leaves: 'calendar-range',
        Payroll: 'cash-coin',
        Customers: 'person-square',
        Suppliers: 'truck',
        Inventory: 'boxes',
        Sales: 'graph-up-arrow',
        Purchases: 'cart',
        Invoices: 'receipt',
        Projects: 'kanban',
        Tasks: 'check2-square',
        Reports: 'bar-chart-line',
        Notifications: 'bell',
        Settings: 'gear'
    })[name];
}

async function api(path, options = {}) {
    const session = getSession();
    const headers = { Authorization: `Bearer ${session ? session.token : ''}`, ...options.headers };
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    const response = await fetch(API + path, { ...options, headers });
    if (response.status === 401) { logout(); throw new Error('Your session has expired.'); }
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.detail || 'Request failed');
    return data;
}

async function loadModule(module) {
    const target = document.getElementById('workspace-content');
    target.innerHTML = '<div class="skeleton skeleton-card mb-3"></div><div class="skeleton skeleton-card"></div>';
    try {
        if (module === 'dashboard') {
            return renderDashboard(await api('/erp/dashboard'));
        }
        if (module === 'settings') {
            return renderSettings(await api('/erp/settings'));
        }
        if (module === 'reports') {
            return renderReports(await api('/erp/reports'));
        }
        const records = await api(`/erp/${module}`);
        renderRecords(module, records);
    } catch (error) {
        target.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
    }
}

function renderReports(data) {
    const summary = data.summary || {};
    document.getElementById('workspace-content').innerHTML = `
        <div class="page-header">
            <div>
                <h2>Reports & Analytics</h2>
                <p class="text-muted mb-0">Executive reports and data export center.</p>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-secondary" onclick="window.print()"><i class="bi bi-printer me-1"></i>Print Report</button>
                <button class="btn btn-primary" onclick="exportReportsCsv()"><i class="bi bi-download me-1"></i>Export CSV Summary</button>
            </div>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-sm-6 col-xl-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <h6 class="text-muted">Total Revenue</h6>
                        <div class="stat-value text-success">${summary.total_revenue?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '₹0.00'}</div>
                        <small class="text-muted">From Sales Orders</small>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-xl-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <h6 class="text-muted">Total Expenses</h6>
                        <div class="stat-value text-danger">${summary.total_expenses?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '₹0.00'}</div>
                        <small class="text-muted">Purchases & Payroll</small>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-xl-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <h6 class="text-muted">Net Profit</h6>
                        <div class="stat-value ${summary.net_profit >= 0 ? 'text-primary' : 'text-warning'}">${summary.net_profit?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '₹0.00'}</div>
                        <small class="text-muted">Net Operating Profit</small>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-xl-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <h6 class="text-muted">Inventory Valuation</h6>
                        <div class="stat-value text-info">${summary.inventory_valuation?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '₹0.00'}</div>
                        <small class="text-muted">Total Asset Value</small>
                    </div>
                </div>
            </div>
        </div>

        <div class="card p-4 mb-4">
            <h5 class="mb-3">Detailed Module Metrics</h5>
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Report Category</th>
                            <th>Key Metric 1</th>
                            <th>Key Metric 2</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Sales Report</strong></td>
                            <td>Total Orders: ${data.sales?.total_orders || 0}</td>
                            <td>Revenue: ₹${data.sales?.total_amount || 0}</td>
                            <td><button class="btn btn-sm btn-outline-primary" onclick="exportCategoryCsv('Sales', [['Total Orders', '${data.sales?.total_orders}'], ['Total Revenue', '₹${data.sales?.total_amount}']])">Export Sales CSV</button></td>
                        </tr>
                        <tr>
                            <td><strong>Purchases Report</strong></td>
                            <td>Purchase Orders: ${data.purchases?.total_orders || 0}</td>
                            <td>Expenses: ₹${data.purchases?.total_amount || 0}</td>
                            <td><button class="btn btn-sm btn-outline-primary" onclick="exportCategoryCsv('Purchases', [['Total Orders', '${data.purchases?.total_orders}'], ['Total Expenses', '₹${data.purchases?.total_amount}']])">Export Purchases CSV</button></td>
                        </tr>
                        <tr>
                            <td><strong>Payroll Report</strong></td>
                            <td>Total Salary Payout: ₹${data.payroll?.total_payout || 0}</td>
                            <td>Status: Calculated</td>
                            <td><button class="btn btn-sm btn-outline-primary" onclick="exportCategoryCsv('Payroll', [['Total Payout', '₹${data.payroll?.total_payout}']])">Export Payroll CSV</button></td>
                        </tr>
                        <tr>
                            <td><strong>Inventory Report</strong></td>
                            <td>Item SKUs: ${data.inventory?.item_types || 0}</td>
                            <td>Total Valuation: ₹${data.inventory?.valuation || 0}</td>
                            <td><button class="btn btn-sm btn-outline-primary" onclick="exportCategoryCsv('Inventory', [['Item SKUs', '${data.inventory?.item_types}'], ['Valuation', '₹${data.inventory?.valuation}']])">Export Inventory CSV</button></td>
                        </tr>
                        <tr>
                            <td><strong>CRM (Customers & Suppliers)</strong></td>
                            <td>Customers: ${data.crm?.customers || 0}</td>
                            <td>Suppliers: ${data.crm?.suppliers || 0}</td>
                            <td><button class="btn btn-sm btn-outline-primary" onclick="exportCategoryCsv('CRM', [['Customers', '${data.crm?.customers}'], ['Suppliers', '${data.crm?.suppliers}']])">Export CRM CSV</button></td>
                        </tr>
                        <tr>
                            <td><strong>Attendance Report</strong></td>
                            <td>Present: ${data.attendance?.present || 0}</td>
                            <td>Absent: ${data.attendance?.absent || 0}</td>
                            <td><button class="btn btn-sm btn-outline-primary" onclick="exportCategoryCsv('Attendance', [['Present', '${data.attendance?.present}'], ['Absent', '${data.attendance?.absent}']])">Export Attendance CSV</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`;
    window.lastReportData = data;
}

function exportCategoryCsv(category, rows) {
    let csvContent = "data:text/csv;charset=utf-8," + `Metric,Value\n` + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${category.toLowerCase()}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${category} CSV report downloaded`, 'success');
}

function exportReportsCsv() {
    if (!window.lastReportData) return showToast('No report data available to export', 'error');
    const d = window.lastReportData.summary || {};
    const rows = [
        ["Report", "Executive ERP Summary"],
        ["Total Revenue", d.total_revenue || 0],
        ["Total Expenses", d.total_expenses || 0],
        ["Net Profit", d.net_profit || 0],
        ["Inventory Valuation", d.inventory_valuation || 0]
    ];
    exportCategoryCsv("Executive_Summary", rows);
}

function renderDashboard(data) {
    document.getElementById('workspace-content').innerHTML = `
        <div class="page-header">
            <div>
                <h2>Dashboard</h2>
                <p class="text-muted mb-0">A real-time view of your business.</p>
            </div>
        </div>
        <div class="row g-3">
            ${[
                ['Revenue', data.revenue, 'currency-dollar'],
                ['Expenses', data.expenses, 'wallet2'],
                ['Profit', data.profit, 'graph-up'],
                ['Employees', data.total_employees, 'people'],
                ['Customers', data.total_customers, 'person-heart'],
                ['Inventory Items', data.total_inventory, 'boxes'],
                ['Pending Invoices', data.pending_invoices, 'receipt'],
                ['Open Tasks', data.pending_tasks, 'check2-square']
            ].map(([label, value, icon]) => `
                <div class="col-sm-6 col-xl-3">
                    <div class="card stat-card h-100">
                        <div class="card-body d-flex justify-content-between">
                            <div>
                                <h6>${label}</h6>
                                <div class="stat-value">${typeof value === 'number' && ['Revenue', 'Expenses', 'Profit'].includes(label) ? value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) : value}</div>
                            </div>
                            <div class="stat-icon bg-primary-subtle text-primary">
                                <i class="bi bi-${icon}"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="row g-3 mt-3">
            <div class="col-md-6">
                <div class="card p-3">
                    <h5>Monthly Overview</h5>
                    <canvas id="overviewChart"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card p-3">
                    <h5>Quick Actions</h5>
                    <div class="d-grid gap-2">
                        <button class="btn btn-primary text-start" onclick="loadModule('customers')"><i class="bi bi-person-plus me-2"></i>Add Customer</button>
                        <button class="btn btn-outline-primary text-start" onclick="loadModule('inventory')"><i class="bi bi-box-seam me-2"></i>Manage Inventory</button>
                        <button class="btn btn-outline-secondary text-start" onclick="loadModule('tasks')"><i class="bi bi-check2-square me-2"></i>Assign Tasks</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-body">
                <h5 class="mb-1">AI Assistant is active</h5>
                <p class="text-muted mb-0">Click the floating microphone button to speak commands like: "show inventory", "open crm", "create task finish report", etc.</p>
            </div>
        </div>`;
        
    // Build Chart.js Graph
    const ctx = document.getElementById('overviewChart')?.getContext('2d');
    if (ctx) {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Revenue', 'Expenses', 'Profit'],
                datasets: [{
                    label: 'Financial Performance (₹)',
                    data: [data.revenue, data.expenses, data.profit],
                    backgroundColor: ['rgba(99, 102, 241, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(16, 185, 129, 0.8)']
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
    }
}

function renderSettings(data) {
    const session = getSession();
    document.getElementById('workspace-content').innerHTML = `
        <div class="page-header">
            <div>
                <h2>Settings</h2>
                <p class="text-muted mb-0">Manage workspace options.</p>
            </div>
        </div>
        <div class="card p-4">
            <h5>Workspace Details</h5>
            <div class="mb-3">
                <label class="form-label">Company Code</label>
                <div class="input-group">
                    <input class="form-control font-mono" value="${escapeHtml(session.companyCode)}" readonly>
                    <button class="btn btn-outline-secondary" onclick="navigator.clipboard.writeText('${session.companyCode}'); showToast('Code copied!', 'success');">Copy</button>
                </div>
                <div class="form-text">Share this code with employees so they can join.</div>
            </div>
            
            <hr>
            
            <h5>Preferences</h5>
            <form id="settings-form">
                <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox" id="voiceToggle" checked>
                    <label class="form-check-label" for="voiceToggle">Enable speech synthesis responses</label>
                </div>
                <button type="submit" class="btn btn-primary">Save Settings</button>
            </form>
        </div>`;
    document.getElementById('settings-form').addEventListener('submit', event => {
        event.preventDefault();
        showToast('Settings saved successfully', 'success');
    });
}

function renderRecords(module, records) {
    const title = module[0].toUpperCase() + module.slice(1);
    const headings = records[0] ? Object.keys(records[0]).filter(key => !['company_id', 'id'].includes(key)).slice(0, 6) : [];
    
    const rows = records.map(record => `
        <tr>
            ${Object.entries(record).filter(([key]) => !['company_id', 'id'].includes(key)).slice(0, 6).map(([, value]) => `<td>${escapeHtml(value ?? '—')}</td>`).join('')}
        </tr>`).join('');

    document.getElementById('workspace-content').innerHTML = `
        <div class="page-header">
            <div>
                <h2>${title}</h2>
                <p class="text-muted mb-0">Manage and create company ${module}.</p>
            </div>
            ${module !== 'notifications' ? `<button class="btn btn-primary" onclick="showAddForm('${module}')"><i class="bi bi-plus-lg me-1"></i>Add ${title.slice(0, -1) || title}</button>` : ''}
        </div>
        
        <div id="add-form-container" class="card mb-4 p-4 d-none">
            <!-- Dynamic form inserts here -->
        </div>
        
        <div class="card">
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead>
                        <tr>
                            ${headings.map(key => `<th>${escapeHtml(key.replaceAll('_', ' '))}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || `<tr><td colspan="${Math.max(headings.length, 1)}" class="text-center text-muted p-5">No ${escapeHtml(module)} yet.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

async function showAddForm(module) {
    const container = document.getElementById('add-form-container');
    container.classList.remove('d-none');
    container.innerHTML = '<div class="spinner-border spinner-border-sm text-primary me-2"></div><span>Loading form options…</span>';
    
    let employees = [], customers = [], suppliers = [], projects = [];
    try {
        if (['attendance', 'leaves', 'payroll', 'tasks'].includes(module)) {
            employees = await api('/erp/employees');
        }
        if (['sales', 'invoices'].includes(module)) {
            customers = await api('/erp/customers');
        }
        if (module === 'purchases') {
            suppliers = await api('/erp/suppliers');
        }
        if (module === 'tasks') {
            projects = await api('/erp/projects');
        }
    } catch (err) {
        console.warn('Could not load relational dropdown data:', err);
    }

    const empOptions = employees.length
        ? employees.map(e => `<option value="${e.id}">${escapeHtml(e.employee_name)} (${escapeHtml(e.department || 'Staff')})</option>`).join('')
        : '<option value="">No employees found — Register an employee first</option>';

    let fieldsHtml = '';
    if (module === 'customers' || module === 'suppliers') {
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Name</label><input id="form-name" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Email</label><input id="form-email" type="email" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Phone</label><input id="form-phone" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Address</label><input id="form-address" class="form-control"></div>
            </div>`;
    } else if (module === 'inventory') {
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Item Name</label><input id="form-name" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">SKU</label><input id="form-sku" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Category</label><input id="form-category" class="form-control"></div>
                <div class="col-md-4"><label class="form-label">Quantity</label><input id="form-quantity" type="number" class="form-control" value="0"></div>
                <div class="col-md-4"><label class="form-label">Unit Price (₹)</label><input id="form-price" type="number" step="0.01" class="form-control" value="0.00"></div>
                <div class="col-md-4"><label class="form-label">Warehouse</label><input id="form-warehouse" class="form-control" value="Main"></div>
            </div>`;
    } else if (module === 'employees') {
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Employee Name</label><input id="form-name" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Email</label><input id="form-email" type="email" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Mobile Number</label><input id="form-mobile" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Department</label><input id="form-department" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Designation</label><input id="form-designation" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Password</label><input id="form-password" type="password" class="form-control" required></div>
            </div>`;
    } else if (module === 'departments') {
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Department Name</label><input id="form-name" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Description</label><input id="form-desc" class="form-control"></div>
            </div>`;
    } else if (module === 'sales') {
        const custOptions = customers.length
            ? customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
            : '<option value="">Select or leave blank</option>';
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Select Customer</label><select id="form-customer-id" class="form-select">${custOptions}</select></div>
                <div class="col-md-6"><label class="form-label">Total Amount (₹)</label><input id="form-amount" type="number" step="0.01" class="form-control" required></div>
                <div class="col-md-12"><label class="form-label">Notes</label><input id="form-notes" class="form-control" placeholder="Sales order notes"></div>
            </div>`;
    } else if (module === 'purchases') {
        const supOptions = suppliers.length
            ? suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')
            : '<option value="">Select or leave blank</option>';
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Select Supplier</label><select id="form-supplier-id" class="form-select">${supOptions}</select></div>
                <div class="col-md-6"><label class="form-label">Total Amount (₹)</label><input id="form-amount" type="number" step="0.01" class="form-control" required></div>
                <div class="col-md-12"><label class="form-label">Notes</label><input id="form-notes" class="form-control" placeholder="Purchase order notes"></div>
            </div>`;
    } else if (module === 'invoices') {
        const custOptions = customers.length
            ? customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
            : '<option value="">Select or leave blank</option>';
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Select Customer</label><select id="form-customer-id" class="form-select">${custOptions}</select></div>
                <div class="col-md-6"><label class="form-label">Total Amount (₹)</label><input id="form-amount" type="number" step="0.01" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Due Date</label><input id="form-duedate" type="date" class="form-control" required></div>
            </div>`;
    } else if (module === 'projects') {
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Project Name</label><input id="form-name" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Description</label><input id="form-desc" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Budget (₹)</label><input id="form-budget" type="number" step="0.01" class="form-control" value="0.00"></div>
            </div>`;
    } else if (module === 'tasks') {
        const assignOptions = employees.length
            ? employees.map(e => `<option value="${e.id}">${escapeHtml(e.employee_name)}</option>`).join('')
            : '<option value="">Unassigned</option>';
        const projOptions = projects.length
            ? projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')
            : '<option value="">General Project</option>';
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Task Title</label><input id="form-title" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Assign To Employee</label><select id="form-assigned" class="form-select">${assignOptions}</select></div>
                <div class="col-md-6"><label class="form-label">Project</label><select id="form-project" class="form-select">${projOptions}</select></div>
                <div class="col-md-6"><label class="form-label">Priority</label><select id="form-priority" class="form-select"><option>low</option><option selected>medium</option><option>high</option><option>urgent</option></select></div>
                <div class="col-md-12"><label class="form-label">Description</label><input id="form-desc" class="form-control"></div>
            </div>`;
    } else if (module === 'leaves') {
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Select Employee</label><select id="form-emp-id" class="form-select" required>${empOptions}</select></div>
                <div class="col-md-6"><label class="form-label">Leave Type</label><select id="form-type" class="form-select"><option>sick</option><option>casual</option><option>annual</option></select></div>
                <div class="col-md-6"><label class="form-label">Start Date</label><input id="form-start" type="date" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">End Date</label><input id="form-end" type="date" class="form-control" required></div>
                <div class="col-md-12"><label class="form-label">Reason</label><input id="form-reason" class="form-control" placeholder="Reason for leave"></div>
            </div>`;
    } else if (module === 'payroll') {
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Select Employee</label><select id="form-emp-id" class="form-select" required>${empOptions}</select></div>
                <div class="col-md-6"><label class="form-label">Month</label><input id="form-month" class="form-control" placeholder="July 2026" required></div>
                <div class="col-md-4"><label class="form-label">Basic Salary (₹)</label><input id="form-basic" type="number" step="0.01" class="form-control" required></div>
                <div class="col-md-4"><label class="form-label">Allowances (₹)</label><input id="form-allowances" type="number" step="0.01" class="form-control" value="0.00"></div>
                <div class="col-md-4"><label class="form-label">Deductions (₹)</label><input id="form-deductions" type="number" step="0.01" class="form-control" value="0.00"></div>
            </div>`;
    } else if (module === 'attendance') {
        fieldsHtml = `
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Select Employee</label><select id="form-emp-id" class="form-select" required>${empOptions}</select></div>
                <div class="col-md-6"><label class="form-label">Date</label><input id="form-date" type="date" class="form-control" value="${new Date().toISOString().slice(0,10)}" required></div>
                <div class="col-md-6"><label class="form-label">Status</label><select id="form-status" class="form-select"><option>present</option><option>absent</option><option>late</option><option>half_day</option></select></div>
            </div>`;
    }

    container.innerHTML = `
        <h5 class="mb-3">Add New Record</h5>
        <form id="record-form">
            ${fieldsHtml}
            <div class="mt-4">
                <button type="submit" class="btn btn-primary">Save Record</button>
                <button type="button" class="btn btn-ghost" onclick="document.getElementById('add-form-container').classList.add('d-none')">Cancel</button>
            </div>
        </form>`;
        
    document.getElementById('record-form').addEventListener('submit', event => submitRecordForm(event, module));
}

async function submitRecordForm(event, module) {
    event.preventDefault();
    const btn = event.currentTarget.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving…';
    
    let payload = {};
    if (module === 'customers' || module === 'suppliers') {
        payload = {
            name: document.getElementById('form-name').value,
            email: document.getElementById('form-email').value,
            phone: document.getElementById('form-phone').value,
            address: document.getElementById('form-address').value
        };
    } else if (module === 'inventory') {
        payload = {
            name: document.getElementById('form-name').value,
            sku: document.getElementById('form-sku').value,
            category: document.getElementById('form-category').value,
            quantity: parseInt(document.getElementById('form-quantity').value) || 0,
            unit_price: parseFloat(document.getElementById('form-price').value) || 0.0,
            warehouse: document.getElementById('form-warehouse').value
        };
    } else if (module === 'employees') {
        const session = getSession();
        payload = {
            company_code: session.companyCode,
            employee_name: document.getElementById('form-name').value,
            employee_email: document.getElementById('form-email').value,
            mobile_number: document.getElementById('form-mobile').value,
            department: document.getElementById('form-department').value,
            designation: document.getElementById('form-designation').value,
            password: document.getElementById('form-password').value
        };
    } else if (module === 'departments') {
        payload = {
            name: document.getElementById('form-name').value,
            description: document.getElementById('form-desc').value
        };
    } else if (module === 'sales') {
        payload = {
            customer_id: parseInt(document.getElementById('form-customer-id')?.value) || null,
            total_amount: parseFloat(document.getElementById('form-amount').value) || 0.0,
            notes: document.getElementById('form-notes').value
        };
    } else if (module === 'purchases') {
        payload = {
            supplier_id: parseInt(document.getElementById('form-supplier-id')?.value) || null,
            total_amount: parseFloat(document.getElementById('form-amount').value) || 0.0,
            notes: document.getElementById('form-notes').value
        };
    } else if (module === 'invoices') {
        payload = {
            customer_id: parseInt(document.getElementById('form-customer-id')?.value) || null,
            total_amount: parseFloat(document.getElementById('form-amount').value) || 0.0,
            due_date: document.getElementById('form-duedate').value
        };
    } else if (module === 'projects') {
        payload = {
            name: document.getElementById('form-name').value,
            description: document.getElementById('form-desc').value,
            budget: parseFloat(document.getElementById('form-budget').value) || 0.0
        };
    } else if (module === 'tasks') {
        payload = {
            title: document.getElementById('form-title').value,
            description: document.getElementById('form-desc').value,
            priority: document.getElementById('form-priority').value,
            assigned_to: parseInt(document.getElementById('form-assigned')?.value) || null,
            project_id: parseInt(document.getElementById('form-project')?.value) || null
        };
    } else if (module === 'leaves') {
        payload = {
            employee_id: parseInt(document.getElementById('form-emp-id').value),
            leave_type: document.getElementById('form-type').value,
            start_date: document.getElementById('form-start').value,
            end_date: document.getElementById('form-end').value,
            reason: document.getElementById('form-reason').value
        };
    } else if (module === 'payroll') {
        payload = {
            employee_id: parseInt(document.getElementById('form-emp-id').value),
            month: document.getElementById('form-month').value,
            basic_salary: parseFloat(document.getElementById('form-basic').value) || 0.0,
            allowances: parseFloat(document.getElementById('form-allowances').value) || 0.0,
            deductions: parseFloat(document.getElementById('form-deductions').value) || 0.0
        };
    }

    try {
        const path = module === 'employees' ? '/employees/register' : `/erp/${module}`;
        await api(path, { method: 'POST', body: payload });
        showToast('Record saved successfully!', 'success');
        loadModule(module);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Save Record';
    }
}

function openEmployeeRegisterModal() {
    openRegisterModal();
    // Re-render model body for employee registration
    document.getElementById('register-modal-body').innerHTML = `
        <div class="mb-4">
            <h4 class="mb-1">Employee Registration</h4>
            <p class="text-muted small mb-0">Join your company's workspace using the unique company code.</p>
        </div>
        <form id="emp-reg-form">
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Company Code</label><input id="emp-ccode" class="form-control text-uppercase" placeholder="COMP-XXXXXX" required></div>
                <div class="col-md-6"><label class="form-label">Full Name</label><input id="emp-name" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Email Address</label><input id="emp-email" type="email" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Mobile Number</label><input id="emp-mobile" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Department</label><input id="emp-dept" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Designation</label><input id="emp-desig" class="form-control"></div>
                <div class="col-md-12"><label class="form-label">Password</label><input id="emp-pass" type="password" minlength="8" class="form-control" required></div>
            </div>
            <button class="btn btn-primary w-100 mt-4" type="submit">Register Account</button>
        </form>`;
    document.getElementById('emp-reg-form').addEventListener('submit', handleEmployeeRegister);
}

async function handleEmployeeRegister(event) {
    event.preventDefault();
    const btn = event.currentTarget.querySelector('button');
    btn.disabled = true; btn.textContent = 'Registering…';
    
    const payload = {
        company_code: document.getElementById('emp-ccode').value.trim().toUpperCase(),
        employee_name: document.getElementById('emp-name').value.trim(),
        employee_email: document.getElementById('emp-email').value.trim(),
        mobile_number: document.getElementById('emp-mobile').value.trim(),
        department: document.getElementById('emp-dept').value.trim(),
        designation: document.getElementById('emp-desig').value.trim(),
        password: document.getElementById('emp-pass').value
    };

    try {
        const response = await fetch(API + '/employees/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Registration failed');
        showToast('Registration successful! You can now log in.', 'success');
        closeRegisterModal();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Register Account';
    }
}

function toggleVoiceAssistant() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!getSession()) return showToast('Sign in before using the voice assistant.', 'info');
    if (!SpeechRecognition) return showToast('Speech recognition is not available in this browser. Try Chrome or Edge.', 'info');
    if (recognition) return recognition.stop();
    recognition = new SpeechRecognition(); recognition.lang = 'en-US'; recognition.interimResults = false;
    const button = document.getElementById('voice-btn'); button.classList.add('listening');
    recognition.onresult = event => handleVoiceCommand(event.results[0][0].transcript);
    recognition.onerror = () => showToast('I could not hear that. Please try again.', 'error');
    recognition.onend = () => { button.classList.remove('listening'); recognition = undefined; };
    recognition.start(); showToast('Listening…', 'info');
}

async function handleVoiceCommand(transcript) {
    const command = transcript.toLowerCase();
    const matches = {
        inventory: 'inventory',
        customer: 'customers',
        supplier: 'suppliers',
        sales: 'sales',
        purchase: 'purchases',
        invoice: 'invoices',
        project: 'projects',
        task: 'tasks',
        notification: 'notifications',
        dashboard: 'dashboard',
        employee: 'employees',
        department: 'departments',
        attendance: 'attendance',
        leave: 'leaves',
        payroll: 'payroll',
        settings: 'settings'
    };
    
    // First try a quick local route match
    const module = Object.entries(matches).find(([word]) => command.includes(word))?.[1];
    if (module && (command.startsWith('open ') || command.startsWith('show '))) {
        loadModule(module);
        speak(`Opening ${module}`);
        showToast(`Voice command: ${transcript}`, 'success');
        return;
    }
    
    // Otherwise fallback to the backend AI-native voice processing endpoint
    try {
        const response = await api('/erp/ai-voice', {
            method: 'POST',
            body: { transcript }
        });
        
        if (response.speech) speak(response.speech);
        showToast(`AI Response: ${response.speech}`, 'success');
        
        if (response.action === 'navigate' && response.target) {
            loadModule(response.target);
            // Highlight the active button in sidebar
            document.querySelectorAll('[data-module]').forEach(item => {
                item.classList.toggle('active', item.dataset.module === response.target);
            });
        } else if (response.action === 'refresh' && response.target) {
            loadModule(response.target);
        }
    } catch (err) {
        showToast('AI command fallback failed. Try again.', 'error');
    }
}

function speak(text) {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
}

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.append(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.textContent = message;
    container.append(toast);
    setTimeout(() => toast.remove(), 4500);
}

function logout() {
    if (recognition) recognition.stop();
    [localStorage, sessionStorage].forEach(store => {
        store.removeItem('erp_token');
        store.removeItem('erp_role');
        store.removeItem('erp_company_name');
        store.removeItem('erp_company_code');
    });
    renderLogin();
}

function renderSuperAdminDashboard() {
    const root = document.getElementById('app-root');
    root.innerHTML = `<div class="app-layout admin-layout"><aside class="sidebar"><div class="sidebar-brand"><span class="sidebar-brand-icon"><i class="bi bi-shield-lock"></i></span><div><h5>Nexus Control</h5><small>Platform administrator</small></div></div><div class="sidebar-section"><p class="sidebar-section-title">Platform</p><nav class="sidebar-nav"><button class="sidebar-link active" data-admin-view="overview"><i class="bi bi-grid-1x2"></i>Overview</button><button class="sidebar-link" data-admin-view="companies"><i class="bi bi-buildings"></i>Companies</button></nav></div><div class="sidebar-footer"><div class="admin-identity"><span class="admin-avatar">SA</span><div><strong>Super Admin</strong><small>Platform owner</small></div></div><button class="sidebar-link text-danger" onclick="logout()"><i class="bi bi-box-arrow-right"></i>Sign out</button></div></aside><main class="main-content"><header class="app-topbar"><button class="btn btn-ghost mobile-menu-btn" onclick="document.querySelector('.sidebar').classList.toggle('open')"><i class="bi bi-list"></i></button><div class="topbar-spacer"></div><span class="live-pill"><i class="bi bi-circle-fill"></i>Platform online</span><button class="icon-button" onclick="fetchAdminData()" title="Refresh data"><i class="bi bi-arrow-clockwise"></i></button></header><div id="admin-content"></div></main></div>`;
    root.querySelectorAll('[data-admin-view]').forEach(button => button.addEventListener('click', () => { root.querySelectorAll('[data-admin-view]').forEach(item => item.classList.remove('active')); button.classList.add('active'); renderAdminView(button.dataset.adminView); }));
    fetchAdminData();
}

let adminData = { overview: null, companies: [] };
async function fetchAdminData() {
    const target = document.getElementById('admin-content');
    if (target) target.innerHTML = '<div class="skeleton skeleton-card mb-3"></div><div class="skeleton skeleton-card"></div>';
    try {
        const [overview, companies] = await Promise.all([api('/companies/platform/overview'), api('/companies/')]);
        adminData = { overview, companies }; renderAdminView(document.querySelector('[data-admin-view].active')?.dataset.adminView || 'overview');
    } catch (error) { if (target) target.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`; }
}

function renderAdminView(view) {
    if (!adminData.overview) return;
    document.getElementById('admin-content').innerHTML = view === 'companies' ? adminCompaniesView() : adminOverviewView();
    if (view === 'companies') {
        renderCompanyRows();
        const searchInput = document.getElementById('company-search');
        const typeSelect = document.getElementById('company-type-filter');
        const updateRows = () => renderCompanyRows(searchInput?.value || '', typeSelect?.value || '');
        searchInput?.addEventListener('input', updateRows);
        typeSelect?.addEventListener('change', updateRows);
    }
}

function adminOverviewView() {
    const stats = adminData.overview;
    return `<div class="page-header admin-header"><div><span class="eyebrow">Platform command center</span><h2>Good to see you</h2><p class="text-muted mb-0">A live snapshot of your Nexus platform.</p></div><button class="btn btn-primary" onclick="openRegisterModal()"><i class="bi bi-plus-lg me-1"></i>New company</button></div><div class="row g-3 mb-4">${[[stats.total_companies,'Companies','buildings','primary'],[stats.active_companies,'Active workspaces','check-circle','success'],[stats.total_employees,'Total users','people','info'],[stats.suspended_companies,'Suspended','pause-circle','warning']].map(([value,label,icon,tone]) => `<div class="col-sm-6 col-xl-3"><div class="card stat-card admin-stat h-100"><div class="card-body"><div class="stat-icon tone-${tone}"><i class="bi bi-${icon}"></i></div><div><h6>${label}</h6><div class="stat-value">${value}</div><span class="stat-caption">${label === 'Total users' ? `${stats.active_employees} active` : 'Updated just now'}</span></div></div></div></div>`).join('')}</div><div class="row g-3"><div class="col-xl-8"><section class="card h-100"><div class="card-body"><div class="section-heading"><div><h5>Workspace health</h5><p>Tenant activity across the platform</p></div><button class="btn btn-sm btn-outline-secondary" onclick="document.querySelector('[data-admin-view=companies]').click()">View companies</button></div><div class="health-bars"><div><span>Active workspaces</span><strong>${stats.active_companies} / ${stats.total_companies}</strong><div class="progress"><div class="progress-bar bg-success" style="width:${stats.total_companies ? (stats.active_companies / stats.total_companies) * 100 : 0}%"></div></div></div><div><span>Active employee accounts</span><strong>${stats.active_employees} / ${stats.total_employees}</strong><div class="progress"><div class="progress-bar" style="width:${stats.total_employees ? (stats.active_employees / stats.total_employees) * 100 : 0}%"></div></div></div></div></div></section></div><div class="col-xl-4"><section class="card h-100"><div class="card-body"><div class="section-heading"><div><h5>Quick actions</h5><p>Common platform tasks</p></div></div><div class="quick-actions"><button onclick="openRegisterModal()"><i class="bi bi-building-add"></i>Create workspace</button><button onclick="document.querySelector('[data-admin-view=companies]').click()"><i class="bi bi-sliders"></i>Manage tenants</button><button onclick="fetchAdminData()"><i class="bi bi-arrow-clockwise"></i>Refresh insights</button></div></div></section></div></div>`;
}

function adminCompaniesView() {
    const types = ['All Company Types', 'Manufacturing', 'Chemical Industry', 'Pharmaceutical', 'Retail', 'Wholesale', 'Trading', 'Construction', 'Hospital', 'School', 'College', 'Restaurant', 'Hotel', 'Logistics', 'Warehouse', 'Agriculture', 'Textile', 'Automobile', 'Electronics', 'IT Company', 'Service Business', 'Custom Business'];
    return `<div class="page-header admin-header">
        <div>
            <span class="eyebrow">Tenant directory</span>
            <h2>Companies</h2>
            <p class="text-muted mb-0">Search, filter by industry template, activate, or suspend workspaces.</p>
        </div>
        <button class="btn btn-primary" onclick="openRegisterModal()"><i class="bi bi-plus-lg me-1"></i>New company</button>
    </div>
    <section class="card">
        <div class="directory-toolbar d-flex flex-wrap gap-2 align-items-center justify-content-between p-3 border-bottom">
            <div class="d-flex flex-wrap gap-2 flex-grow-1" style="max-width: 700px;">
                <div class="search-field flex-grow-1" style="min-width: 250px;">
                    <i class="bi bi-search"></i>
                    <input id="company-search" class="form-control" placeholder="Search by company, owner, email, or code">
                </div>
                <select id="company-type-filter" class="form-select" style="width: 220px;">
                    ${types.map(t => `<option value="${t === 'All Company Types' ? '' : t}">${t}</option>`).join('')}
                </select>
            </div>
            <span class="text-muted small">${adminData.companies.length} total companies</span>
        </div>
        <div class="table-responsive">
            <table class="table table-hover admin-table mb-0 align-middle">
                <thead>
                    <tr>
                        <th>Workspace</th>
                        <th>Owner</th>
                        <th>Company code</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody id="companies-table-body"></tbody>
            </table>
        </div>
    </section>`;
}

let registrationData = {};
function openRegisterModal() {
    registrationData = { platformCreation: getSession()?.role === 'super_admin' };
    renderRegistrationStep1();
    const modal = document.getElementById('registerCompanyModal');
    if (window.bootstrap?.Modal) {
        bootstrap.Modal.getOrCreateInstance(modal).show();
        return;
    }
    modal.style.display = 'block';
    modal.removeAttribute('aria-hidden');
    modal.setAttribute('aria-modal', 'true');
    modal.classList.add('show');
    document.body.classList.add('modal-open');
}
function closeRegisterModal() {
    const modal = document.getElementById('registerCompanyModal');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
}
function renderRegistrationStep1() {
    const types = ['Manufacturing', 'Chemical Industry', 'Pharmaceutical', 'Retail', 'Wholesale', 'Trading', 'Construction', 'Hospital', 'School', 'Restaurant', 'Hotel', 'Logistics', 'Warehouse', 'Agriculture', 'Textile', 'Automobile', 'Electronics', 'IT Company', 'Service Business', 'Custom Business'];
    document.getElementById('register-modal-body').innerHTML = `<div class="mb-4"><span class="eyebrow">Step 1 of 2</span><h4 class="mt-2 mb-1">Create your workspace</h4><p class="text-muted small mb-0">Your verified email becomes the company administrator account.</p></div><form id="reg-step-1"><div class="row g-3"><div class="col-md-6"><label class="form-label">Company name</label><input id="reg-cname" class="form-control" autocomplete="organization" required></div><div class="col-md-6"><label class="form-label">Company type</label><select id="reg-ctype" class="form-select">${types.map(type => `<option>${type}</option>`).join('')}</select></div><div class="col-md-6"><label class="form-label">Owner name</label><input id="reg-oname" class="form-control" autocomplete="name" required></div><div class="col-md-6"><label class="form-label">Business email</label><input id="reg-email" type="email" class="form-control" autocomplete="email" required></div><div class="col-md-6"><label class="form-label">Mobile number</label><input id="reg-mobile" type="tel" class="form-control" autocomplete="tel" required></div><div class="col-md-6"><label class="form-label">Admin password</label><input id="reg-pass" type="password" minlength="8" class="form-control" autocomplete="new-password" required><div class="form-text">8+ characters with upper-case, lower-case, and a number.</div></div></div><button class="btn btn-primary w-100 mt-4" type="submit">Send verification code <i class="bi bi-arrow-right ms-1"></i></button></form>`;
    const form = document.getElementById('reg-step-1');
    if (registrationData.platformCreation) {
        form.querySelector('button[type="submit"]').innerHTML = 'Create workspace <i class="bi bi-arrow-right ms-1"></i>';
        form.addEventListener('submit', createCompanyAsSuperAdmin);
    } else {
        form.querySelector('button[type="submit"]').innerHTML = 'Send verification code <i class="bi bi-arrow-right ms-1"></i>';
        form.addEventListener('submit', requestOtp);
    }
}
function companyFormData() { return { company_name: document.getElementById('reg-cname').value.trim(), company_type: document.getElementById('reg-ctype').value, owner_name: document.getElementById('reg-oname').value.trim(), business_email: document.getElementById('reg-email').value.trim(), mobile_number: document.getElementById('reg-mobile').value.trim(), password: document.getElementById('reg-pass').value }; }
function submitCompanyRequest(event) { registrationData = companyFormData(); registerCompany(event); }
async function requestOtp(event) {
    event.preventDefault();
    registrationData = { company_name: document.getElementById('reg-cname').value.trim(), company_type: document.getElementById('reg-ctype').value, owner_name: document.getElementById('reg-oname').value.trim(), business_email: document.getElementById('reg-email').value.trim(), mobile_number: document.getElementById('reg-mobile').value.trim(), password: document.getElementById('reg-pass').value };
    const button = event.currentTarget.querySelector('button'); button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending code…';
    try {
        const response = await fetch(API + '/companies/request-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:registrationData.business_email}) });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Could not send OTP');
        if (data.dev_otp) {
            showToast(`Verification code: ${data.dev_otp}`, 'info');
        } else {
            showToast('Verification code sent to your email!', 'success');
        }
        renderRegistrationStep2(data.dev_otp);
    } catch (error) { showToast(error.message, 'error'); button.disabled = false; button.innerHTML = 'Send verification code <i class="bi bi-arrow-right ms-1"></i>'; }
}
function renderRegistrationStep2(devOtp = null) {
    const fallbackNotice = devOtp ? `
        <div class="alert alert-warning py-2 px-3 small mb-3 border-0 bg-warning-subtle text-warning-emphasis rounded">
            <i class="bi bi-exclamation-triangle-fill me-1"></i>
            <span>Email delivery offline/fallback. Code: <strong>${escapeHtml(devOtp)}</strong></span>
        </div>` : '';
    document.getElementById('register-modal-body').innerHTML = `<div class="mb-4"><span class="eyebrow">Step 2 of 2</span><h4 class="mt-2 mb-1">Verify your email</h4><p class="text-muted small mb-0">Enter the six-digit code sent to <strong>${escapeHtml(registrationData.business_email)}</strong>.</p></div>${fallbackNotice}<form id="reg-step-2"><input id="reg-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" class="form-control form-control-lg text-center mb-3" style="letter-spacing:.45em" value="${devOtp || ''}" required><button class="btn btn-primary w-100" type="submit">Verify and create workspace</button><button class="btn btn-ghost w-100 mt-2" type="button" onclick="renderRegistrationStep1()">Back</button></form>`; document.getElementById('reg-step-2').addEventListener('submit', registerCompany);
}
async function registerCompany(event) { event.preventDefault(); const otp = document.getElementById('reg-otp'); if (otp) registrationData.otp = otp.value; const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Submitting request…'; try { const response = await fetch(API + '/companies/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(registrationData) }); const data = await readApiResponse(response); if (!response.ok) throw new Error(data.detail || 'Registration failed'); if (data.status === 'pending_approval') { document.getElementById('register-modal-body').innerHTML = '<div class="text-center py-2"><i class="bi bi-hourglass-split text-primary fs-1"></i><h4 class="mt-3">Request submitted</h4><p class="text-muted small">A platform administrator must approve this workspace before the company administrator can sign in.</p><button data-bs-dismiss="modal" class="btn btn-primary w-100 mt-3">Done</button></div>'; return; } document.getElementById('register-modal-body').innerHTML = `<div class="text-center py-2"><i class="bi bi-check-circle-fill text-success fs-1"></i><h4 class="mt-3">Workspace created</h4><p class="text-muted small">Save this company code. Employees need it to join your workspace.</p><div class="bg-light border rounded p-3 font-mono fs-4">${escapeHtml(data.company_code)}</div><img class="img-fluid mt-3" style="max-width:180px" src="${data.qr_code_base64}" alt="Company QR code"><button data-bs-dismiss="modal" class="btn btn-primary w-100 mt-3" onclick="afterRegistration()">Done</button></div>`; } catch (error) { showToast(error.message, 'error'); button.disabled = false; button.textContent = 'Submit approval request'; } }
async function createCompanyAsSuperAdmin(event) { event.preventDefault(); const data = { company_name: document.getElementById('reg-cname').value.trim(), company_type: document.getElementById('reg-ctype').value, owner_name: document.getElementById('reg-oname').value.trim(), business_email: document.getElementById('reg-email').value.trim(), mobile_number: document.getElementById('reg-mobile').value.trim(), password: document.getElementById('reg-pass').value }; const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating workspace…'; try { const response = await fetch(API + '/companies/admin/create', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${getSession().token}`}, body:JSON.stringify(data) }); const result = await readApiResponse(response); if (!response.ok) throw new Error(result.detail || 'Could not create workspace'); document.getElementById('register-modal-body').innerHTML = `<div class="text-center py-2"><i class="bi bi-check-circle-fill text-success fs-1"></i><h4 class="mt-3">Workspace created</h4><p class="text-muted small">The company administrator can now sign in. Company code:</p><div class="bg-light border rounded p-3 font-mono fs-4">${escapeHtml(result.company_code)}</div><button data-bs-dismiss="modal" class="btn btn-primary w-100 mt-3" onclick="afterRegistration()">Done</button></div>`; } catch (error) { showToast(error.message, 'error'); button.disabled = false; button.textContent = 'Create workspace'; } }
function afterRegistration() { if (getSession()?.role === 'super_admin') fetchAdminData(); else showToast('Your workspace is ready. Sign in as Company administrator.', 'success'); }
async function fetchCompanies() { return fetchAdminData(); }
function renderCompanyRows(textFilter = '', typeFilter = '') {
    const tbody = document.getElementById('companies-table-body');
    if (!tbody) return;
    const query = textFilter.trim().toLowerCase();
    const selectedType = typeFilter.trim().toLowerCase();
    const companies = adminData.companies.filter(company => {
        const matchesText = [company.company_name, company.owner_name, company.business_email, company.company_code, company.company_type].join(' ').toLowerCase().includes(query);
        const matchesType = !selectedType || (company.company_type && company.company_type.toLowerCase() === selectedType);
        return matchesText && matchesType;
    });
    tbody.innerHTML = companies.length ? companies.map(company => `
        <tr>
            <td>
                <div class="company-cell d-flex align-items-center gap-2">
                    <span class="company-avatar badge bg-primary rounded-circle p-2 fs-6" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;">${escapeHtml(company.company_name.slice(0, 1).toUpperCase())}</span>
                    <div>
                        <strong>${escapeHtml(company.company_name)}</strong>
                        <br><small class="text-muted">${escapeHtml(company.business_email)}</small>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(company.owner_name)}</td>
            <td><code class="user-select-all">${escapeHtml(company.company_code)}</code></td>
            <td><span class="badge bg-secondary-subtle text-secondary-emphasis">${escapeHtml(company.company_type)}</span></td>
            <td>
                <span class="status-pill ${company.is_active ? 'status-active text-success' : 'status-suspended text-danger'} fw-semibold">
                    <i class="bi bi-circle-fill me-1 small"></i>${company.is_active ? 'Active' : 'Pending approval'}
                </span>
            </td>
            <td class="text-end">
                <button class="btn btn-sm ${company.is_active ? 'btn-outline-danger' : 'btn-outline-success'}" onclick="setCompanyStatus(${company.id}, ${!company.is_active})">
                    ${company.is_active ? 'Suspend' : 'Approve'}
                </button>
            </td>
        </tr>`).join('') : '<tr><td colspan="6" class="text-center p-5 text-muted">No companies match your search or filter.</td></tr>';
}
async function setCompanyStatus(id, isActive) { if (!window.confirm(`Are you sure you want to ${isActive ? 'approve' : 'suspend'} this company?`)) return; try { const response = await fetch(`${API}/companies/${id}/status?is_active=${isActive}`, { method:'PATCH', headers:{Authorization:`Bearer ${getSession().token}`} }); const data = await readApiResponse(response); if (!response.ok) throw new Error(data.detail || 'Could not update company'); showToast(`Company ${isActive ? 'approved' : 'suspended'}.`, 'success'); fetchAdminData(); } catch (error) { showToast(error.message, 'error'); } }

// ──────────────────────────── Centralized AI Voice & Intelligence Assistant ────────────────────────────
let isListening = false;
let speechRecognizer = null;
let voiceCountdownTimer = null;
let accumulatedTranscript = '';

function toggleVoiceAssistant() {
    const popupEl = document.getElementById('aiAssistantPopup');
    if (!popupEl) return;
    popupEl.classList.toggle('d-none');
    
    // Bind listeners if not already bound
    const form = document.getElementById('ai-chat-form');
    if (form && !form.dataset.bound) {
        form.dataset.bound = 'true';
        form.addEventListener('submit', event => {
            event.preventDefault();
            const input = document.getElementById('ai-chat-input');
            const val = input?.value.trim();
            if (val) {
                input.value = '';
                sendAiPrompt(val);
            }
        });
    }

    const micBtn = document.getElementById('ai-mic-btn');
    if (micBtn && !micBtn.dataset.bound) {
        micBtn.dataset.bound = 'true';
        micBtn.addEventListener('click', toggleMicRecording);
    }
}

function toggleMicRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Speech recognition is not supported in this browser. Please type your command.', 'warning');
        return;
    }
    
    const statusEl = document.getElementById('ai-voice-status');
    const micBtn = document.getElementById('ai-mic-btn');
    const timerCountEl = document.getElementById('voice-timer-count');

    if (isListening) {
        stopMicRecording();
        return;
    }

    try {
        accumulatedTranscript = '';
        speechRecognizer = new SpeechRecognition();
        speechRecognizer.continuous = true;
        speechRecognizer.interimResults = true;
        speechRecognizer.lang = 'en-IN';

        let secondsRemaining = 4;

        speechRecognizer.onstart = () => {
            isListening = true;
            if (statusEl) statusEl.classList.remove('d-none');
            if (micBtn) micBtn.classList.add('recording');
            if (timerCountEl) timerCountEl.textContent = '4';
        };

        speechRecognizer.onresult = event => {
            let currentText = '';
            for (let i = 0; i < event.results.length; i++) {
                currentText += event.results[i][0].transcript + ' ';
            }
            accumulatedTranscript = currentText.trim();
            const inputEl = document.getElementById('ai-chat-input');
            if (inputEl) inputEl.value = accumulatedTranscript;

            // Start or reset 4-second auto-send countdown AFTER speech is detected
            secondsRemaining = 4;
            if (timerCountEl) timerCountEl.textContent = '4';

            clearInterval(voiceCountdownTimer);
            voiceCountdownTimer = setInterval(() => {
                secondsRemaining--;
                if (timerCountEl) timerCountEl.textContent = Math.max(0, secondsRemaining);
                if (secondsRemaining <= 0) {
                    clearInterval(voiceCountdownTimer);
                    stopMicRecordingAndSend();
                }
            }, 1000);
        };

        speechRecognizer.onerror = event => {
            console.warn('Speech recognition warning:', event.error);
        };

        speechRecognizer.onend = () => {
            if (isListening && !accumulatedTranscript) {
                try { speechRecognizer.start(); } catch (e) {}
            }
        };

        speechRecognizer.start();
    } catch (err) {
        showToast('Could not access microphone.', 'error');
    }
}

function stopMicRecording() {
    isListening = false;
    clearInterval(voiceCountdownTimer);
    if (speechRecognizer) {
        try { speechRecognizer.stop(); } catch (e) {}
    }
    const statusEl = document.getElementById('ai-voice-status');
    const micBtn = document.getElementById('ai-mic-btn');
    if (statusEl) statusEl.classList.add('d-none');
    if (micBtn) micBtn.classList.remove('recording');
}

function stopMicRecordingAndSend() {
    stopMicRecording();
    const inputEl = document.getElementById('ai-chat-input');
    const finalPrompt = accumulatedTranscript || inputEl?.value.trim();
    if (finalPrompt) {
        if (inputEl) inputEl.value = '';
        sendAiPrompt(finalPrompt);
    }
}

async function sendAiPrompt(promptText) {
    const messagesBox = document.getElementById('ai-chat-messages');
    if (!messagesBox) return;

    // Append User Message
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble-user';
    userBubble.textContent = promptText;
    messagesBox.appendChild(userBubble);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    // Append AI Loading Indicator
    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble-ai';
    aiBubble.innerHTML = '<span class="spinner-border spinner-border-sm me-2 text-primary"></span><span>Thinking…</span>';
    messagesBox.appendChild(aiBubble);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    try {
        const response = await api('/erp/ai-voice', {
            method: 'POST',
            body: { transcript: promptText }
        });

        const speechText = response.speech || 'Action completed.';
        aiBubble.innerHTML = `<i class="bi bi-robot me-1 text-primary"></i> ${escapeHtml(speechText)}`;
        messagesBox.scrollTop = messagesBox.scrollHeight;

        // Speak aloud in Female Voice if TTS toggle is checked
        const ttsToggle = document.getElementById('ai-tts-toggle');
        if (ttsToggle && ttsToggle.checked) {
            speakResponse(speechText);
        }

        // Execute returned action
        if (response.action === 'navigate' && response.target) {
            loadModule(response.target);
            // Highlight active sidebar item
            document.querySelectorAll('[data-module]').forEach(item => {
                if (item.dataset.module === response.target) item.classList.add('active');
                else item.classList.remove('active');
            });
        } else if (response.action === 'refresh' && response.target) {
            loadModule(response.target);
        }
    } catch (err) {
        aiBubble.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1 text-danger"></i> ${escapeHtml(err.message || 'Could not process AI command.')}`;
    }
}

function speakResponse(text) {
    if (!('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel(); // Cancel any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Select Female Voice
        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v => 
            v.name.toLowerCase().includes('female') ||
            v.name.includes('Google UK English Female') ||
            v.name.includes('Samantha') ||
            v.name.includes('Zira') ||
            v.name.includes('Microsoft Zira') ||
            v.name.includes('Victoria') ||
            v.name.includes('Karen') ||
            v.name.includes('Google हिन्दी') ||
            v.name.includes('Google US English')
        ) || voices.find(v => v.lang.startsWith('en'));

        if (femaleVoice) {
            utterance.voice = femaleVoice;
        }

        utterance.pitch = 1.25; // Cute higher female pitch
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    } catch (err) {
        console.warn('TTS Speech Synthesis error:', err);
    }
}

// Initialize application after all function declarations are hoisted & defined
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

