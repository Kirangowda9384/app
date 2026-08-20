/* ==========================================================================
   MYCOHAVEN PHARMA PLATFORM DASHBOARD MODULE (MULTI-TENANT)
   Renders KPI Summaries, SVG Charts, and Isolated Tenant Feeds
   ========================================================================== */

import { state } from './state.js';
import { showAuditDetails } from './audit.js';

export function renderDashboard() {
    const activeUser = state.getActiveUser();
    
    // Check if dynamic KPI elements exist in the DOM
    const kpiEl = document.getElementById('kpi-active-batches');
    if (!kpiEl) {
        // Using the new Step 2 two-domain selection layout; no dynamic rendering needed
        return;
    }

    const tenantBatches = state.getTenantBatches();
    const tenantEquipment = state.getTenantEquipment();
    const tenantAreas = state.getTenantAreas();
    const tenantLogs = state.getTenantAuditTrail();

    // 1. Calculate Statistics
    const activeBatchesCount = tenantBatches.filter(b => b.status === 'In Progress' || b.status.startsWith('Pending')).length;
    
    const pendingApprovalsCount = tenantBatches.filter(b => 
        b.status.startsWith('Pending') && (b.status.endsWith('Review') || b.status.endsWith('Approval'))
    ).length;
    
    const activeEquipmentCount = tenantEquipment.filter(e => e.status === 'Active' || e.status === 'In Use').length;
    
    // Calibration warnings
    const today = new Date();
    const calibrationAlertsCount = tenantEquipment.filter(e => {
        const calDate = new Date(e.calibrationDate);
        return calDate < today;
    }).length;
    
    // 2. Render KPIs to DOM
    document.getElementById('kpi-active-batches').textContent = activeBatchesCount;
    document.getElementById('kpi-pending-approvals').textContent = pendingApprovalsCount;
    document.getElementById('kpi-active-equipment').textContent = activeEquipmentCount;
    document.getElementById('kpi-calibration-alerts').textContent = calibrationAlertsCount;
    
    const calIcon = document.getElementById('kpi-calibration-icon');
    if (calibrationAlertsCount > 0 && calIcon) {
        calIcon.classList.add('pulse-critical');
    } else if (calIcon) {
        calIcon.classList.remove('pulse-critical');
    }
    
    // 3. Render SVG Charts
    renderBatchStatusChart(tenantBatches);
    renderAreaUtilizationChart(tenantAreas, tenantEquipment);
    
    // 4. Render Recent Audit Logs
    renderRecentAuditLogs(tenantLogs);
    
    // 5. Render Active Areas List
    renderDashboardAreasList(tenantAreas);
    
    // 6. Dynamic Visibility based on Module Access
    const modules = activeUser.moduleAccess || [];
    
    const toggleDisplay = (id, show) => {
        const el = document.getElementById(id);
        if (el) {
            const card = el.closest('.kpi-card') || el.closest('.chart-card') || el.closest('.logs-card');
            if (card) card.style.display = show ? 'flex' : 'none';
        }
    };
    
    const showBMR = modules.includes('eBMR');
    const showLogbook = modules.includes('eLogbook');
    const showQMS = modules.includes('QMS');
    
    toggleDisplay('kpi-active-batches', showBMR);
    toggleDisplay('kpi-pending-approvals', showBMR);
    toggleDisplay('batch-chart-container', showBMR);
    
    toggleDisplay('kpi-active-equipment', showLogbook);
    toggleDisplay('kpi-calibration-alerts', showLogbook);
    toggleDisplay('area-chart-container', showLogbook);
    toggleDisplay('dashboard-areas-list', showLogbook);
    
    toggleDisplay('dashboard-audit-logs', showQMS);
}

