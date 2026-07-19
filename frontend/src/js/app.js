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
                        <button class="btn btn-primary shadow-sm" onclick="alert('Company creation coming soon!')">
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
                                <h5 class="m-0 fw-semibold text-dark">Recent Activity</h5>
                            </div>
                            <div class="p-5 text-center text-muted">
                                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                                No companies registered yet.
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        `;
        
        root.style.transition = 'opacity 0.4s ease';
        root.style.opacity = '1';
    }, 300);
}

function logout() {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_role');
    renderLogin();
}
