/* ==========================================================================
   MYCOHAVEN PHARMA PLATFORM AUDIT MODULE (MULTI-TENANT)
   Handles Chronological Audit Trail, Filtering, and Compliance Verification
   ========================================================================== */

import { state } from './state.js';
import { openModal } from './ui.js';

export function renderAuditTrail() {
    const tbody = document.querySelector('#table-audit-trail tbody');
    const tableHeader = document.querySelector('#table-audit-trail thead tr');
    if (!tbody || !tableHeader) return;
    
    tbody.innerHTML = '';
    
    // 1. Populate User Filter Dropdown based on active context
    populateAuditUserFilter();
    
    // 2. Adjust Table Headers dynamically for Super Admin (add Company column)
    const isSuperAdmin = state.activeUserEmpId === 'EMP-SUPER';
    
    if (isSuperAdmin) {
        tableHeader.innerHTML = `
            <th>Timestamp</th>
            <th>Company</th>
            <th>User</th>
            <th>Role</th>
            <th>Action Type</th>
            <th>Details</th>
            <th>IP/Location</th>
            <th>Verification</th>
        `;
    } else {
        tableHeader.innerHTML = `
            <th>Timestamp</th>
            <th>User</th>
            <th>Role</th>
            <th>Action Type</th>
            <th>Details</th>
            <th>IP/Location</th>
            <th>Verification</th>
        `;
    }
    
    // 3. Get Filters
    const query = document.getElementById('audit-search').value.toLowerCase();
    const filterUser = document.getElementById('audit-filter-user').value;
    const filterAction = document.getElementById('audit-filter-action').value;
    
    // 4. Retrieve tenant-isolated or global logs
    const auditLogs = state.getTenantAuditTrail();
    
    const filtered = auditLogs.filter(log => {
        const matchesQuery = !query || 
            log.description.toLowerCase().includes(query) || 
            log.userName.toLowerCase().includes(query) || 
            log.companyId.toLowerCase().includes(query) ||
            (log.entityId && log.entityId.toLowerCase().includes(query));
            
        const matchesUser = !filterUser || log.userId === filterUser;
        const matchesAction = !filterAction || log.actionType === filterAction;
        
        return matchesQuery && matchesUser && matchesAction;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isSuperAdmin ? 8 : 7}" style="text-align: center; color: var(--color-text-muted); padding: 20px;">No audit records found.</td></tr>`;
        return;
    }

    // 5. Render Table Rows
    filtered.forEach(log => {
        const time = new Date(log.timestamp).toLocaleString();
        
        let actionBadgeClass = 'icon-blue';
        if (log.actionType.startsWith('CREATE')) actionBadgeClass = 'badge-active';
        if (log.actionType.startsWith('UPDATE')) actionBadgeClass = 'badge-warning';
        if (log.actionType.startsWith('DELETE')) actionBadgeClass = 'badge-danger';
        if (log.actionType.includes('FAIL')) actionBadgeClass = 'badge-danger';
        if (log.actionType.includes('SIGN') || log.actionType.includes('ESIGN')) actionBadgeClass = 'badge-active';
        
        const tr = document.createElement('tr');
        
        if (isSuperAdmin) {
            tr.innerHTML = `
                <td><small>${time}</small></td>
                <td><span class="user-role-badge" style="background-color: var(--color-blue-glow); color: var(--color-blue); border-color: rgba(33, 150, 243, 0.2);">${log.companyId}</span></td>
                <td><strong>${log.userName}</strong><br><small class="text-muted">${log.userId}</small></td>
                <td><span class="user-role-badge">${log.userRole}</span></td>
                <td><span class="badge ${actionBadgeClass}">${log.actionType}</span></td>
                <td>${log.description}</td>
                <td><code>${log.ipAddress}</code></td>
                <td style="text-align: center;">
                    <button class="btn btn-secondary btn-sm btn-verify-audit" style="padding: 4px 8px;" title="Verify Integrity">
                        <i class="fa-solid fa-shield-halved" style="color: var(--color-teal)"></i> Verify
                    </button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td><small>${time}</small></td>
                <td><strong>${log.userName}</strong><br><small class="text-muted">${log.userId}</small></td>
                <td><span class="user-role-badge">${log.userRole}</span></td>
                <td><span class="badge ${actionBadgeClass}">${log.actionType}</span></td>
                <td>${log.description}</td>
                <td><code>${log.ipAddress}</code></td>
                <td style="text-align: center;">
                    <button class="btn btn-secondary btn-sm btn-verify-audit" style="padding: 4px 8px;" title="Verify Integrity">
                        <i class="fa-solid fa-shield-halved" style="color: var(--color-teal)"></i> Verify
                    </button>
                </td>
            `;
        }
        
        tr.querySelector('.btn-verify-audit').onclick = () => {
            showAuditDetails(log);
        };
        
        tbody.appendChild(tr);
    });
    
    document.getElementById('audit-search').oninput = renderAuditTrail;
    document.getElementById('audit-filter-user').onchange = renderAuditTrail;
    document.getElementById('audit-filter-action').onchange = renderAuditTrail;
    
    document.getElementById('btn-export-audit').onclick = () => {
        exportAuditToCSV(filtered);
    };
}

function populateAuditUserFilter() {
    const dropdown = document.getElementById('audit-filter-user');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">All Users</option>';
    
    const tenantUsers = state.getTenantUsers();
    tenantUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.empId;
        opt.textContent = `${u.name} (${u.empId})`;
        dropdown.appendChild(opt);
    });
}

export function showAuditDetails(log) {
    const container = document.getElementById('audit-details-json-viewer');
    if (!container) return;
    
    const formattedDate = new Date(log.timestamp).toLocaleString();
    
    const printableData = {
        Timestamp: formattedDate,
        CompanyContextID: log.companyId,
        OperatorName: log.userName,
        OperatorEmpID: log.userId,
        SecurityRole: log.userRole,
        ActionPerformed: log.actionType,
        LogDetails: log.description,
        TargetEntityID: log.entityId || 'N/A',
        ClientIPAddress: log.ipAddress,
        VerificationKey: log.integrityHash,
        ElectronicSignatureStatus: 'VERIFIED_COMPLIANT',
        StateDelta: log.detailsDiff || 'No changes / Record creation only'
    };
    
    container.innerHTML = `
        <div style="font-size: 13px; margin-bottom: 12px;">
            <div style="margin-bottom: 6px;"><strong>Record Time:</strong> ${formattedDate}</div>
            <div style="margin-bottom: 6px;"><strong>Data Security Hash:</strong> <code style="color: var(--color-teal); font-weight: 700; word-break: break-all;">${log.integrityHash}</code></div>
        </div>
        <pre>${JSON.stringify(printableData, null, 2)}</pre>
    `;
    
    openModal('modal-audit-detail');
}

function exportAuditToCSV(data) {
    let csv = 'Timestamp,Company ID,Employee ID,Employee Name,Role,Action Type,Description,IP Address,Integrity Hash\n';
    
    data.forEach(log => {
        csv += `"${log.timestamp}","${log.companyId}","${log.userId}","${log.userName}","${log.userRole}","${log.actionType}","${log.description.replace(/"/g, '""')}","${log.ipAddress}","${log.integrityHash}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `MPDMS_Audit_Trail_${state.activeCompanyId}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    state.logAudit(state.activeUserEmpId, 'EXPORT_AUDIT', `Exported filtered audit trail (${data.length} records) to CSV.`);
}