// Donut Chart for Batch Status
function renderBatchStatusChart(batches) {
    const container = document.getElementById('batch-chart-container');
    if (!container) return;
    
    const statusCounts = {
        'In Progress': 0,
        'Review / Approval': 0,
        'Released / Closed': 0,
        'Draft': 0
    };
    
    batches.forEach(b => {
        if (b.status === 'In Progress') statusCounts['In Progress']++;
        else if (b.status.startsWith('Pending')) statusCounts['Review / Approval']++;
        else if (b.status === 'Approved' || b.status === 'Closed') statusCounts['Released / Closed']++;
        else if (b.status === 'Draft') statusCounts['Draft']++;
    });
    
    const total = batches.length;
    if (total === 0) {
        container.innerHTML = '<div class="no-data" style="font-size: 13px; color: var(--color-text-muted);">No Batches Configured</div>';
        return;
    }
    
    const categories = [
        { label: 'In Progress', value: statusCounts['In Progress'], color: 'var(--color-blue)' },
        { label: 'Review', value: statusCounts['Review / Approval'], color: 'var(--color-orange)' },
        { label: 'Released', value: statusCounts['Released / Closed'], color: 'var(--color-teal)' },
        { label: 'Draft', value: statusCounts['Draft'], color: 'var(--color-text-muted)' }
    ];
    
    let currentAngle = 0;
    let svgContent = `<svg width="180" height="180" viewBox="0 0 200 200" style="transform: rotate(-90deg)">`;
    
    categories.forEach(cat => {
        if (cat.value === 0) return;
        const percentage = cat.value / total;
        const angle = percentage * 360;
        
        const x1 = 100 + 70 * Math.cos((currentAngle * Math.PI) / 180);
        const y1 = 100 + 70 * Math.sin((currentAngle * Math.PI) / 180);
        const x2 = 100 + 70 * Math.cos(((currentAngle + angle) * Math.PI) / 180);
        const y2 = 100 + 70 * Math.sin(((currentAngle + angle) * Math.PI) / 180);
        
        const largeArc = angle > 180 ? 1 : 0;
        
        svgContent += `
            <path d="M ${x1} ${y1} A 70 70 0 ${largeArc} 1 ${x2} ${y2}" 
                  fill="none" 
                  stroke="${cat.color}" 
                  stroke-width="20" 
                  stroke-linecap="round" />
        `;
        currentAngle += angle;
    });
    
    svgContent += `
        <circle cx="100" cy="100" r="50" fill="var(--color-bg-card)" />
        <text x="100" y="-95" transform="rotate(90)" text-anchor="middle" dominant-baseline="middle" fill="var(--color-text-primary)" font-size="20" font-weight="700">${total}</text>
        <text x="100" y="-115" transform="rotate(90)" text-anchor="middle" dominant-baseline="middle" fill="var(--color-text-secondary)" font-size="10" font-weight="600" letter-spacing="1">TOTAL</text>
    </svg>`;
    
    let legendContent = '<div class="chart-legend">';
    categories.forEach(cat => {
        legendContent += `
            <div class="legend-item">
                <span class="legend-dot" style="background-color: ${cat.color}"></span>
                <span class="legend-label">${cat.label} (${cat.value})</span>
            </div>
        `;
    });
    legendContent += '</div>';
    
    container.innerHTML = `
        <style>
            .chart-flex { display: flex; align-items: center; justify-content: space-around; width: 100%; gap: 15px; }
            .chart-legend { display: flex; flex-direction: column; gap: 8px; }
            .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
            .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
            .legend-label { color: var(--color-text-secondary); }
        </style>
        <div class="chart-flex">
            ${svgContent}
            ${legendContent}
        </div>
    `;
}

