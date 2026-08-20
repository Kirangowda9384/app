/* ==========================================================================
   MYCOHAVEN PHARMA PLATFORM UI CONTROLLER (MULTI-TENANT)
   Handles Routing, Modals, Toasts, Dual-Selector Switcher, and E-Signatures
   ========================================================================== */

import { state } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderMasters } from './masters.js';
import { renderProduction } from './production.js';
import { renderAuditTrail } from './audit.js';

// Open Modal Helper
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        const form = modal.querySelector('form');
        if (form && modalId !== 'modal-esignature') {
            form.reset();
        }
    }
}

// Close Modal Helper
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Toast Notifications System
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-notifications');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : ''}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight var(--transition-fast) reverse';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}

// 21 CFR Part 11 Electronic Signature Handler (Re-Authentication via Login Password)
let esignCallback = null;
let esignPurpose = '';
let esignTargetRef = '';

export function promptElectronicSignature(purpose, onSuccess, targetRef = '') {
    const session = getAuthSession();
    const activeUser = (session && session.user) ? session.user : state.getActiveUser();
    
    const userDisplay = activeUser.fullName || activeUser.name || activeUser.userId || 'User';
    const userRole = activeUser.role || activeUser.designation || 'Employee';

    const userDisplayInput = document.getElementById('esign-user-display');
    const purposeInput = document.getElementById('esign-purpose');
    const passInput = document.getElementById('esign-password');
    const errEl = document.getElementById('esign-error-msg');

    if (userDisplayInput) userDisplayInput.value = `${userDisplay} (${userRole})`;
    if (purposeInput) purposeInput.value = purpose;
    if (passInput) passInput.value = '';
    if (errEl) errEl.style.display = 'none';

    esignCallback = onSuccess;
    esignPurpose = purpose;
    esignTargetRef = targetRef;

    openModal('modal-esignature');
}

