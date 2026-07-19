document.addEventListener('DOMContentLoaded', () => {
    console.log('AI Voice ERP Loaded');
    renderLogin();

    // Voice button interaction
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
            voiceBtn.classList.toggle('btn-danger');
            voiceBtn.classList.toggle('btn-primary');
            // TODO: Implement actual Web Speech API integration here
            console.log("Voice assistant toggled");
        });
    }
});

function renderLogin() {
    const root = document.getElementById('app-root');
    root.innerHTML = `
        <div class="auth-wrapper">
            <div class="auth-container">
                <div class="auth-header">
                    <h2>Welcome to Nexus</h2>
                    <p>Enter your credentials to access your ERP workspace.</p>
                </div>
                <form id="login-form">
                    <div class="mb-3">
                        <label class="form-label">Email or Company Code</label>
                        <input type="text" class="form-control" id="login-id" placeholder="name@company.com" required>
                    </div>
                    <div class="mb-4">
                        <label class="form-label d-flex justify-content-between">
                            Password or PIN
                            <a href="#" class="text-decoration-none text-primary" style="font-size: 0.85rem;">Forgot?</a>
                        </label>
                        <input type="password" class="form-control" id="login-password" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100 d-flex justify-content-center align-items-center gap-2">
                        <span>Sign In</span>
                        <i class="bi bi-arrow-right"></i>
                    </button>
                </form>
                <div class="text-center mt-4 text-muted" style="font-size: 0.85rem;">
                    Don't have an account? <a href="#" class="text-primary text-decoration-none fw-medium">Contact your Admin</a>
                </div>
            </div>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('login-id').value;
    const password = document.getElementById('login-password').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalContent = submitBtn.innerHTML;
    
    // UI Loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Authenticating...';

    try {
        if (id.toLowerCase() === 'admin' && password === '2015') {
             const res = await fetch('/api/auth/super-admin/login', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ pin: password })
             });
             const data = await res.json();
             
             if (res.ok) {
                 localStorage.setItem('erp_token', data.access_token);
                 localStorage.setItem('erp_role', data.role);
                 renderSuperAdminDashboard();
             } else {
                 throw new Error(data.detail || 'Login Failed');
             }
        } else {
            // Standard Employee/Company login
            throw new Error('Employee login API not yet linked');
        }
    } catch (error) {
        alert(error.message);
    } finally {
        // Reset UI state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
    }
}

function renderSuperAdminDashboard() {
    const root = document.getElementById('app-root');
    root.style.opacity = '0';
    
    setTimeout(() => {
        root.innerHTML = `
            <div class="d-flex w-100 h-100" style="background: var(--bg-color);">
                <!-- Premium Sidebar -->
                <nav class="sidebar d-flex flex-column p-3">
                    <div class="sidebar-header mb-4 px-2">
                        <h4 class="fw-bold text-primary mb-0"><i class="bi bi-box-fill me-2"></i>Nexus ERP</h4>
                        <span class="badge bg-danger mt-1">Super Admin</span>
                    </div>
                    <ul class="nav nav-pills flex-column mb-auto gap-2">
                        <li class="nav-item">
                            <a href="#" class="nav-link active" aria-current="page">
                                <i class="bi bi-grid-1x2-fill me-2"></i> Overview
                            </a>
                        </li>
                        <li>
                            <a href="#" class="nav-link text-dark sidebar-link">
                                <i class="bi bi-buildings-fill me-2"></i> Companies
                            </a>
                        </li>
                        <li>
                            <a href="#" class="nav-link text-dark sidebar-link">
                                <i class="bi bi-people-fill me-2"></i> Users
                            </a>
                        </li>
                        <li>
                            <a href="#" class="nav-link text-dark sidebar-link">
                                <i class="bi bi-bar-chart-fill me-2"></i> Analytics
                            </a>
                        </li>
                    </ul>
                    <hr>
                    <a href="#" class="nav-link text-danger" onclick="logout()">
                        <i class="bi bi-box-arrow-right me-2"></i> Sign Out
                    </a>
                </nav>
                
                <!-- Main Content -->
                <main class="main-content flex-grow-1 p-4" style="margin-left: 260px;">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2 class="fw-bold m-0 text-dark">Platform Overview</h2>
                        <button class="btn btn-primary shadow-sm" onclick="openRegisterModal()">
                            <i class="bi bi-plus-lg me-1"></i> Create Company
                        </button>
                    </div>
                    
                    <div class="row g-4 mb-4">
                        <div class="col-md-3">
                            <div class="card stat-card shadow-sm border-0 h-100">
                                <div class="card-body">
                                    <h6 class="text-muted fw-semibold mb-2">Total Companies</h6>
                                    <h2 class="fw-bold mb-0 text-dark">0</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card stat-card shadow-sm border-0 h-100">
                                <div class="card-body">
                                    <h6 class="text-muted fw-semibold mb-2">Active Users</h6>
                                    <h2 class="fw-bold mb-0 text-dark">0</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card stat-card shadow-sm border-0 h-100">
                                <div class="card-body">
                                    <h6 class="text-muted fw-semibold mb-2">Total Revenue</h6>
                                    <h2 class="fw-bold mb-0 text-success">$0.00</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card stat-card shadow-sm border-0 h-100">
                                <div class="card-body">
                                    <h6 class="text-muted fw-semibold mb-2">System Health</h6>
                                    <h2 class="fw-bold mb-0 text-primary">100%</h2>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card shadow-sm border-0">
                        <div class="card-body p-0">
                            <div class="p-3 border-bottom d-flex justify-content-between align-items-center">
                                <h5 class="m-0 fw-semibold text-dark">Registered Companies</h5>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-hover align-middle m-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th>Company Name</th>
                                            <th>Code</th>
                                            <th>Type</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="companies-table-body">
                                        <tr><td colspan="5" class="text-center p-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div> Loading companies...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        `;
        
        root.style.transition = 'opacity 0.4s ease';
        root.style.opacity = '1';
        fetchCompanies();
    }, 300);
}

