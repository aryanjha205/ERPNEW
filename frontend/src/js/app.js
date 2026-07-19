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
        // If the ID is super admin PIN format
        if (id.toLowerCase() === 'admin' && password === '2015') { // Placeholder logic to trigger Super Admin
             const res = await fetch('/api/auth/super-admin/login', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ pin: password })
             });
             const data = await res.json();
             
             if (res.ok) {
                 localStorage.setItem('erp_token', data.access_token);
                 // Redirect to Super Admin Dashboard (To be implemented)
                 alert('Super Admin Login Successful!');
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