export async function verifyClientCryptoHash(password, storedHashStr) {
    try {
        if (!storedHashStr || typeof storedHashStr !== 'string') return false;
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

async function handleESignSubmit(e) {
    e.preventDefault();
    const passwordInput = document.getElementById('esign-password').value;
    const session = getAuthSession();
    const activeUser = session ? session.user : state.getActiveUser();
    const token = session ? session.token : '';
    const errEl = document.getElementById('esign-error-msg');

    if (!passwordInput) {
        if (errEl) {
            errEl.textContent = 'Please enter your login password.';
            errEl.style.display = 'block';
        }
        return;
    }

    if (!activeUser) {
        if (errEl) {
            errEl.textContent = 'Authentication session missing. Please log in again.';
            errEl.style.display = 'block';
        }
        return;
    }

    let isVerified = false;
    let signeeInfo = activeUser;
    let verifiedTimestamp = new Date().toISOString();

    // 1. Try Backend API Verification
    try {
        const res = await fetch('/api/auth/verify-signature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                password: passwordInput,
                purpose: esignPurpose,
                targetRef: esignTargetRef
            })
        });

        if (res && res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.success) {
                isVerified = true;
                if (data.signee) signeeInfo = data.signee;
                if (data.timestamp) verifiedTimestamp = data.timestamp;
            }
        } else if (res && (res.status === 401 || res.status === 403 || res.status === 400)) {
            // Backend explicitly evaluated and rejected password
            const data = await res.json().catch(() => ({}));
            const failMsg = data.message || 'Password verification failed. The electronic signature was not completed.';
            if (errEl) {
                errEl.textContent = failMsg;
                errEl.style.display = 'block';
            }
            showToast(failMsg, 'error');

            const signeeId = activeUser.userId || activeUser.employeeId || 'USER';
            state.logAudit(signeeId, 'ESIGN_FAILURE', `FAILED electronic signature password re-authentication for: ${esignPurpose}`);
            state.save();
            return;
        }
    } catch (netErr) {
        // Backend not reachable / static hosting fallback
    }

    // 2. Hybrid Client-side PBKDF2 Crypto Verification (for static/cloud hosting)
    if (!isVerified) {
        const normalizedId = (activeUser.userId || activeUser.empId || '').toLowerCase();
        let userHash = null;

        // Check Kiran Administrator vault hash
        if (['kiran-001', 'admin-001', 'mpdms-admin-001', 'emp-super'].includes(normalizedId) || activeUser.role === 'Administrator') {
            userHash = '100000:6jiCEXTw/gGfrv+ZbhwA/A==:c8i5Qa9iPErS2rAAEsmY8blLhQ2KtkTxjyAX7aH2jLc=';
        }

        // Check local state users
        if (!userHash && state.users) {
            const found = state.users.find(u => (u.userId || u.empId || '').toLowerCase() === normalizedId);
            if (found && found.password_hash) {
                userHash = found.password_hash;
            }
        }

        if (userHash) {
            const isMatch = await verifyClientCryptoHash(passwordInput, userHash);
            if (isMatch) {
                isVerified = true;
            }
        }
    }

    // 3. Process Verification Result
    if (isVerified) {
        closeModal('modal-esignature');
        showToast('Electronic signature confirmed successfully.');

        const signeeId = signeeInfo.userId || signeeInfo.employeeId || 'USER';

        state.logAudit(signeeId, 'ELECTRONIC_SIGNATURE', `Electronic signature confirmed for: ${esignPurpose}`, esignTargetRef || esignPurpose, {
            status: 'VERIFIED',
            signeeName: signeeInfo.fullName || signeeInfo.name,
            signeeRole: signeeInfo.role,
            timestamp: verifiedTimestamp
        });
        state.save();

        if (esignCallback) {
            esignCallback(signeeInfo);
        }
    } else {
        const failMsg = 'Password verification failed. The electronic signature was not completed.';
        if (errEl) {
            errEl.textContent = failMsg;
            errEl.style.display = 'block';
        }
        showToast(failMsg, 'error');

        const signeeId = activeUser.userId || activeUser.employeeId || 'USER';
        state.logAudit(signeeId, 'ESIGN_FAILURE', `FAILED electronic signature password re-authentication for: ${esignPurpose}`);
        state.save();
    }
}

// Authentication & Session Guard
export function getAuthSession() {
    try {
        const sessionStr = sessionStorage.getItem('mpdms_auth_session');
        if (!sessionStr) return null;
        const session = JSON.parse(sessionStr);
        const maxAge = 8 * 60 * 60 * 1000; // 8 hours
        const loginTime = session && session.loginTimestamp ? new Date(session.loginTimestamp).getTime() : 0;
        if (!session || !session.token || (Date.now() - loginTime > maxAge)) {
            sessionStorage.removeItem('mpdms_auth_session');
            return null;
        }
        return session;
    } catch (e) {
        sessionStorage.removeItem('mpdms_auth_session');
        return null;
    }
}

export function requireAuth() {
    const session = getAuthSession();
    if (!session) {
        const currentHash = window.location.hash || '';
        const redirectUrl = currentHash ? `login.html?redirect=${encodeURIComponent(currentHash)}` : 'login.html';
        window.location.replace(redirectUrl);
        return null;
    }
    return session;
}

export function handleLogout() {
    const session = getAuthSession();
    if (session && session.token) {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            }
        }).catch(() => {});
    }
    sessionStorage.removeItem('mpdms_auth_session');
    sessionStorage.removeItem('mpdms_redirect_target');
    window.location.replace('login.html');
}

