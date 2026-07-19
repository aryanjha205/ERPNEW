const API = '/api';
let recognition;

document.addEventListener('DOMContentLoaded', () => {
    const session = getSession();
    session ? renderWorkspace(session) : renderLogin();
    document.getElementById('voice-btn')?.addEventListener('click', toggleVoiceAssistant);
    syncVoiceButton(Boolean(session));
    document.getElementById('registerCompanyModal')?.addEventListener('click', event => {
        if (!window.bootstrap && (event.target.matches('[data-bs-dismiss="modal"]') || event.target.closest('[data-bs-dismiss="modal"]'))) closeRegisterModal();
    });
});

function syncVoiceButton(isAuthenticated = Boolean(getSession())) {
    const button = document.getElementById('voice-btn');
    if (button) button.hidden = !isAuthenticated;
}

function getSession() {
    const store = localStorage.getItem('erp_token') ? localStorage : sessionStorage;
    const token = store.getItem('erp_token');
    const role = store.getItem('erp_role');
    return token && role ? { token, role, companyName: store.getItem('erp_company_name') || 'Workspace' } : null;
}

function saveSession(data, remember = true) {
    const store = remember ? localStorage : sessionStorage;
    localStorage.removeItem('erp_token'); localStorage.removeItem('erp_role'); localStorage.removeItem('erp_company_name');
    sessionStorage.removeItem('erp_token'); sessionStorage.removeItem('erp_role'); sessionStorage.removeItem('erp_company_name');
    store.setItem('erp_token', data.access_token);
    store.setItem('erp_role', data.role);
    store.setItem('erp_company_name', data.company_name || 'Nexus ERP');
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

async function readApiResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return response.json();
    const text = await response.text();
    if (!response.ok) throw new Error('The server could not complete this request. Please try again in a moment.');
    throw new Error(text || 'The server returned an unexpected response.');
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
          <div class="auth-divider"><span>New to Nexus?</span></div><button type="button" class="btn btn-outline-secondary w-100" onclick="openRegisterModal()"><i class="bi bi-building-add me-2"></i>Create a company workspace</button>
          <p class="auth-help">Employees should get a company code from their administrator.</p>
        </section></div></div>`;
    const type = document.getElementById('login-type');
    type.addEventListener('change', updateLoginFields);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('toggle-password').addEventListener('click', () => {
        const input = document.getElementById('login-password');
        input.type = input.type === 'password' ? 'text' : 'password';
        document.getElementById('toggle-password').textContent = input.type === 'password' ? 'Show' : 'Hide';
    });
    updateLoginFields();
}

function updateLoginFields() {
    const type = document.getElementById('login-type').value;
    const email = document.getElementById('email-field');
    const code = document.getElementById('company-code-field');
    document.getElementById('password-label').textContent = type === 'super_admin' ? 'Secure PIN' : 'Password';
    email.hidden = type === 'super_admin'; code.hidden = type !== 'employee';
    document.getElementById('login-email').required = type !== 'super_admin';
    // A company code is optional for email/password sign-in, but required by
    // the alternate company-code employee sign-in endpoint when provided.
    document.getElementById('company-code').required = false;
}

async function handleLogin(event) {
    event.preventDefault();
    const type = document.getElementById('login-type').value;
    const password = document.getElementById('login-password').value;
    const email = document.getElementById('login-email').value.trim();
    const companyCode = document.getElementById('company-code').value.trim().toUpperCase();
    const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm"></span><span>Signing in…</span>';
    try {
        let endpoint, body;
        if (type === 'super_admin') { endpoint = '/auth/super-admin/login'; body = { pin: password }; }
        else if (type === 'company_admin') { endpoint = '/auth/company-admin/login'; body = { email, password }; }
        else if (companyCode) { endpoint = '/auth/employee/login-code'; body = { company_code: companyCode, employee_email: email, password }; }
        else { endpoint = '/auth/employee/login'; body = { email, password }; }
        const response = await fetch(API + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Sign in failed');
        saveSession(data, document.getElementById('remember-session').checked);
        renderWorkspace(getSession());
    } catch (error) { showToast(error.message, 'error'); }
    finally { button.disabled = false; button.innerHTML = '<span>Sign in securely</span><i class="bi bi-arrow-right"></i>'; }
}

function renderWorkspace(session) {
    syncVoiceButton(true);
    if (session.role === 'super_admin') return renderSuperAdminDashboard();
    const root = document.getElementById('app-root');
    root.innerHTML = `<div class="app-layout"><aside class="sidebar"><div class="sidebar-brand"><span class="sidebar-brand-icon"><i class="bi bi-boxes"></i></span><div><h5>${escapeHtml(session.companyName)}</h5><small>${escapeHtml(session.role.replace('_', ' '))}</small></div></div><div class="sidebar-section"><p class="sidebar-section-title">Workspace</p><nav class="sidebar-nav">${['Dashboard','Customers','Suppliers','Inventory','Sales','Purchases','Invoices','Projects','Tasks','Notifications'].map(name => `<button class="sidebar-link ${name === 'Dashboard' ? 'active' : ''}" data-module="${name.toLowerCase()}"><i class="bi bi-${moduleIcon(name)}"></i>${name}</button>`).join('')}</nav></div><div class="sidebar-footer"><button class="sidebar-link text-danger" onclick="logout()"><i class="bi bi-box-arrow-right"></i>Sign out</button></div></aside><main class="main-content"><button class="btn btn-ghost mobile-menu-btn" onclick="document.querySelector('.sidebar').classList.toggle('open')"><i class="bi bi-list"></i></button><div id="workspace-content"></div></main></div>`;
    root.querySelectorAll('[data-module]').forEach(button => button.addEventListener('click', () => { root.querySelectorAll('[data-module]').forEach(item => item.classList.remove('active')); button.classList.add('active'); loadModule(button.dataset.module); }));
    loadModule('dashboard');
}

function moduleIcon(name) { return ({ Dashboard: 'grid-1x2', Customers: 'people', Suppliers: 'truck', Inventory: 'boxes', Sales: 'graph-up-arrow', Purchases: 'cart', Invoices: 'receipt', Projects: 'kanban', Tasks: 'check2-square', Notifications: 'bell' })[name]; }

async function api(path) {
    const response = await fetch(API + path, { headers: { Authorization: `Bearer ${getSession().token}` } });
    if (response.status === 401) { logout(); throw new Error('Your session has expired.'); }
    const data = await readApiResponse(response); if (!response.ok) throw new Error(data.detail || 'Request failed'); return data;
}

async function loadModule(module) {
    const target = document.getElementById('workspace-content'); target.innerHTML = '<div class="skeleton skeleton-card"></div>';
    try {
        if (module === 'dashboard') return renderDashboard(await api('/erp/dashboard'));
        const records = await api(`/erp/${module}`);
        renderRecords(module, records);
    } catch (error) { target.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`; }
}