function logout() {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_role');
    renderLogin();
}

let registrationData = {};

function openRegisterModal() {
    const modal = new bootstrap.Modal(document.getElementById('registerCompanyModal'));
    renderRegistrationStep1();
    modal.show();
}

function renderRegistrationStep1() {
    document.getElementById('register-modal-body').innerHTML = `
        <form id="reg-step-1">
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">Company Name</label>
                    <input type="text" class="form-control" id="reg-cname" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Company Type</label>
                    <select class="form-select form-control" id="reg-ctype" required>
                        <option value="IT Company">IT Company</option>
                        <option value="Retail">Retail</option>
                        <option value="Manufacturing">Manufacturing</option>
                    </select>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Owner Name</label>
                    <input type="text" class="form-control" id="reg-oname" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Business Email</label>
                    <input type="email" class="form-control" id="reg-email" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Mobile Number</label>
                    <input type="text" class="form-control" id="reg-mobile" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Admin Password</label>
                    <input type="password" class="form-control" id="reg-pass" required>
                </div>
            </div>
            <button type="submit" class="btn btn-primary w-100 mt-4">Next: Verify Email <i class="bi bi-arrow-right"></i></button>
        </form>
    `;

    document.getElementById('reg-step-1').addEventListener('submit', async (e) => {
        e.preventDefault();
        registrationData = {
            company_name: document.getElementById('reg-cname').value,
            company_type: document.getElementById('reg-ctype').value,
            owner_name: document.getElementById('reg-oname').value,
            business_email: document.getElementById('reg-email').value,
            mobile_number: document.getElementById('reg-mobile').value,
            password: document.getElementById('reg-pass').value
        };
        
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = 'Sending OTP...';

        try {
            const res = await fetch('/api/companies/request-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: registrationData.business_email })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to send OTP');
            }
            renderRegistrationStep2();
        } catch(error) {
            alert(error.message);
            btn.disabled = false;
            btn.innerHTML = 'Next: Verify Email <i class="bi bi-arrow-right"></i>';
        }
    });
}

function renderRegistrationStep2() {
    document.getElementById('register-modal-body').innerHTML = `
        <div class="text-center mb-4">
            <h4 class="fw-bold">Verify Your Email</h4>
            <p class="text-muted mb-0">We sent a 6-digit code to <strong>${registrationData.business_email}</strong></p>
        </div>
        <form id="reg-step-2">
            <div class="mb-4">
                <input type="text" class="form-control form-control-lg text-center fw-bold" id="reg-otp" placeholder="Enter 6-digit OTP" maxlength="6" required style="letter-spacing: 4px;">
            </div>
            <button type="submit" class="btn btn-primary w-100">Verify & Register</button>
        </form>
    `;

    document.getElementById('reg-step-2').addEventListener('submit', async (e) => {
        e.preventDefault();
        registrationData.otp = document.getElementById('reg-otp').value;
        
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = 'Registering...';

        try {
            const res = await fetch('/api/companies/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Registration Failed');
            }
            const data = await res.json();
            renderRegistrationStep3(data);
        } catch(error) {
            alert(error.message);
            btn.disabled = false;
            btn.innerHTML = 'Verify & Register';
        }
    });
}

function renderRegistrationStep3(data) {
    document.getElementById('register-modal-body').innerHTML = `
        <div class="text-center">
            <div class="mb-3">
                <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
            </div>
            <h4 class="fw-bold">Company Registered!</h4>
            <p class="text-muted">Save this Company Code securely. Employees will need it to join your organization.</p>
            
            <div class="bg-light p-3 rounded-3 my-4 border">
                <h3 class="fw-bold text-primary mb-0" style="letter-spacing: 2px;">${data.company_code}</h3>
            </div>
            
            <div class="mb-4">
                <img src="${data.qr_code_base64}" alt="Company QR Code" class="img-fluid rounded border" style="max-width: 200px;">
            </div>
            
            <button type="button" class="btn btn-outline-secondary w-100" data-bs-dismiss="modal" onclick="fetchCompanies()">Close & Refresh</button>
        </div>
    `;
}

async function fetchCompanies() {
    try {
        const res = await fetch('/api/companies/', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('erp_token')}`
            }
        });
        if (!res.ok) throw new Error('Failed to fetch companies');
        
        const companies = await res.json();
        const tbody = document.getElementById('companies-table-body');
        
        if (companies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2"></i>No companies registered yet.</td></tr>';
            return;
        }

        tbody.innerHTML = companies.map(c => `
            <tr>
                <td class="fw-medium">${c.company_name}</td>
                <td><span class="badge bg-light text-dark border font-monospace">${c.company_code}</span></td>
                <td>${c.company_type}</td>
                <td>
                    <span class="badge ${c.is_active ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill">
                        ${c.is_active ? 'Active' : 'Suspended'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-secondary me-1" title="Manage"><i class="bi bi-gear"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Suspend"><i class="bi bi-slash-circle"></i></button>
                </td>
            </tr>
        `).join('');
        
        // Update total companies stat
        const totalElements = document.querySelectorAll('.stat-card h2');
        if (totalElements.length > 0) {
            totalElements[0].innerText = companies.length;
        }
    } catch (error) {
        console.error(error);
        document.getElementById('companies-table-body').innerHTML = '<tr><td colspan="5" class="text-center p-4 text-danger">Failed to load data.</td></tr>';
    }
}
