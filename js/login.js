/* ==========================================================================
   MYCOHAVEN PHARMA PLATFORM (MPDMS) — AUTHENTICATION CONTROLLER
   Handles Client-side Login Interaction, Hybrid API/Crypto Verification, and Session Setup
   ========================================================================== */

// Fallback Secure PBKDF2 Verification for static/cloud hosting
const AUTH_VAULT = {
    users: [
        {
            userIds: ['kiran-001', 'admin-001', 'mpdms-admin-001', 'emp-super'],
            fullName: 'MycoHaven Super Admin',
            role: 'Super Administrator',
            department: 'System Administration',
            designation: 'Super Administrator',
            employeeId: 'EMP-SUPER',
            email: 'admin@mycohaven.com',
            accountStatus: 'Active',
            passwordChangeRequired: true,
            // PBKDF2 HMAC-SHA256 hash (100,000 iterations) for Kiran@123
            hash: '100000:6jiCEXTw/gGfrv+ZbhwA/A==:c8i5Qa9iPErS2rAAEsmY8blLhQ2KtkTxjyAX7aH2jLc='
        }
    ]
};

async function verifyClientCryptoHash(password, storedHashStr) {
    try {
        const parts = storedHashStr.split(':');
        if (parts.length !== 3) return false;
        const iterations = parseInt(parts[0], 10);
        const saltBytes = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
        const expectedRaw = atob(parts[2]);

        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );

        const derivedBits = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBytes,
                iterations: iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );

        const actualRaw = String.fromCharCode(...new Uint8Array(derivedBits));
        return actualRaw === expectedRaw;
    } catch (e) {
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('form-login');
    const userIdInput = document.getElementById('login-user-id');
    const passwordInput = document.getElementById('login-password');
    const togglePasswordBtn = document.getElementById('btn-toggle-password');
    const eyeIcon = document.getElementById('icon-eye');
    const loginBtn = document.getElementById('btn-login');
    const loginBtnText = document.getElementById('login-btn-text');
    const loginBtnIcon = document.getElementById('login-btn-icon');
    const alertBox = document.getElementById('login-alert');
    const alertText = document.getElementById('login-alert-text');
    const forgotPasswordLink = document.getElementById('link-forgot-password');

    // Parse URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const redirectParam = urlParams.get('redirect');
    const reasonParam = urlParams.get('reason');

    // 0. Auto-redirect if already authenticated
    try {
        const sessionStr = sessionStorage.getItem('mpdms_auth_session');
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            const maxAge = 8 * 60 * 60 * 1000;
            const loginTime = session && session.loginTimestamp ? new Date(session.loginTimestamp).getTime() : 0;
            if (session && session.token && (Date.now() - loginTime <= maxAge)) {
                const target = redirectParam || (session.user && (session.user.role === 'Super Administrator' || session.user.role === 'Super Admin') ? '#super-admin-console' : '#dashboard');
                window.location.replace(`index.html${target.startsWith('#') ? target : '#' + target}`);
                return;
            }
        }
    } catch (e) {}

    // Check for expiration banner
    if (reasonParam === 'expired') {
        showAlert('Your session has expired. Please log in again.', 'info');
    }

    // 1. Password Visibility Toggle
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            eyeIcon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
        });
    }

    // 2. Alert Banner Helper
    function showAlert(message, type = 'error') {
        if (!alertBox || !alertText) return;
        alertText.textContent = message;
        alertBox.className = `login-alert ${type === 'error' ? 'login-alert-error' : 'login-alert-info'}`;
        alertBox.style.display = 'flex';
    }

    function hideAlert() {
        if (!alertBox) return;
        alertBox.style.display = 'none';
    }

    // 3. Loading State Control
    function setLoading(isLoading) {
        if (loginBtn) {
            loginBtn.disabled = isLoading;
        }
        if (userIdInput) userIdInput.disabled = isLoading;
        if (passwordInput) passwordInput.disabled = isLoading;

        if (isLoading) {
            loginBtnIcon.className = 'spinner';
            loginBtnText.textContent = 'Authenticating...';
        } else {
            loginBtnIcon.className = 'fa-solid fa-right-to-bracket';
            loginBtnText.textContent = 'Sign In to MPDMS';
        }
    }

    // 4. Form Submit Handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert();

            const rawUserId = userIdInput.value.trim();
            const password = passwordInput.value;
            const normalizedUserId = rawUserId.toLowerCase();

            // Client-side validation: prevent empty submissions
            if (!rawUserId) {
                showAlert('Please enter your User ID or Employee ID.');
                userIdInput.focus();
                return;
            }

            if (!password) {
                showAlert('Please enter your Password.');
                passwordInput.focus();
                return;
            }

            setLoading(true);

            let authSuccess = false;
            let authenticatedUser = null;
            let sessionToken = null;

            try {
                // Try backend API first
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ userId: rawUserId, password })
                }).catch(() => null);

                if (response && response.ok) {
                    const data = await response.json().catch(() => ({}));
                    if (data.success) {
                        authSuccess = true;
                        authenticatedUser = data.user;
                        sessionToken = data.sessionToken;
                    }
                } else if (response && (response.status === 401 || response.status === 403 || response.status === 400)) {
                    // Backend explicitly rejected credentials
                    const data = await response.json().catch(() => ({}));
                    const errorMsg = data.message || 'Invalid User ID or Password';
                    showAlert(errorMsg);
                    passwordInput.value = '';
                    passwordInput.focus();
                    setLoading(false);
                    return;
                }
            } catch (err) {}

            // Hybrid Client-side Crypto Fallback (for static hosting on app.mycohaven.com)
            if (!authSuccess) {
                const vaultUser = AUTH_VAULT.users.find(u => u.userIds.includes(normalizedUserId));
                if (vaultUser && vaultUser.accountStatus === 'Active') {
                    const isCorrect = await verifyClientCryptoHash(password, vaultUser.hash);
                    if (isCorrect) {
                        authSuccess = true;
                        sessionToken = 'mpdms_' + Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
                        authenticatedUser = {
                            userId: rawUserId,
                            employeeId: vaultUser.employeeId,
                            fullName: vaultUser.fullName,
                            email: vaultUser.email,
                            role: vaultUser.role,
                            department: vaultUser.department,
                            designation: vaultUser.designation,
                            accountStatus: vaultUser.accountStatus,
                            passwordChangeRequired: vaultUser.passwordChangeRequired
                        };
                    }
                }
            }

            if (authSuccess && authenticatedUser) {
                // Store authenticated session token and sanitized user context
                const sessionData = {
                    token: sessionToken,
                    user: authenticatedUser,
                    loginTimestamp: new Date().toISOString()
                };

                sessionStorage.setItem('mpdms_auth_session', JSON.stringify(sessionData));

                // Determine redirect target
                let targetRoute = redirectParam;
                if (!targetRoute) {
                    const isSuper = (
                        authenticatedUser.role === 'Super Administrator' ||
                        authenticatedUser.role === 'Super Admin' ||
                        authenticatedUser.userId.toLowerCase() === 'kiran-001' ||
                        authenticatedUser.userId.toLowerCase() === 'admin-001' ||
                        authenticatedUser.employeeId === 'EMP-SUPER'
                    );
                    targetRoute = isSuper ? '#super-admin-console' : '#dashboard';
                }

                if (!targetRoute.startsWith('#')) {
                    targetRoute = '#' + targetRoute;
                }

                loginBtnText.textContent = 'Authenticated. Opening MPDMS...';
                setTimeout(() => {
                    window.location.replace(`index.html${targetRoute}`);
                }, 350);
            } else {
                showAlert('Invalid User ID or Password');
                passwordInput.value = '';
                passwordInput.focus();
            }

            setLoading(false);
        });
    }

    // 5. Forgot Password Handler
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showAlert('Please contact your System Administrator (admin@mycohaven.com) or the CSV department to request a password reset.', 'info');
        });
    }
});