function renderDashboard(data) {
    document.getElementById('workspace-content').innerHTML = `<div class="page-header"><div><h2>Dashboard</h2><p class="text-muted mb-0">A real-time view of your business.</p></div></div><div class="row g-3">${[['Revenue', data.revenue, 'currency-dollar'],['Expenses',data.expenses,'wallet2'],['Profit',data.profit,'graph-up'],['Employees',data.total_employees,'people'],['Customers',data.total_customers,'person-heart'],['Inventory',data.total_inventory,'boxes'],['Pending invoices',data.pending_invoices,'receipt'],['Open tasks',data.pending_tasks,'check2-square']].map(([label,value,icon]) => `<div class="col-sm-6 col-xl-3"><div class="card stat-card h-100"><div class="card-body d-flex justify-content-between"><div><h6>${label}</h6><div class="stat-value">${typeof value === 'number' && ['Revenue','Expenses','Profit'].includes(label) ? value.toLocaleString(undefined,{style:'currency',currency:'USD'}) : value}</div></div><div class="stat-icon bg-primary-subtle text-primary"><i class="bi bi-${icon}"></i></div></div></div></div>`).join('')}</div><div class="card mt-4"><div class="card-body"><h5 class="mb-1">AI assistant is ready</h5><p class="text-muted mb-0">Use the microphone to say “show inventory”, “open customers”, or “show today’s sales”.</p></div></div>`;
}