// Single Page Application Panel Routing
export function hasUserPrivilege(sessionUser, domain, module, action) {
    if (!sessionUser) return false;
    if (sessionUser.role === 'Administrator' || sessionUser.userId === 'Kiran-001' || sessionUser.employeeId === 'EMP-SUPER') {
        return true;
    }
    const privs = sessionUser.privileges;
    if (!privs) return false;

    if (typeof privs === 'object' && !Array.isArray(privs)) {
        if (privs[domain] && privs[domain][module]) {
            const list = privs[domain][module];
            if (!action) return list.length > 0;
            return list.includes(action);
        }
    }

    if (Array.isArray(privs) || typeof privs === 'string') {
        const arr = Array.isArray(privs) ? privs : [privs];
        if (domain === 'execution' && arr.includes('Execution')) {
            if (!action || action === 'View' || action === 'Execute') return true;
        }
        if (domain === 'masters' && arr.includes('Masters')) {
            if (!action || action === 'View') return true;
        }
    }
    return false;
}

function handlePanelRouting() {
    const session = requireAuth();
    if (!session) return;
    
    const isSuperUser = session.user && (
        session.user.role === 'Super Administrator' || 
        session.user.role === 'Super Admin' ||
        session.user.role === 'Administrator' ||
        session.user.employeeId === 'EMP-SUPER' ||
        session.user.userId === 'ADMIN-001' ||
        session.user.userId === 'MPDMS-ADMIN-001' ||
        session.user.userId.toLowerCase() === 'kiran-001'
    );

    const defaultRoute = '#dashboard';
    const hash = window.location.hash || defaultRoute;
    const cleanHash = hash.replace('#', '');

    const hasMastersAccess = hasUserPrivilege(session.user, 'masters', 'user_management', 'View');

    // Guard Super Admin Console against unauthorized roles
    if (cleanHash === 'super-admin-console' && !isSuperUser) {
        showToast('Access Denied: Super Administrator privileges required.', 'error');
        window.location.hash = '#dashboard';
        return;
    }

    // Guard Masters & User Management against non-authorized Employees
    if ((cleanHash === 'user-master' || cleanHash === 'masters') && !hasMastersAccess) {
        showToast('Access Denied: Masters domain access privileges required.', 'error');
        window.location.hash = '#execution';
        return;
    }

    document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const targetPanelId = `panel-${cleanHash}`;
    const targetPanel = document.getElementById(targetPanelId);
    
    if (targetPanel) {
        targetPanel.classList.add('active');
        
        const targetNavLink = document.getElementById(`nav-${cleanHash}`);
        if (targetNavLink) {
            targetNavLink.classList.add('active');
        }
        
        updateHeaderTitle(cleanHash);
        triggerPanelRender(cleanHash);
    } else {
        window.location.hash = defaultRoute;
    }
}

function updateHeaderTitle(route) {
    const titleEl = document.getElementById('current-view-title');
    const subtitleEl = document.getElementById('current-view-subtitle');
    
    const routeInfo = {
        'super-admin-console': { title: 'Super Admin Vendor Console', sub: 'Manage customer company tenants, modules, and licenses' },
        'dashboard': { title: 'Dashboard Overview', sub: 'Primary MPDMS domain navigation grid' },
        'masters': { title: 'Masters Domain', sub: 'Enterprise master data, templates, and setup directory' },
        'execution': { title: 'Execution Domain', sub: 'Digital floor executions and operational process logs' },
        'user-master': { title: 'Employee Configuration', sub: 'Manage corporate employees and credentials' },
        'user-group-master': { title: 'User Group Configuration', sub: 'Roles, authorization policies, and access control' },
        'department-master': { title: 'Departments Directory', sub: 'Configure and monitor corporate organizational groups' },
        'area-master': { title: 'Manufacturing Areas', sub: 'Area codes, operations status, and usage controls' },
        'equipment-master': { title: 'Equipment Directory', sub: 'Asset registers, calibrations, and active states' },
        'product-master': { title: 'Product Catalogue', sub: 'Standard batch formulations and operations' },
        'annexure-master': { title: 'Annexure Master', sub: 'Configure dynamic quality log checksheet grids' },
        'workflow-config': { title: 'Workflow Configuration', sub: 'Customize sequential review paths and authorization routes' },
        'bmr-template-master': { title: 'BMR Templates Builder', sub: 'Define digital Batch Manufacturing Record instructions' },
        'active-batches': { title: 'Production Floor Executions', sub: 'Create, monitor, and execute active product batches' },
        'batch-execution': { title: 'Digital Batch Manufacturing Record (BMR)', sub: 'In-progress digital batch execution and review logs' },
        'area-logbook': { title: 'Area Usage Logbook', sub: 'Chronological cleaning and usage logs for production suites' },
        'equipment-logbook': { title: 'Equipment Usage Logbook', sub: 'Chronological equipment operational and maintenance history' },
        'audit-trail': { title: 'Regulatory Compliance Audit Trail', sub: 'Chronological, tamper-evident log of all system activity' }
    };
    
    const info = routeInfo[route] || routeInfo['dashboard'];
    titleEl.textContent = info.title;
    subtitleEl.textContent = info.sub;
}

