/* ==========================================================================
   MYCOHAVEN PHARMA PLATFORM (MPDMS) — AUTHENTICATION CONTROLLER
   Handles Client-side Login Interaction, API Communication, and Session Setup
   ========================================================================== */

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

            const userId = userIdInput.value.trim();
            const password = passwordInput.value;

            // Client-side validation: prevent empty submissions
            if (!userId) {
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

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ userId, password })
                });

                const data = await response.json().catch(() => ({}));

                if (response.ok && data.success) {
                    // Store authenticated session token and sanitized user context
                    const sessionData = {
                        token: data.sessionToken,
                        user: data.user,
                        loginTimestamp: new Date().toISOString()
                    };

                    sessionStorage.setItem('mpdms_auth_session', JSON.stringify(sessionData));

                    // Determine redirect target
                    let targetRoute = redirectParam;
                    if (!targetRoute) {
                        const isSuper = (
                            data.user.role === 'Super Administrator' ||
                            data.user.role === 'Super Admin' ||
                            data.user.userId === 'ADMIN-001' ||
                            data.user.userId === 'MPDMS-ADMIN-001' ||
                            data.user.employeeId === 'EMP-SUPER'
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
                    const errorMsg = data.message || 'Invalid User ID or Password';
                    showAlert(errorMsg);
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            } catch (err) {
                showAlert('Unable to reach authentication service. Please check network connection.');
            } finally {
                setLoading(false);
            }
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