function renderRecords(module, records) {
    const title = module[0].toUpperCase() + module.slice(1);
    const rows = records.map(record => `<tr>${Object.entries(record).filter(([key]) => !['company_id'].includes(key)).slice(0, 6).map(([, value]) => `<td>${escapeHtml(value ?? '—')}</td>`).join('')}</tr>`).join('');
    const headings = records[0] ? Object.keys(records[0]).filter(key => key !== 'company_id').slice(0, 6) : [];
    document.getElementById('workspace-content').innerHTML = `<div class="page-header"><div><h2>${title}</h2><p class="text-muted mb-0">Tenant-isolated ${module} data.</p></div></div><div class="card"><div class="table-responsive"><table class="table table-hover mb-0"><thead><tr>${headings.map(key => `<th>${escapeHtml(key.replaceAll('_', ' '))}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${Math.max(headings.length, 1)}" class="text-center text-muted p-5">No ${escapeHtml(module)} yet.</td></tr>`}</tbody></table></div></div>`;
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

function handleVoiceCommand(transcript) {
    const command = transcript.toLowerCase();
    const matches = { inventory: 'inventory', customer: 'customers', supplier: 'suppliers', sales: 'sales', purchase: 'purchases', invoice: 'invoices', project: 'projects', task: 'tasks', notification: 'notifications', dashboard: 'dashboard' };
    const module = Object.entries(matches).find(([word]) => command.includes(word))?.[1];
    if (module) { loadModule(module); speak(`Opening ${module}`); showToast(`Voice command: ${transcript}`, 'success'); }
    else { speak('I can open the dashboard, customers, inventory, sales, purchases, invoices, projects, tasks, and notifications.'); showToast(`I didn't understand “${transcript}”.`, 'info'); }
}

function speak(text) { if ('speechSynthesis' in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } }
function showToast(message, type = 'info') { let container = document.querySelector('.toast-container'); if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.append(container); } const toast = document.createElement('div'); toast.className = `toast-msg ${type}`; toast.textContent = message; container.append(toast); setTimeout(() => toast.remove(), 4500); }

function logout() {
    if (recognition) recognition.stop();
    [localStorage, sessionStorage].forEach(store => { store.removeItem('erp_token'); store.removeItem('erp_role'); store.removeItem('erp_company_name'); });
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
    if (view === 'companies') document.getElementById('company-search')?.addEventListener('input', event => renderCompanyRows(event.target.value));
}

function adminOverviewView() {
    const stats = adminData.overview;
    return `<div class="page-header admin-header"><div><span class="eyebrow">Platform command center</span><h2>Good to see you</h2><p class="text-muted mb-0">A live snapshot of your Nexus platform.</p></div><button class="btn btn-primary" onclick="openRegisterModal()"><i class="bi bi-plus-lg me-1"></i>New company</button></div><div class="row g-3 mb-4">${[[stats.total_companies,'Companies','buildings','primary'],[stats.active_companies,'Active workspaces','check-circle','success'],[stats.total_employees,'Total users','people','info'],[stats.suspended_companies,'Suspended','pause-circle','warning']].map(([value,label,icon,tone]) => `<div class="col-sm-6 col-xl-3"><div class="card stat-card admin-stat h-100"><div class="card-body"><div class="stat-icon tone-${tone}"><i class="bi bi-${icon}"></i></div><div><h6>${label}</h6><div class="stat-value">${value}</div><span class="stat-caption">${label === 'Total users' ? `${stats.active_employees} active` : 'Updated just now'}</span></div></div></div></div>`).join('')}</div><div class="row g-3"><div class="col-xl-8"><section class="card h-100"><div class="card-body"><div class="section-heading"><div><h5>Workspace health</h5><p>Tenant activity across the platform</p></div><button class="btn btn-sm btn-outline-secondary" onclick="document.querySelector('[data-admin-view=companies]').click()">View companies</button></div><div class="health-bars"><div><span>Active workspaces</span><strong>${stats.active_companies} / ${stats.total_companies}</strong><div class="progress"><div class="progress-bar bg-success" style="width:${stats.total_companies ? (stats.active_companies / stats.total_companies) * 100 : 0}%"></div></div></div><div><span>Active employee accounts</span><strong>${stats.active_employees} / ${stats.total_employees}</strong><div class="progress"><div class="progress-bar" style="width:${stats.total_employees ? (stats.active_employees / stats.total_employees) * 100 : 0}%"></div></div></div></div></div></section></div><div class="col-xl-4"><section class="card h-100"><div class="card-body"><div class="section-heading"><div><h5>Quick actions</h5><p>Common platform tasks</p></div></div><div class="quick-actions"><button onclick="openRegisterModal()"><i class="bi bi-building-add"></i>Create workspace</button><button onclick="document.querySelector('[data-admin-view=companies]').click()"><i class="bi bi-sliders"></i>Manage tenants</button><button onclick="fetchAdminData()"><i class="bi bi-arrow-clockwise"></i>Refresh insights</button></div></div></section></div></div>`;
}