export function triggerPanelRender(route) {
    switch (route) {
        case 'super-admin-console':
            renderSuperAdminConsole();
            break;
        case 'dashboard':
            renderDashboard();
            break;
        case 'masters':
        case 'execution':
            break;
        case 'user-master':
        case 'user-group-master':
        case 'department-master':
        case 'area-master':
        case 'equipment-master':
        case 'product-master':
        case 'annexure-master':
        case 'workflow-config':
        case 'bmr-template-master':
            renderMasters(route);
            break;
        case 'active-batches':
        case 'batch-execution':
        case 'area-logbook':
        case 'equipment-logbook':
            renderProduction(route);
            break;
        case 'audit-trail':
            renderAuditTrail();
            break;
    }
}

// 0. Super Admin Console Renderer (Vendor Dashboard)
function renderSuperAdminConsole() {
    const tbody = document.querySelector('#table-companies tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    state.companies.forEach(company => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${company.id}</strong></td>
            <td>${company.name}</td>
            <td><span class="badge ${company.status === 'Active' ? 'badge-active' : 'badge-danger'}">${company.status}</span></td>
            <td><code>${company.licenseExpiry}</code></td>
            <td>${company.enabledModules.map(m => `<span class="user-role-badge" style="background-color: var(--color-teal-glow); color: var(--color-teal); border-color: rgba(13, 148, 136, 0.1); margin-right: 4px;">${m}</span>`).join('')}</td>
            <td>
                <button class="btn ${company.status === 'Active' ? 'btn-danger' : 'btn-success'} btn-sm btn-toggle-company" data-id="${company.id}">
                    <i class="fa-solid ${company.status === 'Active' ? 'fa-ban' : 'fa-circle-check'}"></i> ${company.status === 'Active' ? 'Suspend' : 'Activate'}
                </button>
            </td>
        `;
        
        tr.querySelector('.btn-toggle-company').onclick = () => {
            const oldStatus = company.status;
            company.status = company.status === 'Active' ? 'Suspended' : 'Active';
            state.logAudit('EMP-SUPER', 'COMPANY_STATUS_CHANGE', `Toggled license for ${company.name} (${company.id}) to ${company.status}`, company.id, { before: { status: oldStatus }, after: { status: company.status } });
            state.save();
            renderSuperAdminConsole();
            showToast(`Company ${company.name} license state updated.`);
        };
        
        tbody.appendChild(tr);
    });

    document.getElementById('btn-add-company').onclick = () => {
        openModal('modal-company');
    };
}

// Super Admin Register Company submission
document.getElementById('form-company').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('company-id').value.trim().toUpperCase();
    const name = document.getElementById('company-name').value.trim();
    const expiry = document.getElementById('company-expiry').value;
    
    const checkedModules = document.querySelectorAll('input[name="company-modules"]:checked');
    const enabledModules = Array.from(checkedModules).map(cb => cb.value);
    
    if (state.companies.some(c => c.id === id)) {
        showToast('Company ID Code already exists.', 'error');
        return;
    }
    
    // Create new tenant company
    const newCompany = { id, name, status: 'Active', licenseExpiry: expiry, enabledModules };
    state.companies.push(newCompany);
    state.logAudit('EMP-SUPER', 'CREATE_COMPANY', `Registered new tenant company: ${name} (${id})`, id, { after: newCompany });
    
    // Seed default workflow and department for new company
    state.workflows.push({
        companyId: id,
        id: 'WF-DEFAULT',
        name: 'Standard Sequence Route',
        steps: ['Production Operator', 'Production Supervisor', 'QA Approver']
    });
    
    state.departments.push({ companyId: id, name: 'Production', active: true });
    state.departments.push({ companyId: id, name: 'QA', active: true });
    
    // Seed an initial Admin for this new company
    const newAdminEmpId = `EMP-${id}-01`;
    state.users.push({
        companyId: id,
        empId: newAdminEmpId,
        name: `${name} Administrator`,
        dept: 'QA',
        role: 'Admin',
        pin: '1234',
        active: true
    });
    
    state.save();
    closeModal('modal-company');
    renderSuperAdminConsole();
    initUserSwitcher(); // Re-populate switcher with new company details
    showToast(`Company ${name} registered. Default Admin created: ${newAdminEmpId} (PIN: 1234).`);
};

// Initialize Dual Selector Switcher (Company Dropdown + User Dropdown)
export function initUserSwitcher() {
    const compSelector = document.getElementById('demo-company-selector');
    const userSelector = document.getElementById('demo-user-selector');
    if (!compSelector || !userSelector) return;
    
    // 1. Populate Company Selector
    compSelector.innerHTML = '';
    
    // Add Vendor (System Management) option
    const sysOpt = document.createElement('option');
    sysOpt.value = 'SYSTEM';
    sysOpt.textContent = 'MycoHaven (Vendor)';
    if (state.activeCompanyId === 'SYSTEM' || state.activeUserEmpId === 'EMP-SUPER') {
        sysOpt.selected = true;
    }
    compSelector.appendChild(sysOpt);
    
    state.companies.forEach(company => {
        const opt = document.createElement('option');
        opt.value = company.id;
        opt.textContent = company.name;
        if (company.id === state.activeCompanyId && state.activeUserEmpId !== 'EMP-SUPER') {
            opt.selected = true;
        }
        compSelector.appendChild(opt);
    });
    
    // 2. Populate User Selector based on Company selection
    const repopulateUsersDropdown = () => {
        const selectedCompany = compSelector.value;
        userSelector.innerHTML = '';
        
        let filteredUsers = [];
        if (selectedCompany === 'SYSTEM') {
            // Super Admin only
            filteredUsers = state.users.filter(u => u.companyId === 'SYSTEM');
        } else {
            // Company specific users
            filteredUsers = state.users.filter(u => u.companyId === selectedCompany && u.active);
        }
        
        filteredUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.empId;
            opt.textContent = `${u.name} (${u.designation || u.userType || 'System'})`;
            if (u.empId === state.activeUserEmpId) {
                opt.selected = true;
            }
            userSelector.appendChild(opt);
        });
        
        // Auto select first user if activeUserEmpId is not in list
        const activeUserInList = filteredUsers.some(u => u.empId === state.activeUserEmpId);
        if (!activeUserInList && filteredUsers.length > 0) {
            userSelector.value = filteredUsers[0].empId;
            state.switchSession(selectedCompany, filteredUsers[0].empId);
        }
    };
    
    repopulateUsersDropdown();
    
    // Update active badges and sidebars
    updateUISidebarVisibility();
    
    // Event handlers
    compSelector.onchange = () => {
        repopulateUsersDropdown();
        const selectedCompany = compSelector.value;
        const selectedUser = userSelector.value;
        
        state.switchSession(selectedCompany, selectedUser);
        updateUISidebarVisibility();
        
        // Redirect to dashboard on company swap
        window.location.hash = '#dashboard';
        handlePanelRouting();
    };
    
    userSelector.onchange = () => {
        const selectedCompany = compSelector.value;
        const selectedUser = userSelector.value;
        
        const switched = state.switchSession(selectedCompany, selectedUser);
        if (switched) {
            const nameEl = document.getElementById('header-user-name');
            if (nameEl) {
                nameEl.textContent = switched.name || '';
            }
            document.getElementById('header-user-role').textContent = switched.designation || switched.userType || 'System';
            updateUISidebarVisibility();
            
            // Re-render current route panel
            const hash = window.location.hash || '#dashboard';
            const cleanHash = hash.replace('#', '');
            triggerPanelRender(cleanHash);
            
            showToast(`Switched active session to ${switched.name}`);
        }
    };
}

// Shows/Hides sidebar items depending on role (Super Admin vs client tenant)
function updateUISidebarVisibility() {
    const activeUser = state.getActiveUser();
    const isSuperAdmin = activeUser.empId === 'EMP-SUPER';
    
    const superAdminLabel = document.getElementById('section-superadmin-label');
    const superAdminLink = document.getElementById('nav-super-admin-console');
    
    const footerBadge = document.getElementById('sidebar-tenant-badge');
    
    const hasMastersAccess = hasUserPrivilege(activeUser, 'masters', 'user_management', 'View');

    const mastersCard = document.querySelector('a[href="#masters"]');
    if (mastersCard) {
        mastersCard.style.display = hasMastersAccess ? 'flex' : 'none';
    }

    if (isSuperAdmin || activeUser.role === 'Administrator') {
        // Administrator: Show Vendor operations, Super Admin Console, and Configuration
        if (superAdminLabel) superAdminLabel.style.display = 'block';
        if (superAdminLink) superAdminLink.style.display = 'flex';
        
        document.querySelectorAll('.nav-item').forEach(item => item.style.display = 'flex');
        document.querySelectorAll('.nav-section-label').forEach(lbl => lbl.style.display = 'block');
        
        if (footerBadge) {
            footerBadge.textContent = 'System Administrator';
            footerBadge.parentElement.style.backgroundColor = 'var(--color-blue-glow)';
            footerBadge.parentElement.style.color = 'var(--color-blue)';
            footerBadge.parentElement.style.borderColor = 'rgba(33, 150, 243, 0.2)';
        }
    } else {
        // Hide Super Admin links, show tenant operational items
        if (superAdminLabel) superAdminLabel.style.display = 'none';
        if (superAdminLink) superAdminLink.style.display = 'none';
        
        const modules = activeUser.moduleAccess || [];
        const isMaster = activeUser.userType === 'Master User';
        const isProduction = activeUser.userType === 'Production User';
        
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.id === 'nav-super-admin-console') {
                item.style.display = 'none';
            } else if (item.id === 'nav-dashboard') {
                item.style.display = 'flex';
            } else {
                let prev = item.previousElementSibling;
                while (prev && !prev.classList.contains('nav-section-label')) {
                    prev = prev.previousElementSibling;
                }
                const sectionName = prev ? prev.textContent : '';
                
                let show = false;
                if (sectionName === 'Configuration') {
                    show = isMaster && modules.includes('Masters');
                } else if (sectionName === 'Production Floor') {
                    show = isProduction;
                    if (show) {
                        if (item.id === 'nav-active-batches' && !modules.includes('eBMR')) show = false;
                        if ((item.id === 'nav-area-logbook' || item.id === 'nav-equipment-logbook') && !modules.includes('eLogbook')) show = false;
                    }
                } else if (sectionName === 'Compliance') {
                    show = true;
                    if (item.id === 'nav-audit-trail' && !modules.includes('QMS')) show = false;
                }
                
                item.style.display = show ? 'flex' : 'none';
            }
        });
        
        document.querySelectorAll('.nav-section-label').forEach(lbl => {
            if (lbl.id === 'section-superadmin-label') {
                lbl.style.display = 'none';
            } else if (lbl.textContent === 'Configuration') {
                lbl.style.display = (isMaster && modules.includes('Masters')) ? 'block' : 'none';
            } else if (lbl.textContent === 'Production Floor') {
                lbl.style.display = isProduction ? 'block' : 'none';
            } else if (lbl.textContent === 'Compliance') {
                lbl.style.display = modules.includes('QMS') ? 'block' : 'none';
            }
        });
        
        const company = state.companies.find(c => c.id === state.activeCompanyId) || { name: 'Unknown Tenant' };
        if (footerBadge) {
            footerBadge.textContent = `${company.name} Active`;
            footerBadge.parentElement.style.backgroundColor = 'var(--color-teal-glow)';
            footerBadge.parentElement.style.color = 'var(--color-teal)';
            footerBadge.parentElement.style.borderColor = 'rgba(13, 148, 136, 0.2)';
        }
    }
    
    const nameEl = document.getElementById('header-user-name');
    if (nameEl) {
        nameEl.textContent = activeUser.name || '';
    }
    
    const roleBadge = document.getElementById('header-user-role');
    if (roleBadge) {
        roleBadge.textContent = activeUser.designation || activeUser.userType || 'System';
    }
}

// Time display updater
function initTimeDisplay() {
    const timeEl = document.getElementById('system-time-display').querySelector('span');
    const updateTime = () => {
        const now = new Date();
        const options = {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true
        };
        timeEl.textContent = now.toLocaleString('en-US', options);
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// Mobile sidebar drawer
function initMobileToggle() {
    const toggle = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        toggle.querySelector('i').className = 'fa-solid fa-xmark';
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        toggle.querySelector('i').className = 'fa-solid fa-bars';
        document.body.style.overflow = '';
    }

    if (toggle && sidebar) {
        toggle.onclick = () => {
            if (sidebar.classList.contains('active')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        };

        // Close sidebar when tapping the overlay backdrop
        if (overlay) {
            overlay.onclick = closeSidebar;
        }

        // Close sidebar when any nav link is clicked (navigate and collapse)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', closeSidebar);
        });
    }
}

// Modal closing helpers
function initModalCloseHandlers() {
    document.querySelectorAll('.btn-close-modal, .btn-cancel-modal, .btn-close-only').forEach(btn => {
        btn.onclick = (e) => {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        };
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.onclick = (e) => {
            if (e.target === modal) closeModal(modal.id);
        };
    });
}

// Global Launcher Entry point
export function initApplication() {
    const session = requireAuth();
    if (!session) return;

    // Synchronize multi-tenant state with authenticated session
    if (session.user) {
        const isSuperUser = (
            session.user.role === 'Super Administrator' ||
            session.user.role === 'Super Admin' ||
            session.user.role === 'Administrator' ||
            session.user.employeeId === 'EMP-SUPER' ||
            session.user.userId === 'ADMIN-001' ||
            session.user.userId === 'MPDMS-ADMIN-001' ||
            session.user.userId.toLowerCase() === 'kiran-001'
        );
        if (isSuperUser) {
            state.activeCompanyId = 'SYSTEM';
            state.activeUserEmpId = 'EMP-SUPER';
        } else if (session.user.employeeId) {
            state.activeUserEmpId = session.user.employeeId;
        }
    }

    initTimeDisplay();
    initUserSwitcher();
    initMobileToggle();
    initModalCloseHandlers();
    
    // Wire up Logout buttons
    const headerLogout = document.getElementById('btn-header-logout');
    if (headerLogout) {
        headerLogout.onclick = (e) => {
            e.preventDefault();
            handleLogout();
        };
    }
    const sidebarLogout = document.getElementById('btn-sidebar-logout');
    if (sidebarLogout) {
        sidebarLogout.onclick = (e) => {
            e.preventDefault();
            handleLogout();
        };
    }

    document.getElementById('form-esignature').onsubmit = handleESignSubmit;
    
    // Browser Back / bfcache Protection
    window.addEventListener('pageshow', () => {
        requireAuth();
    });
    window.addEventListener('popstate', () => {
        requireAuth();
    });

    window.addEventListener('hashchange', handlePanelRouting);
    handlePanelRouting();
}