// Bar Chart for Area Utilization
function renderAreaUtilizationChart(areas, equipment) {
    const container = document.getElementById('area-chart-container');
    if (!container) return;
    
    const areaCounts = {};
    areas.forEach(a => {
        areaCounts[a.code] = { name: a.name, count: 0 };
    });
    
    equipment.forEach(e => {
        if (areaCounts[e.area]) {
            areaCounts[e.area].count++;
        }
    });
    
    const data = Object.values(areaCounts);
    if (data.length === 0) {
        container.innerHTML = '<div class="no-data" style="font-size: 13px; color: var(--color-text-muted);">No Areas Configured</div>';
        return;
    }
    
    const maxCount = Math.max(...data.map(d => d.count), 1);
    
    let barsContent = '<div class="bars-container" style="display: flex; flex-direction: column; width: 100%; gap: 12px; padding: 10px 0;">';
    
    data.forEach(item => {
        const pct = (item.count / maxCount) * 100;
        barsContent += `
            <div class="bar-row" style="display: flex; align-items: center; width: 100%; gap: 12px;">
                <div class="bar-label" style="width: 120px; font-size: 11px; color: var(--color-text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${item.name}">${item.name}</div>
                <div class="bar-wrapper" style="flex: 1; background-color: var(--color-bg-app); height: 14px; border-radius: 4px; overflow: hidden; border: 1px solid var(--color-border);">
                    <div class="bar-fill" style="width: ${pct}%; background: linear-gradient(90deg, var(--color-blue), var(--color-teal)); height: 100%; border-radius: 4px; transition: width 0.5s;"></div>
                </div>
                <div class="bar-value" style="width: 20px; text-align: right; font-size: 11px; font-weight: 600; color: var(--color-text-primary);">${item.count}</div>
            </div>
        `;
    });
    
    barsContent += '</div>';
    container.innerHTML = barsContent;
}

// Render 5 Recent Audit Logs
function renderRecentAuditLogs(logs) {
    const container = document.getElementById('dashboard-audit-logs');
    if (!container) return;
    
    container.innerHTML = '';
    const recentLogs = logs.slice(0, 5);
    
    if (recentLogs.length === 0) {
        container.innerHTML = '<div class="no-data" style="font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 20px;">No Audit Logs Captured</div>';
        return;
    }
    
    recentLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'mini-audit-item';
        div.style.cursor = 'pointer';
        
        let iconBg = 'var(--color-blue-glow)';
        let iconColor = 'var(--color-blue)';
        let iconClass = 'fa-fingerprint';
        
        if (log.actionType === 'LOGIN') {
            iconBg = 'var(--color-blue-glow)';
            iconColor = 'var(--color-blue)';
            iconClass = 'fa-right-to-bracket';
        } else if (log.actionType.startsWith('CREATE')) {
            iconBg = 'var(--color-teal-glow)';
            iconColor = 'var(--color-teal)';
            iconClass = 'fa-plus';
        } else if (log.actionType.includes('SIGN')) {
            iconBg = 'var(--color-teal-glow)';
            iconColor = 'var(--color-teal)';
            iconClass = 'fa-signature';
        } else if (log.actionType.includes('FAIL') || log.actionType.includes('WARN')) {
            iconBg = 'var(--color-red-glow)';
            iconColor = 'var(--color-red)';
            iconClass = 'fa-shield-heart';
        }
        
        const timestamp = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        div.innerHTML = `
            <div class="mini-audit-icon" style="background-color: ${iconBg}; color: ${iconColor}">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="mini-audit-info">
                <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 2px;">${log.description}</div>
                <div class="mini-audit-meta">
                    <span>By: ${log.userName} (${log.userRole})</span>
                    <span>${timestamp}</span>
                </div>
            </div>
        `;
        
        div.onclick = () => {
            showAuditDetails(log);
        };
        
        container.appendChild(div);
    });
}

// Render Dashboard Area Summary
function renderDashboardAreasList(areas) {
    const container = document.getElementById('dashboard-areas-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    areas.forEach(area => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.padding = '10px 14px';
        item.style.borderRadius = 'var(--radius-sm)';
        item.style.backgroundColor = 'var(--color-bg-app)';
        item.style.border = '1px solid var(--color-border)';
        item.style.fontSize = '12px';
        item.style.marginBottom = '6px';
        
        let statusBadgeClass = 'badge-active';
        if (area.status === 'Dirty') statusBadgeClass = 'badge-warning';
        if (area.status === 'Maintenance') statusBadgeClass = 'badge-danger';
        
        item.innerHTML = `
            <div>
                <div style="font-weight: 600; color: var(--color-text-primary);">${area.name}</div>
                <div style="color: var(--color-text-muted); font-size: 10px; margin-top: 2px;">Code: ${area.code} | Dept: ${area.dept}</div>
            </div>
            <span class="badge ${statusBadgeClass}">${area.status}</span>
        `;
        container.appendChild(item);
    });
}
