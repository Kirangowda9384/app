/* ==========================================================================
   MYCOHAVEN PHARMA PLATFORM MASTERS MODULE (MULTI-TENANT)
   CRUD Interfaces for Configuration Masters, Annexures, and Workflows
   ========================================================================== */

import { state } from './state.js';
import { openModal, closeModal, showToast, promptElectronicSignature } from './ui.js';

export function renderMasters(route) {
    switch (route) {
        case 'user-master':
            renderUsers();
            break;
        case 'user-group-master':
            renderUserGroups();
            break;
        case 'department-master':
            renderDepartments();
            break;
        case 'area-master':
            renderAreas();
            break;
        case 'equipment-master':
            renderEquipment();
            break;
        case 'product-master':
            renderProducts();
            break;
        case 'annexure-master':
            renderAnnexures();
            break;
        case 'workflow-config':
            renderWorkflows();
            break;
        case 'bmr-template-master':
            renderBMRTemplates();
            break;
    }
}

// ==========================================================================
// 1. USER MASTER (Tenant-scoped)
// ==========================================================================
let editingEmpId = null;

function renderUsers() {
    const tbody = document.querySelector('#table-users tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const tenantUsers = state.users || [];

    tenantUsers.forEach(user => {
        const tr = document.createElement('tr');
        let accessText = 'None';
        if (user.role === 'Administrator' || user.userId === 'Kiran-001' || user.empId === 'EMP-SUPER') {
            accessText = 'Full Administrator Access';
        } else if (typeof user.privileges === 'object' && user.privileges !== null && !Array.isArray(user.privileges)) {
            const parts = [];
            if (user.privileges.masters) {
                for (const m in user.privileges.masters) {
                    if (user.privileges.masters[m] && user.privileges.masters[m].length) {
                        parts.push(`Masters: ${m} (${user.privileges.masters[m].join(', ')})`);
                    }
                }
            }
            if (user.privileges.execution) {
                for (const m in user.privileges.execution) {
                    if (user.privileges.execution[m] && user.privileges.execution[m].length) {
                        parts.push(`Execution: ${m} (${user.privileges.execution[m].join(', ')})`);
                    }
                }
            }
            accessText = parts.length ? parts.join(' | ') : 'Execution (Default)';
        } else if (Array.isArray(user.privileges)) {
            accessText = user.privileges.join(', ');
        } else if (typeof user.privileges === 'string') {
            accessText = user.privileges;
        }

        const isActive = user.active !== false && user.accountStatus !== 'Inactive';
        const userId = user.userId || user.empId;
        const userName = user.name || user.fullName;
        
        tr.innerHTML = `
            <td><strong>${userId}</strong></td>
            <td>${userName}</td>
            <td><span class="user-role-badge">${user.role || user.designation || 'Employee'}</span></td>
            <td><span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">${isActive ? 'Active' : 'Inactive'}</span></td>
            <td><small style="color:var(--color-text-secondary); font-weight:600;">${accessText}</small></td>
            <td>
                <button class="btn ${isActive ? 'btn-danger' : 'btn-success'} btn-sm btn-toggle-status" data-id="${userId}" data-status="${isActive ? 'Inactive' : 'Active'}">
                    <i class="fa-solid ${isActive ? 'fa-user-slash' : 'fa-user-check'}"></i> ${isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button class="btn btn-secondary btn-sm btn-reset-password" data-id="${userId}" data-name="${userName}" style="margin-left: 4px;">
                    <i class="fa-solid fa-key"></i> Reset Password
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    let currentWizardStep = 1;

    function setWizardStep(step) {
        currentWizardStep = step;
        const step1Container = document.getElementById('wizard-step-1');
        const step2Container = document.getElementById('wizard-step-2');
        const modalTitle = document.getElementById('modal-user-title');
        const tab1 = document.getElementById('step-tab-1');
        const tab2 = document.getElementById('step-tab-2');
        const err1 = document.getElementById('step1-error-msg');
        const err2 = document.getElementById('step2-error-msg');

        if (err1) err1.style.display = 'none';
        if (err2) err2.style.display = 'none';

        if (step === 1) {
            if (modalTitle) modalTitle.textContent = 'CREATE USER — STEP 1 OF 2';
            if (step1Container) step1Container.style.display = 'block';
            if (step2Container) step2Container.style.display = 'none';

            if (tab1) {
                tab1.style.background = 'rgba(33, 150, 243, 0.15)';
                tab1.style.borderColor = 'var(--color-blue)';
                tab1.style.color = 'var(--color-blue)';
                const numSpan = tab1.querySelector('span:first-child');
                if (numSpan) { numSpan.style.background = 'var(--color-blue)'; numSpan.style.color = '#fff'; }
            }
            if (tab2) {
                tab2.style.background = 'var(--color-bg-secondary)';
                tab2.style.borderColor = 'var(--color-border)';
                tab2.style.color = 'var(--color-text-muted)';
                const numSpan = tab2.querySelector('span:first-child');
                if (numSpan) { numSpan.style.background = 'var(--color-bg-tertiary)'; numSpan.style.color = 'var(--color-text-muted)'; }
            }
        } else if (step === 2) {
            if (modalTitle) modalTitle.textContent = 'CREATE USER — STEP 2 OF 2';
            if (step1Container) step1Container.style.display = 'none';
            if (step2Container) step2Container.style.display = 'block';

            if (tab1) {
                tab1.style.background = 'var(--color-bg-secondary)';
                tab1.style.borderColor = 'var(--color-border)';
                tab1.style.color = 'var(--color-text-muted)';
                const numSpan = tab1.querySelector('span:first-child');
                if (numSpan) { numSpan.style.background = 'var(--color-teal)'; numSpan.style.color = '#fff'; }
            }
            if (tab2) {
                tab2.style.background = 'rgba(33, 150, 243, 0.15)';
                tab2.style.borderColor = 'var(--color-blue)';
                tab2.style.color = 'var(--color-blue)';
                const numSpan = tab2.querySelector('span:first-child');
                if (numSpan) { numSpan.style.background = 'var(--color-blue)'; numSpan.style.color = '#fff'; }
            }
        }
    }

    document.getElementById('btn-add-user').onclick = () => {
        editingEmpId = null;
        document.getElementById('user-emp-id').value = '';
        document.getElementById('user-emp-id').readOnly = false;
        document.getElementById('user-name').value = '';
        document.getElementById('user-email').value = '';
        if (document.getElementById('user-password')) document.getElementById('user-password').value = '';
        if (document.getElementById('user-confirm-password')) document.getElementById('user-confirm-password').value = '';
        if (document.getElementById('user-role')) document.getElementById('user-role').value = 'Employee';
        if (document.getElementById('user-status')) document.getElementById('user-status').value = 'Active';
        
        document.querySelectorAll('input[name^="priv-"]').forEach(cb => cb.checked = false);
        const defaultEbmrView = document.querySelector('input[name="priv-execution-ebmr"][value="View"]');
        const defaultEbmrExe = document.querySelector('input[name="priv-execution-ebmr"][value="Execute"]');
        if (defaultEbmrView) defaultEbmrView.checked = true;
        if (defaultEbmrExe) defaultEbmrExe.checked = true;

        populateDropdown('user-dept', state.getTenantDepartments().map(d => d.name));
        setWizardStep(1);
        openModal('modal-user');
    };

    const btnNext = document.getElementById('btn-wizard-next');
    if (btnNext) {
        btnNext.onclick = () => {
            const userId = document.getElementById('user-emp-id').value.trim();
            const fullName = document.getElementById('user-name').value.trim();
            const role = document.getElementById('user-role').value;
            const status = document.getElementById('user-status').value;
            const dept = document.getElementById('user-dept').value;
            const err1 = document.getElementById('step1-error-msg');

            if (!userId) {
                if (err1) { err1.textContent = 'Please enter a valid User ID.'; err1.style.display = 'block'; }
                return;
            }
            if (!fullName) {
                if (err1) { err1.textContent = 'Please enter Employee / User Name.'; err1.style.display = 'block'; }
                return;
            }
            if (!role) {
                if (err1) { err1.textContent = 'Please select a Role.'; err1.style.display = 'block'; }
                return;
            }
            if (!status) {
                if (err1) { err1.textContent = 'Please select Account Status.'; err1.style.display = 'block'; }
                return;
            }
            if (!dept) {
                if (err1) { err1.textContent = 'Please select a Department.'; err1.style.display = 'block'; }
                return;
            }
            if (state.users.some(u => (u.userId || u.empId || '').toLowerCase() === userId.toLowerCase())) {
                if (err1) { err1.textContent = `User ID '${userId}' already exists. Please choose a different ID.`; err1.style.display = 'block'; }
                return;
            }

            if (err1) err1.style.display = 'none';
            setWizardStep(2);
        };
    }

    const btnBack = document.getElementById('btn-wizard-back');
    if (btnBack) {
        btnBack.onclick = () => {
            setWizardStep(1);
        };
    }

    // Attach Status Toggle Listeners (Activate / Deactivate)
    tbody.querySelectorAll('.btn-toggle-status').forEach(btn => {
        btn.onclick = async () => {
            const userId = btn.getAttribute('data-id');
            const targetStatus = btn.getAttribute('data-status');

            const sessionStr = sessionStorage.getItem('mpdms_auth_session');
            const session = sessionStr ? JSON.parse(sessionStr) : null;
            const token = session ? session.token : '';

            try {
                if (token) {
                    const res = await fetch('/api/users/status', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ userId, status: targetStatus })
                    });
                    const data = await res.json();
                    if (!data.success) {
                        showToast(data.message || 'Failed to update user status.', 'error');
                        return;
                    }
                }
            } catch (err) {}

            const user = state.users.find(u => (u.userId || u.empId) === userId);
            if (user) {
                user.accountStatus = targetStatus;
                user.active = (targetStatus === 'Active');
                state.save();
            }

            renderUsers();
            showToast(`Account status for user '${userId}' updated to ${targetStatus}.`);
        };
    });

    // Attach Reset Password Listeners (Administrator)
    tbody.querySelectorAll('.btn-reset-password').forEach(btn => {
        btn.onclick = () => {
            const userId = btn.getAttribute('data-id');
            const userName = btn.getAttribute('data-name');

            document.getElementById('reset-pass-user-id').value = userId;
            document.getElementById('reset-pass-user-display').value = `${userName} (${userId})`;
            document.getElementById('reset-pass-new').value = '';
            document.getElementById('reset-pass-confirm').value = '';
            openModal('modal-reset-password');
        };
    });
}

document.getElementById('form-user').onsubmit = async (e) => {
    e.preventDefault();

    const userId = document.getElementById('user-emp-id').value.trim();
    const fullName = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password') ? document.getElementById('user-password').value : '';
    const confirmPassword = document.getElementById('user-confirm-password') ? document.getElementById('user-confirm-password').value : '';
    const role = document.getElementById('user-role') ? document.getElementById('user-role').value : 'Employee';
    const status = document.getElementById('user-status') ? document.getElementById('user-status').value : 'Active';
    const dept = document.getElementById('user-dept') ? document.getElementById('user-dept').value : 'General';
    const err2 = document.getElementById('step2-error-msg');

    const privileges = {
        masters: {
            user_management: Array.from(document.querySelectorAll('input[name="priv-masters-user_management"]:checked')).map(cb => cb.value)
        },
        execution: {
            ebmr: Array.from(document.querySelectorAll('input[name="priv-execution-ebmr"]:checked')).map(cb => cb.value),
            elogbook: Array.from(document.querySelectorAll('input[name="priv-execution-elogbook"]:checked')).map(cb => cb.value),
            reports: Array.from(document.querySelectorAll('input[name="priv-execution-reports"]:checked')).map(cb => cb.value)
        }
    };

    if (!userId || !fullName) {
        showToast('User ID and Full Name are required.', 'error');
        return;
    }

    if (!password) {
        if (err2) { err2.textContent = 'Initial Password is required.'; err2.style.display = 'block'; }
        return;
    }

    if (password !== confirmPassword) {
        if (err2) { err2.textContent = 'Passwords do not match. Please re-enter.'; err2.style.display = 'block'; }
        return;
    }

    if (err2) err2.style.display = 'none';

    if (state.users.some(u => (u.userId || u.empId || '').toLowerCase() === userId.toLowerCase())) {
        showToast(`User ID '${userId}' already exists.`, 'error');
        return;
    }

    // Call backend endpoint to persist user securely with PBKDF2 hashed password
    const sessionStr = sessionStorage.getItem('mpdms_auth_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    const token = session ? session.token : '';

    const payload = {
        userId,
        fullName,
        email,
        password,
        role,
        status,
        department: dept,
        privileges
    };

    try {
        if (token) {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) {
                if (err2) { err2.textContent = data.message || 'Failed to create user.'; err2.style.display = 'block'; }
                return;
            }
        }
    } catch (err) {}

    // Add to local state user registry
    const newUser = {
        companyId: 'SYSTEM',
        userId: userId,
        empId: userId,
        name: fullName,
        fullName: fullName,
        email: email,
        role: role,
        designation: role,
        userType: role === 'Administrator' ? 'Master User' : 'Production User',
        accountStatus: status,
        active: status === 'Active',
        privileges: privileges,
        dept: dept
    };

    state.users.push(newUser);
    state.save();
    closeModal('modal-user');
    renderUsers();
    
    // Display safe success message without exposing password
    showToast(`User created successfully. User ID: ${userId} | Role: ${role} | Status: ${status}`);
};

// ==========================================================================
// 2. USER GROUP MASTER (Roles & Permissions)
// ==========================================================================
let selectedRoleName = null;

function renderUserGroups() {
    const listContainer = document.getElementById('role-selector-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--color-text-muted);">Roles have been replaced by granular User Type permissions. Configure permissions per user directly in the User Master.</div>';
    
    const roles = [];
    
    roles.forEach(role => {
        const item = document.createElement('div');
        item.className = `role-item ${role === selectedRoleName ? 'active' : ''}`;
        item.innerHTML = `<span>${role}</span><i class="fa-solid fa-chevron-right"></i>`;
        item.onclick = () => {
            selectedRoleName = role;
            renderUserGroups();
            renderPermissionsContainer(role);
        };
        listContainer.appendChild(item);
    });

    if (!selectedRoleName) {
        selectedRoleName = roles[0];
        renderPermissionsContainer(selectedRoleName);
        listContainer.children[0]?.classList.add('active');
    }
}

function renderPermissionsContainer(role) {
    const title = document.getElementById('selected-role-title');
    const container = document.getElementById('permissions-container');
    const saveBtn = document.getElementById('btn-save-permissions');
    
    if (!title || !container) return;
    
    title.textContent = `Configure Permissions for ${role}`;
    container.innerHTML = '';
    
    saveBtn.removeAttribute('disabled');
    
    const allPermissions = ['View', 'Create', 'Edit', 'Submit', 'Review', 'Approve', 'Reject'];
    const activePerms = state.roles[role] || [];
    
    allPermissions.forEach(perm => {
        const card = document.createElement('label');
        card.className = 'permission-checkbox-card';
        card.innerHTML = `
            <input type="checkbox" name="permissions" value="${perm}" ${activePerms.includes(perm) ? 'checked' : ''}>
            <span>${perm}</span>
        `;
        container.appendChild(card);
    });
}

document.getElementById('role-permissions-form').onsubmit = (e) => {
    e.preventDefault();
    if (!state.hasPermission('Approve')) {
        showToast('Only QA Approvers and Administrators can edit access control policies.', 'error');
        return;
    }
    
    const checkboxes = document.querySelectorAll('input[name="permissions"]:checked');
    const newPermissions = Array.from(checkboxes).map(cb => cb.value);
    
    promptElectronicSignature(`Modify Security Policy Permissions for User Group: ${selectedRoleName}`, (signee) => {
        const oldPerms = [...state.roles[selectedRoleName]];
        state.roles[selectedRoleName] = newPermissions;
        
        state.logAudit(signee.empId, 'UPDATE_SECURITY_POLICY', `Updated permissions for Role ${selectedRoleName}`, selectedRoleName, { before: oldPerms, after: newPermissions });
        state.save();
        showToast(`Security permissions updated for ${selectedRoleName}.`);
    });
};

// ==========================================================================
// 3. DEPARTMENTS MASTER
// ==========================================================================
function renderDepartments() {
    const tbody = document.querySelector('#table-departments tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const tenantDepts = state.getTenantDepartments();
    
    tenantDepts.forEach(dept => {
        const employeeCount = state.users.filter(u => u.dept === dept.name && u.companyId === state.activeCompanyId).length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${dept.name}</strong></td>
            <td>${employeeCount} employee(s)</td>
            <td><span class="badge ${dept.active ? 'badge-active' : 'badge-inactive'}">${dept.active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn ${dept.active ? 'btn-danger' : 'btn-success'} btn-sm btn-toggle-dept" data-name="${dept.name}">
                    <i class="fa-solid ${dept.active ? 'fa-ban' : 'fa-circle-check'}"></i> ${dept.active ? 'Deactivate' : 'Activate'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('btn-add-department').onclick = () => {
        openModal('modal-department');
    };
    
    tbody.querySelectorAll('.btn-toggle-dept').forEach(btn => {
        btn.onclick = () => {
            const name = btn.getAttribute('data-name');
            const dept = state.departments.find(d => d.name === name && d.companyId === state.activeCompanyId);
            if (dept) {
                const actionText = dept.active ? 'Deactivate Department' : 'Activate Department';
                promptElectronicSignature(`${actionText}: ${dept.name}`, (signee) => {
                    const oldState = { active: dept.active };
                    dept.active = !dept.active;
                    state.logAudit(signee.empId, 'UPDATE_DEPT', `${actionText}: ${dept.name}`, dept.name, { before: oldState, after: { active: dept.active } });
                    state.save();
                    renderDepartments();
                    showToast(`Department status updated.`);
                });
            }
        };
    });
}

document.getElementById('form-department').onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('dept-name').value.trim();
    const active = document.getElementById('dept-active').checked;
    
    const tenantDepts = state.getTenantDepartments();
    if (tenantDepts.some(d => d.name.toLowerCase() === name.toLowerCase())) {
        showToast('Department already exists.', 'error');
        return;
    }
    
    promptElectronicSignature(`Create Department: ${name}`, (signee) => {
        const newDept = { companyId: state.activeCompanyId, name, active };
        state.departments.push(newDept);
        state.logAudit(signee.empId, 'CREATE_DEPT', `Created department: ${name}`, name, { after: newDept });
        state.save();
        closeModal('modal-department');
        renderDepartments();
        showToast(`Department added.`);
    });
};

// ==========================================================================
// 4. AREA MASTER
// ==========================================================================
function renderAreas() {
    const tbody = document.querySelector('#table-areas tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const tenantAreas = state.getTenantAreas();
    
    tenantAreas.forEach(area => {
        let statusClass = 'status-active';
        if (area.status === 'Dirty') statusClass = 'status-dirty';
        if (area.status === 'Maintenance') statusClass = 'status-maintenance';
        if (area.status === 'Inactive') statusClass = 'badge-inactive';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${area.code}</strong></td>
            <td>${area.name}</td>
            <td>${area.dept}</td>
            <td><span class="badge ${area.cleanStatus === 'Clean' ? 'badge-active' : 'badge-warning'}"><i class="fa-solid ${area.cleanStatus === 'Clean' ? 'fa-broom' : 'fa-spray-can-sparkles'}"></i> ${area.cleanStatus}</span></td>
            <td><span class="badge ${statusClass}">${area.status}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm btn-clean-area" data-code="${area.code}" ${area.cleanStatus === 'Clean' ? 'disabled' : ''}>
                    <i class="fa-solid fa-soap"></i> Clean & Clear
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('btn-add-area').onclick = () => {
        populateDropdown('area-dept', state.getTenantDepartments().filter(d => d.active).map(d => d.name));
        openModal('modal-area');
    };
    
    tbody.querySelectorAll('.btn-clean-area').forEach(btn => {
        btn.onclick = () => {
            const code = btn.getAttribute('data-code');
            const area = state.areas.find(a => a.code === code && a.companyId === state.activeCompanyId);
            if (area) {
                promptElectronicSignature(`Perform Area Clearance & Cleaning Sign-off: ${area.name} (${area.code})`, (signee) => {
                    const oldState = { cleanStatus: area.cleanStatus, status: area.status };
                    area.cleanStatus = 'Clean';
                    area.status = 'Active';
                    
                    state.logAudit(signee.empId, 'AREA_CLEARANCE', `Area Cleared & Cleaned: ${area.name} (${area.code})`, area.code, { before: oldState, after: { cleanStatus: 'Clean', status: 'Active' } });
                    
                    recordAreaActivityLog(area.code, 'Cleaning & Line Clearance Completed', 'N/A', signee.name, 'Clean');
                    
                    state.save();
                    renderAreas();
                    showToast(`Area clearance recorded.`);
                });
            }
        };
    });
}

export function recordAreaActivityLog(areaCode, activity, batchId, signedByName, status) {
    const area = state.areas.find(a => a.code === areaCode && a.companyId === state.activeCompanyId);
    if (area) {
        area.cleanStatus = status;
    }
    state.areaLogbook.unshift({
        companyId: state.activeCompanyId,
        timestamp: new Date().toISOString(),
        areaCode,
        areaName: area ? area.name : 'Unknown',
        activity,
        batchId,
        signedBy: signedByName,
        status
    });
    state.save();
}

document.getElementById('form-area').onsubmit = (e) => {
    e.preventDefault();
    const code = document.getElementById('area-code').value.trim().toUpperCase();
    const name = document.getElementById('area-name').value.trim();
    const dept = document.getElementById('area-dept').value;
    const status = document.getElementById('area-status').value;
    
    const tenantAreas = state.getTenantAreas();
    if (tenantAreas.some(a => a.code.toLowerCase() === code.toLowerCase())) {
        showToast('Area code already exists.', 'error');
        return;
    }
    
    promptElectronicSignature(`Configure Manufacturing Area: ${name} (${code})`, (signee) => {
        const newArea = { companyId: state.activeCompanyId, code, name, dept, status, cleanStatus: 'Clean' };
        state.areas.push(newArea);
        state.logAudit(signee.empId, 'CREATE_AREA', `Configured manufacturing area: ${name} (${code})`, code, { after: newArea });
        
        recordAreaActivityLog(code, 'Initial Area Registration & Commissioning', 'N/A', signee.name, 'Clean');
        
        state.save();
        closeModal('modal-area');
        renderAreas();
        showToast(`Area configured successfully.`);
    });
};

// ==========================================================================
// 5. EQUIPMENT MASTER
// ==========================================================================
function renderEquipment() {
    const tbody = document.querySelector('#table-equipments tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const today = new Date();
    const tenantEquipment = state.getTenantEquipment();
    
    tenantEquipment.forEach(eq => {
        const calDate = new Date(eq.calibrationDate);
        const isPastDue = calDate < today;
        
        let statusClass = 'status-active';
        if (eq.status === 'In Use') statusClass = 'badge-active';
        if (eq.status === 'Dirty') statusClass = 'status-dirty';
        if (eq.status === 'Maintenance') statusClass = 'status-maintenance';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${eq.id}</strong></td>
            <td>${eq.name}</td>
            <td>${eq.area}</td>
            <td>${eq.make} / ${eq.model}</td>
            <td><span class="${isPastDue ? 'text-critical font-bold' : ''}">${eq.calibrationDate} ${isPastDue ? '<i class="fa-solid fa-circle-exclamation text-critical" title="Calibration Due!"></i>' : ''}</span></td>
            <td><span class="badge ${statusClass}">${eq.status}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm btn-calibrate-equip" data-id="${eq.id}">
                    <i class="fa-solid fa-screwdriver-wrench"></i> Calibrate
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('btn-add-equipment').onclick = () => {
        populateDropdown('equip-area', state.getTenantAreas().map(a => a.code));
        openModal('modal-equipment');
    };
    
    tbody.querySelectorAll('.btn-calibrate-equip').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-id');
            const eq = state.equipment.find(e => e.id === id && e.companyId === state.activeCompanyId);
            if (eq) {
                const activeUser = state.getActiveUser();
                if (activeUser.role !== 'Engineering User' && activeUser.role !== 'Admin') {
                    showToast('Only Engineering Personnel or Admin can perform asset calibrations.', 'error');
                    return;
                }
                
                promptElectronicSignature(`Perform Equipment Calibration Sign-off: ${eq.name} (${eq.id})`, (signee) => {
                    const oldDate = eq.calibrationDate;
                    const oldStatus = eq.status;
                    
                    const nextCal = new Date();
                    nextCal.setMonth(nextCal.getMonth() + 6);
                    eq.calibrationDate = nextCal.toISOString().split('T')[0];
                    eq.status = 'Active'; 
                    
                    state.logAudit(signee.empId, 'EQUIPMENT_CALIBRATION', `Asset calibrated & validated: ${eq.name} (${eq.id})`, eq.id, { before: { calibrationDate: oldDate, status: oldStatus }, after: { calibrationDate: eq.calibrationDate, status: eq.status } });
                    
                    recordEquipmentActivityLog(eq.id, 'Asset Calibrated & Certified', 'N/A', signee.name, 'Active');
                    
                    state.save();
                    renderEquipment();
                    showToast(`Equipment ${eq.id} calibration due date extended.`);
                });
            }
        };
    });
}

export function recordEquipmentActivityLog(equipId, activity, batchId, signedByName, status) {
    const eq = state.equipment.find(e => e.id === equipId && e.companyId === state.activeCompanyId);
    if (eq) {
        eq.status = status;
    }
    state.equipmentLogbook.unshift({
        companyId: state.activeCompanyId,
        timestamp: new Date().toISOString(),
        equipId,
        equipName: eq ? eq.name : 'Unknown',
        activity,
        batchId,
        signedBy: signedByName,
        status
    });
    state.save();
}

document.getElementById('form-equipment').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('equip-id').value.trim().toUpperCase();
    const name = document.getElementById('equip-name').value.trim();
    const area = document.getElementById('equip-area').value;
    const make = document.getElementById('equip-make').value.trim();
    const model = document.getElementById('equip-model').value.trim();
    const calibrationDate = document.getElementById('equip-calibration').value;
    const status = document.getElementById('equip-status').value;
    
    const tenantEquipment = state.getTenantEquipment();
    if (tenantEquipment.some(e => e.id.toLowerCase() === id.toLowerCase())) {
        showToast('Equipment ID already registered.', 'error');
        return;
    }
    
    promptElectronicSignature(`Register Manufacturing Asset: ${name} (${id})`, (signee) => {
        const newEq = { companyId: state.activeCompanyId, id, name, area, make, model, calibrationDate, status };
        state.equipment.push(newEq);
        state.logAudit(signee.empId, 'CREATE_ASSET', `Registered manufacturing equipment: ${name} (${id})`, id, { after: newEq });
        
        recordEquipmentActivityLog(id, 'Asset Registered & Commissioned', 'N/A', signee.name, status);
        
        state.save();
        closeModal('modal-equipment');
        renderEquipment();
        showToast(`Equipment registered.`);
    });
};

// ==========================================================================
// 6. PRODUCT MASTER
// ==========================================================================
function renderProducts() {
    const tbody = document.querySelector('#table-products tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const tenantProducts = state.getTenantProducts();
    
    tenantProducts.forEach(p => {
        const templatesCount = state.bmrTemplates.filter(t => t.productCode === p.code && t.companyId === state.activeCompanyId).length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.code}</strong></td>
            <td>${p.name}</td>
            <td>${p.batchSize}</td>
            <td>${templatesCount} template(s) configured</td>
            <td><span class="text-muted">No configuration actions</span></td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('btn-add-product').onclick = () => {
        openModal('modal-product');
    };
}

document.getElementById('form-product').onsubmit = (e) => {
    e.preventDefault();
    const code = document.getElementById('prod-code').value.trim().toUpperCase();
    const name = document.getElementById('prod-name').value.trim();
    const batchSize = document.getElementById('prod-size').value.trim();
    
    const tenantProducts = state.getTenantProducts();
    if (tenantProducts.some(p => p.code.toLowerCase() === code.toLowerCase())) {
        showToast('Product code already exists.', 'error');
        return;
    }
    
    promptElectronicSignature(`Create Product Formulation: ${name} (${code})`, (signee) => {
        const newProduct = { companyId: state.activeCompanyId, code, name, batchSize };
        state.products.push(newProduct);
        state.logAudit(signee.empId, 'CREATE_PRODUCT', `Registered product: ${name} (${code})`, code, { after: newProduct });
        state.save();
        closeModal('modal-product');
        renderProducts();
        showToast(`Product formulation registered.`);
    });
};

// ==========================================================================
// 7A. ANNEXURE MASTER
// ==========================================================================
let annexureRowsList = [];

function renderAnnexures() {
    const tbody = document.querySelector('#table-annexures tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const tenantAnnexures = state.getTenantAnnexures();
    
    tenantAnnexures.forEach(anx => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${anx.id}</strong></td>
            <td>${anx.name}</td>
            <td><small><code>${anx.columns.join(' | ')}</code></small></td>
            <td>${anx.rows.length} checklists</td>
            <td>
                <button class="btn btn-secondary btn-sm btn-delete-annexure" data-id="${anx.id}">
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
            </td>
        `;
        
        tr.querySelector('.btn-delete-annexure').onclick = () => {
            promptElectronicSignature(`Delete Annexure Master Template: ${anx.id}`, (signee) => {
                const idx = state.annexures.findIndex(a => a.id === anx.id && a.companyId === state.activeCompanyId);
                if (idx !== -1) {
                    state.annexures.splice(idx, 1);
                    state.logAudit(signee.empId, 'DELETE_ANNEXURE', `Deleted annexure template ${anx.name}`, anx.id);
                    state.save();
                    renderAnnexures();
                    showToast('Annexure template deleted.');
                }
            });
        };
        tbody.appendChild(tr);
    });

    // Add checksheet row builder
    document.getElementById('btn-add-annexure').onclick = () => {
        annexureRowsList = ['Check parameter row 1'];
        renderAnnexureRowInputs();
        openModal('modal-annexure');
    };
    
    document.getElementById('btn-add-annexure-row-item').onclick = () => {
        annexureRowsList.push('');
        renderAnnexureRowInputs();
    };
}

function renderAnnexureRowInputs() {
    const container = document.getElementById('annexure-rows-builder-container');
    if (!container) return;
    container.innerHTML = '';
    
    annexureRowsList.forEach((row, idx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        div.innerHTML = `
            <input type="text" class="form-input annexure-row-text-val" style="padding: 6px 10px;" value="${row}" placeholder="Checklist item text..." required>
            <button type="button" class="btn btn-danger btn-sm btn-remove-anx-row" style="padding: 6px 10px;"><i class="fa-solid fa-trash-can"></i></button>
        `;
        
        div.querySelector('.annexure-row-text-val').onchange = (e) => {
            annexureRowsList[idx] = e.target.value;
        };
        
        div.querySelector('.btn-remove-anx-row').onclick = () => {
            annexureRowsList.splice(idx, 1);
            renderAnnexureRowInputs();
        };
        
        container.appendChild(div);
    });
}

document.getElementById('form-annexure').onsubmit = (e) => {
    e.preventDefault();
    if (!state.hasPermission('Create')) {
        showToast('Insufficient permissions to define quality templates.', 'error');
        return;
    }
    
    const id = document.getElementById('annexure-uid').value.trim().toUpperCase();
    const name = document.getElementById('annexure-name').value.trim();
    const colsRaw = document.getElementById('annexure-cols').value;
    const columns = colsRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    if (state.annexures.some(a => a.id === id && a.companyId === state.activeCompanyId)) {
        showToast('Annexure ID already exists.', 'error');
        return;
    }
    
    if (annexureRowsList.length === 0) {
        showToast('At least one checklist row is required.', 'error');
        return;
    }
    
    promptElectronicSignature(`Publish Annexure Template: ${name} (${id})`, (signee) => {
        const newAnnexure = {
            companyId: state.activeCompanyId,
            id,
            name,
            columns,
            rows: annexureRowsList.filter(r => r.trim().length > 0)
        };
        state.annexures.push(newAnnexure);
        state.logAudit(signee.empId, 'CREATE_ANNEXURE', `Created checksheet template: ${name} (${id})`, id, { after: newAnnexure });
        state.save();
        closeModal('modal-annexure');
        renderAnnexures();
        showToast('Annexure checksheet template published.');
    });
};

// ==========================================================================
// 7B. WORKFLOW ROUTE CONFIG
// ==========================================================================
function renderWorkflows() {
    const tbody = document.querySelector('#table-workflows tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const tenantWorkflows = state.getTenantWorkflows();
    
    tenantWorkflows.forEach(wf => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${wf.name}</strong></td>
            <td><small>${wf.steps.map(s => `<span class="user-role-badge" style="margin-right: 4px;">${s}</span>`).join(' <i class="fa-solid fa-angle-right" style="color: var(--color-text-muted); font-size: 10px;"></i> ')}</small></td>
            <td>${wf.steps.length} sign-offs</td>
            <td>
                <button class="btn btn-secondary btn-sm btn-delete-wf" data-id="${wf.id}" ${wf.id === 'WF-DEFAULT' ? 'disabled' : ''}>
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
            </td>
        `;
        
        tr.querySelector('.btn-delete-wf').onclick = () => {
            promptElectronicSignature(`Delete Workflow Route: ${wf.name}`, (signee) => {
                const idx = state.workflows.findIndex(w => w.id === wf.id && w.companyId === state.activeCompanyId);
                if (idx !== -1) {
                    state.workflows.splice(idx, 1);
                    state.logAudit(signee.empId, 'DELETE_WORKFLOW', `Deleted custom workflow route ${wf.name}`, wf.id);
                    state.save();
                    renderWorkflows();
                    showToast('Workflow route deleted.');
                }
            });
        };
        
        tbody.appendChild(tr);
    });

    document.getElementById('btn-add-workflow').onclick = () => {
        // Draw checkboxes for roles
        const container = document.getElementById('workflow-steps-list-checkboxes');
        container.innerHTML = '';
        
        // Show role sequence choices
        const roles = ['Production Operator', 'Production Supervisor', 'QA Reviewer', 'QA Approver'];
        roles.forEach(role => {
            const label = document.createElement('label');
            label.className = 'permission-checkbox-card';
            label.innerHTML = `
                <input type="checkbox" name="workflow-roles-select" value="${role}" checked>
                <span>${role}</span>
            `;
            container.appendChild(label);
        });
        
        openModal('modal-workflow');
    };
}

document.getElementById('form-workflow').onsubmit = (e) => {
    e.preventDefault();
    if (!state.hasPermission('Approve')) {
        showToast('Only QA and Admins can configure release workflows.', 'error');
        return;
    }
    
    const name = document.getElementById('workflow-name-input').value.trim();
    const checked = document.querySelectorAll('input[name="workflow-roles-select"]:checked');
    const steps = Array.from(checked).map(cb => cb.value);
    
    if (steps.length === 0) {
        showToast('At least one approval role step is required.', 'error');
        return;
    }
    
    promptElectronicSignature(`Configure Custom Approval Workflow: ${name}`, (signee) => {
        const id = 'WF-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        const newWf = {
            companyId: state.activeCompanyId,
            id,
            name,
            steps
        };
        state.workflows.push(newWf);
        state.logAudit(signee.empId, 'CREATE_WORKFLOW', `Configured custom workflow route: ${name}`, id, { after: newWf });
        state.save();
        closeModal('modal-workflow');
        renderWorkflows();
        showToast('Custom workflow route saved successfully.');
    });
};

// ==========================================================================
// 8. BMR TEMPLATE MASTER
// ==========================================================================
let templateStepsList = [];

function renderBMRTemplates() {
    const tbody = document.querySelector('#table-bmr-templates tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const tenantTemplates = state.getTenantBmrTemplates();
    
    tenantTemplates.forEach(tpl => {
        const product = state.products.find(p => p.code === tpl.productCode && p.companyId === state.activeCompanyId) || { name: 'Unknown' };
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${tpl.name}</strong></td>
            <td>${product.name}</td>
            <td><code>${tpl.code}</code></td>
            <td>${tpl.steps.length} step(s)</td>
            <td><small><code>${tpl.annexureId || 'None'}</code></small></td>
            <td><small>${tpl.workflowId || 'WF-DEFAULT'}</small></td>
            <td><span class="badge ${tpl.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${tpl.status}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm btn-delete-tpl" data-code="${tpl.code}">
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('btn-create-template').onclick = () => {
        templateStepsList = [];
        
        populateDropdown('bmr-product', state.getTenantProducts().map(p => `${p.code} | ${p.name}`));
        
        // Populate Annexures
        const annexSelect = document.getElementById('bmr-annexure-attach');
        annexSelect.innerHTML = '<option value="">-- No Annexure Attached --</option>';
        state.getTenantAnnexures().forEach(anx => {
            const opt = document.createElement('option');
            opt.value = anx.id;
            opt.textContent = `${anx.name} (${anx.id})`;
            annexSelect.appendChild(opt);
        });
        
        // Populate Workflows
        const wfSelect = document.getElementById('bmr-workflow-attach');
        wfSelect.innerHTML = '';
        state.getTenantWorkflows().forEach(wf => {
            const opt = document.createElement('option');
            opt.value = wf.id;
            opt.textContent = `${wf.name}`;
            wfSelect.appendChild(opt);
        });
        
        renderTemplateBuilderSteps();
        openModal('modal-bmr-template');
    };
    
    document.getElementById('btn-add-template-step').onclick = () => {
        const newStep = {
            id: 'step-' + (templateStepsList.length + 1),
            title: '',
            description: '',
            requiredRole: 'Production Operator',
            areaCode: state.getTenantAreas()[0]?.code || '',
            equipId: state.getTenantEquipment()[0]?.id || '',
            fields: []
        };
        templateStepsList.push(newStep);
        renderTemplateBuilderSteps();
    };

    tbody.querySelectorAll('.btn-delete-tpl').forEach(btn => {
        btn.onclick = () => {
            const code = btn.getAttribute('data-code');
            promptElectronicSignature(`Delete BMR Master Template: ${code}`, (signee) => {
                const index = state.bmrTemplates.findIndex(t => t.code === code && t.companyId === state.activeCompanyId);
                if (index !== -1) {
                    const deleted = state.bmrTemplates.splice(index, 1)[0];
                    state.logAudit(signee.empId, 'DELETE_TEMPLATE', `Deleted BMR template: ${deleted.name} (${code})`, code, { before: deleted });
                    state.save();
                    renderBMRTemplates();
                    showToast(`BMR template deleted.`);
                }
            });
        };
    });
}

function renderTemplateBuilderSteps() {
    const container = document.getElementById('template-steps-container');
    if (!container) return;
    container.innerHTML = '';
    
    const tenantAreas = state.getTenantAreas();
    const tenantEquipment = state.getTenantEquipment();
    
    if (templateStepsList.length === 0) {
        container.innerHTML = '<div style="color: var(--color-text-muted); font-size: 13px; text-align: center; padding: 20px;">No steps configured. Click Add Step.</div>';
        return;
    }
    
    templateStepsList.forEach((step, index) => {
        const div = document.createElement('div');
        div.className = 'step-builder-item';
        
        const areaOptions = tenantAreas.map(a => `<option value="${a.code}" ${step.areaCode === a.code ? 'selected' : ''}>${a.name} (${a.code})</option>`).join('');
        const equipOptions = tenantEquipment.map(e => `<option value="${e.id}" ${step.equipId === e.id ? 'selected' : ''}>${e.name} (${e.id})</option>`).join('');
        const rolesOptions = Object.keys(state.roles).filter(r => r !== 'Super Admin').map(r => `<option value="${r}" ${step.requiredRole === r ? 'selected' : ''}>${r}</option>`).join('');

        div.innerHTML = `
            <button type="button" class="btn-remove-step" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button>
            <div style="font-weight: 700; color: var(--color-teal); font-size: 14px; margin-bottom: 12px;">Step #${index + 1}</div>
            <div class="grid-two-cols">
                <div class="form-group">
                    <label>Step Title</label>
                    <input type="text" class="form-input step-title-input" data-index="${index}" value="${step.title}" placeholder="e.g. Mixing Process" required>
                </div>
                <div class="form-group">
                    <label>Assigned Execution Role</label>
                    <select class="form-input step-role-input" data-index="${index}">${rolesOptions}</select>
                </div>
            </div>
            <div class="form-group">
                <label>Step Instructions / Description</label>
                <textarea class="form-input step-desc-input" data-index="${index}" rows="2" placeholder="Instructions..." required>${step.description}</textarea>
            </div>
            <div class="grid-two-cols border-top pt-15 mt-15">
                <div class="form-group">
                    <label>Manufacturing Area</label>
                    <select class="form-input step-area-input" data-index="${index}">${areaOptions}</select>
                </div>
                <div class="form-group">
                    <label>Required Equipment</label>
                    <select class="form-input step-equip-input" data-index="${index}">${equipOptions}</select>
                </div>
            </div>
            <div class="step-fields-builder mt-15">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary);">PROCESS PARAMETERS</span>
                    <button type="button" class="btn btn-secondary btn-sm btn-add-field" data-index="${index}" style="padding: 2px 8px; font-size: 10px;">
                        <i class="fa-solid fa-plus"></i> Add Parameter
                    </button>
                </div>
                <div class="fields-list" id="step-fields-list-${index}"></div>
            </div>
        `;
        
        container.appendChild(div);
        renderStepFieldsBuilder(index);
        
        div.querySelector('.step-title-input').onchange = (e) => { step.title = e.target.value; };
        div.querySelector('.step-role-input').onchange = (e) => { step.requiredRole = e.target.value; };
        div.querySelector('.step-desc-input').onchange = (e) => { step.description = e.target.value; };
        div.querySelector('.step-area-input').onchange = (e) => { step.areaCode = e.target.value; };
        div.querySelector('.step-equip-input').onchange = (e) => { step.equipId = e.target.value; };
        
        div.querySelector('.btn-remove-step').onclick = () => {
            templateStepsList.splice(index, 1);
            renderTemplateBuilderSteps();
        };
        
        div.querySelector('.btn-add-field').onclick = () => {
            step.fields.push({ label: '', type: 'number', min: '', max: '', unit: '', required: true });
            renderTemplateBuilderSteps();
        };
    });
}

function renderStepFieldsBuilder(stepIndex) {
    const list = document.getElementById(`step-fields-list-${stepIndex}`);
    if (!list) return;
    
    const step = templateStepsList[stepIndex];
    list.innerHTML = '';
    
    if (step.fields.length === 0) {
        list.innerHTML = '<div style="color: var(--color-text-muted); font-size: 11px; font-style: italic; padding: 6px 0;">No input parameters configured. Step is sign-off only.</div>';
        return;
    }
    
    step.fields.forEach((field, fIdx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        div.style.alignItems = 'center';
        div.style.marginBottom = '6px';
        
        div.innerHTML = `
            <input type="text" class="form-input f-label" style="flex: 2; padding: 6px 8px; font-size: 12px;" value="${field.label}" placeholder="Parameter Name" required>
            <select class="form-input f-type" style="flex: 1; padding: 6px 8px; font-size: 12px;">
                <option value="number" ${field.type === 'number' ? 'selected' : ''}>Numeric</option>
                <option value="text" ${field.type === 'text' ? 'selected' : ''}>Text</option>
            </select>
            <input type="number" class="form-input f-min" style="flex: 0.8; padding: 6px 8px; font-size: 12px; display: ${field.type === 'number' ? 'block' : 'none'}" value="${field.min}" placeholder="Min">
            <input type="number" class="form-input f-max" style="flex: 0.8; padding: 6px 8px; font-size: 12px; display: ${field.type === 'number' ? 'block' : 'none'}" value="${field.max}" placeholder="Max">
            <input type="text" class="form-input f-unit" style="flex: 0.8; padding: 6px 8px; font-size: 12px;" value="${field.unit || ''}" placeholder="Unit">
            <button type="button" class="btn btn-danger btn-sm btn-remove-field" style="padding: 6px 8px; font-size: 12px;"><i class="fa-solid fa-trash-can"></i></button>
        `;
        
        list.appendChild(div);
        
        const labelIn = div.querySelector('.f-label');
        const typeSelect = div.querySelector('.f-type');
        const minIn = div.querySelector('.f-min');
        const maxIn = div.querySelector('.f-max');
        const unitIn = div.querySelector('.f-unit');
        
        labelIn.onchange = (e) => { field.label = e.target.value; };
        unitIn.onchange = (e) => { field.unit = e.target.value; };
        
        typeSelect.onchange = (e) => {
            field.type = e.target.value;
            if (field.type === 'text') {
                minIn.style.display = 'none';
                maxIn.style.display = 'none';
                field.min = '';
                field.max = '';
            } else {
                minIn.style.display = 'block';
                maxIn.style.display = 'block';
            }
        };
        
        minIn.onchange = (e) => { field.min = e.target.value !== '' ? parseFloat(e.target.value) : ''; };
        maxIn.onchange = (e) => { field.max = e.target.value !== '' ? parseFloat(e.target.value) : ''; };
        
        div.querySelector('.btn-remove-field').onclick = () => {
            step.fields.splice(fIdx, 1);
            renderTemplateBuilderSteps();
        };
    });
}

document.getElementById('form-bmr-template').onsubmit = (e) => {
    e.preventDefault();
    if (!state.hasPermission('Create')) {
        showToast('Insufficient permissions to publish master templates.', 'error');
        return;
    }
    
    if (templateStepsList.length === 0) {
        showToast('At least one manufacturing step is required.', 'error');
        return;
    }
    
    const code = document.getElementById('bmr-code').value.trim().toUpperCase();
    const productFull = document.getElementById('bmr-product').value;
    const productCode = productFull.split('|')[0].trim();
    const name = document.getElementById('bmr-name').value.trim();
    const annexureId = document.getElementById('bmr-annexure-attach').value;
    const workflowId = document.getElementById('bmr-workflow-attach').value;
    
    if (state.bmrTemplates.some(t => t.code.toLowerCase() === code.toLowerCase() && t.companyId === state.activeCompanyId)) {
        showToast('BMR Template Code already exists.', 'error');
        return;
    }
    
    promptElectronicSignature(`Publish Master Batch Manufacturing Record Template: ${name} (${code})`, (signee) => {
        const newTemplate = {
            companyId: state.activeCompanyId,
            code,
            name,
            productCode,
            status: 'Active',
            annexureId: annexureId || null,
            workflowId,
            steps: templateStepsList
        };
        
        state.bmrTemplates.push(newTemplate);
        state.logAudit(signee.empId, 'CREATE_BMR_TEMPLATE', `Published BMR Template: ${name} (${code})`, code, { after: newTemplate });
        state.save();
        closeModal('modal-bmr-template');
        renderBMRTemplates();
        showToast(`BMR template published.`);
    });
};

// ==========================================================================
// UTILITY HELPERS
// ==========================================================================
function populateDropdown(selectId, items, selectedValue = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        if (item === selectedValue) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
}

// ==========================================================================
// STEP 3D: PASSWORD MANAGEMENT EVENT LISTENERS
// ==========================================================================

// Administrator Reset Password Submit Handler
const formResetPass = document.getElementById('form-reset-password');
if (formResetPass) {
    formResetPass.onsubmit = async (e) => {
        e.preventDefault();
        const userId = document.getElementById('reset-pass-user-id').value;
        const newPassword = document.getElementById('reset-pass-new').value;
        const confirmPassword = document.getElementById('reset-pass-confirm').value;

        if (!newPassword) {
            showToast('Please enter a new password.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            return;
        }

        const sessionStr = sessionStorage.getItem('mpdms_auth_session');
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        const token = session ? session.token : '';

        try {
            const res = await fetch('/api/users/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId, newPassword, confirmPassword })
            });
            const data = await res.json();
            if (!data.success) {
                showToast(data.message || 'Failed to reset password.', 'error');
                return;
            }
            closeModal('modal-reset-password');
            showToast(`Password for user '${userId}' reset successfully.`);
        } catch (err) {
            showToast('Error resetting user password.', 'error');
        }
    };
}

// Employee Self-Service Change Password Button Listener & Handler
const btnHeaderChangePass = document.getElementById('btn-header-change-password');
if (btnHeaderChangePass) {
    btnHeaderChangePass.onclick = () => {
        document.getElementById('change-pass-current').value = '';
        document.getElementById('change-pass-new').value = '';
        document.getElementById('change-pass-confirm').value = '';
        openModal('modal-change-password');
    };
}

const formChangePass = document.getElementById('form-change-password');
if (formChangePass) {
    formChangePass.onsubmit = async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('change-pass-current').value;
        const newPassword = document.getElementById('change-pass-new').value;
        const confirmPassword = document.getElementById('change-pass-confirm').value;

        if (!currentPassword || !newPassword) {
            showToast('All password fields are required.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match.', 'error');
            return;
        }

        const sessionStr = sessionStorage.getItem('mpdms_auth_session');
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        const token = session ? session.token : '';

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
            });
            const data = await res.json();
            if (!data.success) {
                showToast(data.message || 'Failed to change password.', 'error');
                return;
            }
            closeModal('modal-change-password');
            showToast('Your password has been changed successfully.');
        } catch (err) {
            showToast('Error changing password.', 'error');
        }
    };
}