function adminCompaniesView() {
    return `<div class="page-header admin-header"><div><span class="eyebrow">Tenant directory</span><h2>Companies</h2><p class="text-muted mb-0">Search, activate, or suspend individual workspaces.</p></div><button class="btn btn-primary" onclick="openRegisterModal()"><i class="bi bi-plus-lg me-1"></i>New company</button></div><section class="card"><div class="directory-toolbar"><div class="search-field"><i class="bi bi-search"></i><input id="company-search" placeholder="Search by company, owner, email, or code"></div><span class="text-muted small">${adminData.companies.length} total companies</span></div><div class="table-responsive"><table class="table table-hover admin-table mb-0"><thead><tr><th>Workspace</th><th>Owner</th><th>Company code</th><th>Type</th><th>Status</th><th class="text-end">Actions</th></tr></thead><tbody id="companies-table-body"></tbody></table></div></section>`;
    renderCompanyRows();
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
    try { const response = await fetch(API + '/companies/request-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:registrationData.business_email}) }); const data = await readApiResponse(response); if (!response.ok) throw new Error(data.detail || 'Could not send OTP'); renderRegistrationStep2(); } catch (error) { showToast(error.message, 'error'); button.disabled = false; button.innerHTML = 'Send verification code <i class="bi bi-arrow-right ms-1"></i>'; }
}
function renderRegistrationStep2() { document.getElementById('register-modal-body').innerHTML = `<div class="mb-4"><span class="eyebrow">Step 2 of 2</span><h4 class="mt-2 mb-1">Verify your email</h4><p class="text-muted small mb-0">Enter the six-digit code we sent to <strong>${escapeHtml(registrationData.business_email)}</strong>. It expires in five minutes.</p></div><form id="reg-step-2"><input id="reg-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" class="form-control form-control-lg text-center mb-3" style="letter-spacing:.45em" required><button class="btn btn-primary w-100" type="submit">Verify and create workspace</button><button class="btn btn-ghost w-100 mt-2" type="button" onclick="renderRegistrationStep1()">Back</button></form>`; document.getElementById('reg-step-2').addEventListener('submit', registerCompany); }
async function registerCompany(event) { event.preventDefault(); const otp = document.getElementById('reg-otp'); if (otp) registrationData.otp = otp.value; const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Submitting request…'; try { const response = await fetch(API + '/companies/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(registrationData) }); const data = await readApiResponse(response); if (!response.ok) throw new Error(data.detail || 'Registration failed'); if (data.status === 'pending_approval') { document.getElementById('register-modal-body').innerHTML = '<div class="text-center py-2"><i class="bi bi-hourglass-split text-primary fs-1"></i><h4 class="mt-3">Request submitted</h4><p class="text-muted small">A platform administrator must approve this workspace before the company administrator can sign in.</p><button data-bs-dismiss="modal" class="btn btn-primary w-100 mt-3">Done</button></div>'; return; } document.getElementById('register-modal-body').innerHTML = `<div class="text-center py-2"><i class="bi bi-check-circle-fill text-success fs-1"></i><h4 class="mt-3">Workspace created</h4><p class="text-muted small">Save this company code. Employees need it to join your workspace.</p><div class="bg-light border rounded p-3 font-mono fs-4">${escapeHtml(data.company_code)}</div><img class="img-fluid mt-3" style="max-width:180px" src="${data.qr_code_base64}" alt="Company QR code"><button data-bs-dismiss="modal" class="btn btn-primary w-100 mt-3" onclick="afterRegistration()">Done</button></div>`; } catch (error) { showToast(error.message, 'error'); button.disabled = false; button.textContent = 'Submit approval request'; } }
async function createCompanyAsSuperAdmin(event) { event.preventDefault(); const data = { company_name: document.getElementById('reg-cname').value.trim(), company_type: document.getElementById('reg-ctype').value, owner_name: document.getElementById('reg-oname').value.trim(), business_email: document.getElementById('reg-email').value.trim(), mobile_number: document.getElementById('reg-mobile').value.trim(), password: document.getElementById('reg-pass').value }; const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating workspace…'; try { const response = await fetch(API + '/companies/admin/create', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${getSession().token}`}, body:JSON.stringify(data) }); const result = await readApiResponse(response); if (!response.ok) throw new Error(result.detail || 'Could not create workspace'); document.getElementById('register-modal-body').innerHTML = `<div class="text-center py-2"><i class="bi bi-check-circle-fill text-success fs-1"></i><h4 class="mt-3">Workspace created</h4><p class="text-muted small">The company administrator can now sign in. Company code:</p><div class="bg-light border rounded p-3 font-mono fs-4">${escapeHtml(result.company_code)}</div><button data-bs-dismiss="modal" class="btn btn-primary w-100 mt-3" onclick="afterRegistration()">Done</button></div>`; } catch (error) { showToast(error.message, 'error'); button.disabled = false; button.textContent = 'Create workspace'; } }
function afterRegistration() { if (getSession()?.role === 'super_admin') fetchAdminData(); else showToast('Your workspace is ready. Sign in as Company administrator.', 'success'); }
async function fetchCompanies() { return fetchAdminData(); }
function renderCompanyRows(filter = '') {
    const tbody = document.getElementById('companies-table-body');
    if (!tbody) return;
    const query = filter.trim().toLowerCase();
    const companies = adminData.companies.filter(company => [company.company_name, company.owner_name, company.business_email, company.company_code, company.company_type].join(' ').toLowerCase().includes(query));
    tbody.innerHTML = companies.length ? companies.map(company => `<tr><td><div class="company-cell"><span class="company-avatar">${escapeHtml(company.company_name.slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(company.company_name)}</strong><small>${escapeHtml(company.business_email)}</small></div></div></td><td>${escapeHtml(company.owner_name)}</td><td><code>${escapeHtml(company.company_code)}</code></td><td>${escapeHtml(company.company_type)}</td><td><span class="status-pill ${company.is_active ? 'status-active' : 'status-suspended'}"><i class="bi bi-circle-fill"></i>${company.is_active ? 'Active' : 'Pending approval'}</span></td><td class="text-end"><button class="btn btn-sm ${company.is_active ? 'btn-outline-danger' : 'btn-outline-success'}" onclick="setCompanyStatus(${company.id}, ${!company.is_active})">${company.is_active ? 'Suspend' : 'Approve'}</button></td></tr>`).join('') : '<tr><td colspan="6" class="text-center p-5 text-muted">No companies match this search.</td></tr>';
}
async function setCompanyStatus(id, isActive) { if (!window.confirm(`Are you sure you want to ${isActive ? 'approve' : 'suspend'} this company?`)) return; try { const response = await fetch(`${API}/companies/${id}/status?is_active=${isActive}`, { method:'PATCH', headers:{Authorization:`Bearer ${getSession().token}`} }); const data = await readApiResponse(response); if (!response.ok) throw new Error(data.detail || 'Could not update company'); showToast(`Company ${isActive ? 'approved' : 'suspended'}.`, 'success'); fetchAdminData(); } catch (error) { showToast(error.message, 'error'); } }
