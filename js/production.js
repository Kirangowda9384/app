/* ==========================================================================
   MYCOHAVEN PHARMA PLATFORM PRODUCTION MODULE (MULTI-TENANT)
   Manages Batches, BMR executing forms, Dynamic Annexures, and Custom Workflows
   ========================================================================== */

import { state } from './state.js';
import { openModal, closeModal, showToast, promptElectronicSignature } from './ui.js';
import { recordAreaActivityLog, recordEquipmentActivityLog } from './masters.js';

let activeBatch = null;
let activeStepId = null; // Can be a step ID or 'annexure'
let activeFilter = 'all';

export function renderProduction(route) {
    if (route === 'active-batches') {
        renderBatchesList();
    } else if (route === 'batch-execution') {
        if (activeBatch) {
            renderBatchExecutionDetail();
        } else {
            window.location.hash = '#active-batches';
        }
    } else if (route === 'area-logbook') {
        renderAreaLogbook();
    } else if (route === 'equipment-logbook') {
        renderEquipmentLogbook();
    }
}

// ==========================================================================
// 1. BATCH LIST VIEW
// ==========================================================================
function renderBatchesList() {
    const grid = document.getElementById('batches-grid-list');
    if (!grid) return;
    grid.innerHTML = '';
    
    const tenantBatches = state.getTenantBatches();
    
    // Filter batches
    const filtered = tenantBatches.filter(b => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'active') return b.status === 'In Progress';
        if (activeFilter === 'review') return b.status.startsWith('Pending') && !b.status.endsWith('Approver Review');
        if (activeFilter === 'approve') return b.status.endsWith('Approver Review') || b.status.endsWith('Approval');
        if (activeFilter === 'completed') return b.status === 'Approved' || b.status === 'Rejected' || b.status === 'Closed';
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--color-text-muted); padding: 40px;">No batches found.</div>';
    }

    filtered.forEach(batch => {
        const product = state.products.find(p => p.code === batch.productCode && p.companyId === state.activeCompanyId) || { name: 'Unknown Product' };
        const template = state.bmrTemplates.find(t => t.code === batch.templateCode && t.companyId === state.activeCompanyId) || { steps: [] };
        
        // Calculate progress percentage (steps + annexure if attached)
        const totalSteps = template.steps.length + (template.annexureId ? 1 : 0);
        let completedSteps = 0;
        
        if (batch.stepsData) {
            Object.values(batch.stepsData).forEach(s => {
                if (s.completed) completedSteps++;
            });
        }
        if (template.annexureId && batch.annexureSignedBy) {
            completedSteps++;
        }
        
        const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        
        let statusBadgeClass = 'badge-active';
        if (batch.status.startsWith('Pending')) statusBadgeClass = 'badge-warning';
        if (batch.status === 'Approved') statusBadgeClass = 'badge-active';
        if (batch.status === 'Rejected') statusBadgeClass = 'badge-danger';
        if (batch.status === 'Draft') statusBadgeClass = 'badge-inactive';

        const card = document.createElement('div');
        card.className = 'batch-card';
        card.innerHTML = `
            <div class="batch-card-header">
                <div>
                    <h4>${batch.id}</h4>
                    <span class="badge ${statusBadgeClass}">${batch.status}</span>
                </div>
                <div style="font-size: 18px; color: var(--color-teal); font-weight: 700;">${progressPct}%</div>
            </div>
            <div class="batch-card-body">
                <div><strong>Product:</strong> ${product.name}</div>
                <div style="font-size: 11px;"><strong>BMR Template:</strong> ${batch.templateCode}</div>
                <div><strong>Batch Size:</strong> ${batch.batchSize}</div>
                <div style="font-size: 11px; margin-top: 5px;">
                    <strong>Progress:</strong> ${completedSteps} / ${totalSteps} sections completed
                </div>
                <div class="batch-progress-bar-container">
                    <div class="batch-progress-bar" style="width: ${progressPct}%"></div>
                </div>
            </div>
        `;
        
        card.onclick = () => {
            activeBatch = batch;
            // Set initial active step
            const nextIncomplete = template.steps.find(s => !batch.stepsData[s.id]?.completed);
            if (nextIncomplete) {
                activeStepId = nextIncomplete.id;
            } else if (template.annexureId && !batch.annexureSignedBy) {
                activeStepId = 'annexure';
            } else {
                activeStepId = template.steps[0]?.id;
            }
            window.location.hash = '#batch-execution';
        };
        
        grid.appendChild(card);
    });

    // Initiate Batch button handler
    document.getElementById('btn-create-batch').onclick = () => {
        if (!state.hasPermission('Create')) {
            showToast('Insufficient permissions to initiate batches.', 'error');
            return;
        }
        
        const prodSelect = document.getElementById('batch-product');
        prodSelect.innerHTML = '<option value="">-- Choose Product --</option>';
        state.getTenantProducts().forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.code;
            opt.textContent = `${p.code} | ${p.name}`;
            prodSelect.appendChild(opt);
        });
        
        const templateSelect = document.getElementById('batch-template');
        templateSelect.innerHTML = '<option value="">-- Choose Product First --</option>';
        
        const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,'');
        document.getElementById('batch-num').value = `BCH-${dateStr}-01`;
        document.getElementById('batch-size-override').value = '';
        
        prodSelect.onchange = (e) => {
            const prodCode = e.target.value;
            const prod = state.products.find(p => p.code === prodCode && p.companyId === state.activeCompanyId);
            if (prod) {
                document.getElementById('batch-size-override').value = prod.batchSize;
                
                templateSelect.innerHTML = '';
                const templates = state.getTenantBmrTemplates().filter(t => t.productCode === prodCode && t.status === 'Active');
                if (templates.length === 0) {
                    templateSelect.innerHTML = '<option value="">-- No Active Templates Found --</option>';
                } else {
                    templates.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.code;
                        opt.textContent = `${t.name} (${t.code})`;
                        templateSelect.appendChild(opt);
                    });
                }
            } else {
                templateSelect.innerHTML = '<option value="">-- Choose Product First --</option>';
                document.getElementById('batch-size-override').value = '';
            }
        };
        
        openModal('modal-create-batch');
    };

    // Filter tabs handlers
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.onclick = (e) => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.getAttribute('data-filter');
            renderBatchesList();
        };
    });
}

// Create Batch Form Submission
document.getElementById('form-create-batch').onsubmit = (e) => {
    e.preventDefault();
    const batchId = document.getElementById('batch-num').value.trim().toUpperCase();
    const productCode = document.getElementById('batch-product').value;
    const templateCode = document.getElementById('batch-template').value;
    const batchSize = document.getElementById('batch-size-override').value;

    if (state.batches.some(b => b.id === batchId && b.companyId === state.activeCompanyId)) {
        showToast('Batch ID already exists.', 'error');
        return;
    }
    
    if (!templateCode || templateCode === '-- No Active Templates Found --') {
        showToast('Please select a valid BMR template.', 'error');
        return;
    }

    const template = state.bmrTemplates.find(t => t.code === templateCode && t.companyId === state.activeCompanyId);
    if (!template) return;

    promptElectronicSignature(`Initiate Production Batch Manufacturing Record: ${batchId}`, (signee) => {
        // Steps data map
        const stepsData = {};
        template.steps.forEach(s => {
            stepsData[s.id] = { completed: false, values: {}, signedBy: null, signedAt: null };
        });

        // Seed empty annexure data if attached
        const annexureData = {};
        if (template.annexureId) {
            const anxTemplate = state.annexures.find(a => a.id === template.annexureId && a.companyId === state.activeCompanyId);
            if (anxTemplate) {
                anxTemplate.rows.forEach(row => {
                    // Store input cells based on columns count (excluding Check Item)
                    const ansCols = anxTemplate.columns.slice(1).map(() => '');
                    annexureData[row] = { values: ansCols, verifiedBy: null };
                });
            }
        }

        const newBatch = {
            companyId: state.activeCompanyId,
            id: batchId,
            productCode,
            templateCode,
            batchSize,
            status: 'In Progress',
            currentStepIndex: 0,
            initiatedBy: signee.empId,
            initiatedAt: new Date().toISOString(),
            stepsData,
            annexureData,
            annexureSignedBy: null,
            annexureSignedAt: null,
            reviews: [],
            approvals: []
        };

        state.batches.push(newBatch);
        state.logAudit(signee.empId, 'CREATE_BATCH', `Initiated production batch: ${batchId} for ${state.activeCompanyId}`, batchId, { after: newBatch });
        state.save();
        
        closeModal('modal-create-batch');
        renderBatchesList();
        showToast(`Batch ${batchId} successfully initiated.`);
    });
};

// ==========================================================================
// 2. BATCH EXECUTION RUN (BMR FLOORS)
// ==========================================================================
function renderBatchExecutionDetail() {
    const template = state.bmrTemplates.find(t => t.code === activeBatch.templateCode && t.companyId === state.activeCompanyId);
    if (!template) return;

    document.getElementById('exec-batch-number').textContent = `Batch Record: ${activeBatch.id}`;
    
    let statusClass = 'badge-active';
    if (activeBatch.status.startsWith('Pending')) statusClass = 'badge-warning';
    if (activeBatch.status === 'Approved') statusClass = 'badge-active';
    if (activeBatch.status === 'Rejected') statusClass = 'badge-danger';
    
    const statusBadge = document.getElementById('exec-batch-status');
    statusBadge.textContent = activeBatch.status;
    statusBadge.className = `badge ${statusClass}`;
    
    const product = state.products.find(p => p.code === activeBatch.productCode && p.companyId === state.activeCompanyId) || { name: 'Unknown' };
    document.getElementById('exec-product-info').textContent = `Product: ${product.name} | Batch Size: ${activeBatch.batchSize} | BMR Template: ${activeBatch.templateCode}`;
    
    document.getElementById('btn-back-to-batches').onclick = () => {
        window.location.hash = '#active-batches';
    };

    // Render Steps List Sidebar
    const stepsListEl = document.getElementById('exec-steps-list');
    stepsListEl.innerHTML = '';
    
    template.steps.forEach((step, idx) => {
        const stepData = activeBatch.stepsData[step.id] || { completed: false };
        const btn = document.createElement('button');
        btn.className = `step-nav-btn ${step.id === activeStepId ? 'active' : ''} ${stepData.completed ? 'completed' : ''}`;
        
        btn.innerHTML = `
            <span>${idx + 1}. ${step.title}</span>
            <div class="step-check-icon">
                <i class="fa-solid ${stepData.completed ? 'fa-circle-check' : 'fa-circle'}"></i>
            </div>
        `;
        
        btn.onclick = () => {
            activeStepId = step.id;
            renderBatchExecutionDetail();
        };
        
        stepsListEl.appendChild(btn);
    });

    // Render Annexure section in sidebar if template contains it
    const anxNavSection = document.getElementById('exec-annexure-nav-section');
    const anxBtn = document.getElementById('btn-nav-exec-annexure');
    const anxCheckIcon = document.getElementById('exec-annexure-check-icon');
    
    if (template.annexureId) {
        anxNavSection.style.display = 'block';
        anxBtn.className = `step-nav-btn mt-10 ${activeStepId === 'annexure' ? 'active' : ''} ${activeBatch.annexureSignedBy ? 'completed' : ''}`;
        anxCheckIcon.className = `fa-solid ${activeBatch.annexureSignedBy ? 'fa-circle-check' : 'fa-circle'}`;
        if (activeBatch.annexureSignedBy) {
            anxCheckIcon.style.color = 'var(--color-teal)';
        } else {
            anxCheckIcon.style.color = 'var(--color-text-muted)';
        }
        
        anxBtn.onclick = () => {
            activeStepId = 'annexure';
            renderBatchExecutionDetail();
        };
    } else {
        anxNavSection.style.display = 'none';
    }

    // Toggle Normal Form View vs Annexure Table View
    const normalView = document.getElementById('execution-step-normal-view');
    const annexureView = document.getElementById('execution-step-annexure-view');
    
    if (activeStepId === 'annexure') {
        normalView.style.display = 'none';
        annexureView.style.display = 'block';
        renderActiveAnnexureGrid();
    } else {
        normalView.style.display = 'block';
        annexureView.style.display = 'none';
        renderActiveStepDetail();
    }
    
    renderWorkflowActionButtons();
}

function renderActiveStepDetail() {
    const template = state.bmrTemplates.find(t => t.code === activeBatch.templateCode && t.companyId === state.activeCompanyId);
    const stepIndex = template.steps.findIndex(s => s.id === activeStepId);
    const step = template.steps[stepIndex];
    
    if (!step) return;
    
    const stepData = activeBatch.stepsData[step.id];
    
    document.getElementById('active-step-title').textContent = `${stepIndex + 1}. ${step.title}`;
    
    const statusBadge = document.getElementById('active-step-status');
    if (stepData.completed) {
        statusBadge.textContent = `Completed & Signed`;
        statusBadge.className = 'step-status-badge badge-active';
    } else {
        statusBadge.textContent = `Awaiting ${step.requiredRole} Sign-off`;
        statusBadge.className = 'step-status-badge badge-warning';
    }

    const formContainer = document.getElementById('active-step-form-container');
    formContainer.innerHTML = '';
    
    const descBlock = document.createElement('div');
    descBlock.style.backgroundColor = 'var(--color-bg-app)';
    descBlock.style.borderLeft = '4px solid var(--color-blue)';
    descBlock.style.padding = '12px 16px';
    descBlock.style.borderRadius = 'var(--radius-sm)';
    descBlock.style.marginBottom = '20px';
    descBlock.style.fontSize = '14px';
    descBlock.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; color: var(--color-blue)">Operational Instructions</div>
        <p style="color: var(--color-text-primary)">${step.description}</p>
    `;
    formContainer.appendChild(descBlock);

    const form = document.createElement('form');
    form.id = 'form-step-inputs';
    
    if (step.fields && step.fields.length > 0) {
        step.fields.forEach((field, fIdx) => {
            const group = document.createElement('div');
            group.className = 'form-group';
            
            let fieldLabelText = field.label;
            if (field.type === 'number') {
                let rangeText = '';
                if (field.min !== '' && field.max !== '') {
                    rangeText = ` (Range: ${field.min} to ${field.max} ${field.unit || ''})`;
                } else if (field.min !== '') {
                    rangeText = ` (Min: ${field.min} ${field.unit || ''})`;
                } else if (field.max !== '') {
                    rangeText = ` (Max: ${field.max} ${field.unit || ''})`;
                }
                fieldLabelText += rangeText;
            }
            
            const label = document.createElement('label');
            label.textContent = fieldLabelText;
            group.appendChild(label);
            
            const input = document.createElement('input');
            input.type = field.type;
            input.className = 'form-input step-field-input-value';
            input.name = `field-${fIdx}`;
            input.required = field.required;
            input.disabled = stepData.completed || activeBatch.status !== 'In Progress';
            
            if (field.type === 'number') {
                if (field.min !== '') input.min = field.min;
                if (field.max !== '') input.max = field.max;
                if (field.step) input.step = field.step;
            }
            
            if (stepData.values && stepData.values[field.label] !== undefined) {
                input.value = stepData.values[field.label];
            }
            
            group.appendChild(input);
            form.appendChild(group);
        });
    } else {
        const noFieldsMsg = document.createElement('div');
        noFieldsMsg.style.padding = '10px 0';
        noFieldsMsg.style.color = 'var(--color-text-secondary)';
        noFieldsMsg.style.fontSize = '13px';
        noFieldsMsg.textContent = 'Verification-only step.';
        form.appendChild(noFieldsMsg);
    }
    
    formContainer.appendChild(form);

    const areaLogStatus = document.getElementById('step-area-log-status');
    const area = state.areas.find(a => a.code === step.areaCode && a.companyId === state.activeCompanyId) || { name: 'Unknown', cleanStatus: 'N/A' };
    
    areaLogStatus.innerHTML = `
        <div><strong>Area:</strong> ${area.name} (Code: ${step.areaCode})</div>
        <div style="font-size: 11px; margin-top: 4px;">Cleanliness: <span class="badge ${area.cleanStatus === 'Clean' ? 'badge-active' : 'badge-warning'}">${area.cleanStatus}</span></div>
    `;
    
    const equipmentLogStatus = document.getElementById('step-equipment-log-status');
    const eq = state.equipment.find(e => e.id === step.equipId && e.companyId === state.activeCompanyId) || { name: 'Unknown', calibrationDate: 'N/A', status: 'N/A' };
    const isCalibrated = new Date(eq.calibrationDate) >= new Date();
    
    equipmentLogStatus.innerHTML = `
        <div><strong>Asset:</strong> ${eq.name} (ID: ${step.equipId})</div>
        <div style="font-size: 11px; margin-top: 4px; display: flex; justify-content: space-between;">
            <span>State: <span class="badge ${eq.status === 'Active' ? 'badge-active' : eq.status === 'Dirty' ? 'badge-warning' : 'badge-danger'}">${eq.status}</span></span>
            <span class="${isCalibrated ? 'text-success' : 'text-danger font-bold'}">Calibration: ${eq.calibrationDate}</span>
        </div>
    `;

    const signoffMsgEl = document.getElementById('step-signoff-status-msg');
    const signoffActionEl = document.getElementById('step-signoff-action-area');
    
    if (stepData.completed) {
        const signDate = new Date(stepData.signedAt).toLocaleString();
        const signer = state.users.find(u => u.empId === stepData.signedBy) || { name: 'Unknown' };
        signoffMsgEl.innerHTML = `
            <div style="background-color: var(--color-teal-glow); border: 1px solid rgba(13, 148, 136, 0.2); border-radius: var(--radius-sm); padding: 12px; display: flex; align-items: center; gap: 12px; color: var(--color-teal); font-size: 13px;">
                <i class="fa-solid fa-signature" style="font-size: 20px;"></i>
                <div>
                    <div><strong>Signed by:</strong> ${signer.name} (${stepData.signedRole})</div>
                    <div style="font-size: 11px; margin-top: 2px;">Signed Date: ${signDate} | Verified digitally under 21 CFR Part 11</div>
                </div>
            </div>
        `;
        signoffActionEl.style.display = 'none';
    } else {
        signoffMsgEl.innerHTML = '';
        signoffActionEl.style.display = 'block';
        
        const signBtn = document.getElementById('btn-sign-step');
        
        if (activeBatch.status !== 'In Progress') {
            signBtn.setAttribute('disabled', 'disabled');
            signBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Record Locked';
        } else {
            signBtn.removeAttribute('disabled');
            signBtn.innerHTML = '<i class="fa-solid fa-signature"></i> Sign and Complete Step';
        }
        
        signBtn.onclick = () => {
            const stepForm = document.getElementById('form-step-inputs');
            if (stepForm && !stepForm.reportValidity()) return;
            
            const activeUser = state.getActiveUser();
            if (activeUser.role !== step.requiredRole && activeUser.role !== 'Admin') {
                showToast(`Access Denied: Only '${step.requiredRole}' can execute this step.`, 'error');
                return;
            }

            if (!isCalibrated) {
                showToast(`WARNING: Calibration for Equipment ${eq.id} is past due! Recorded in Audit Trail.`, 'warning');
            }

            const values = {};
            let isOOS = false;
            let oosDetails = '';

            if (step.fields && step.fields.length > 0) {
                step.fields.forEach((field, fIdx) => {
                    const el = stepForm.querySelector(`[name="field-${fIdx}"]`);
                    if (el) {
                        const val = field.type === 'number' ? parseFloat(el.value) : el.value;
                        values[field.label] = val;

                        if (field.type === 'number') {
                            if (field.min !== '' && val < field.min) { isOOS = true; oosDetails += `${field.label} (${val}) was below ${field.min}. `; }
                            if (field.max !== '' && val > field.max) { isOOS = true; oosDetails += `${field.label} (${val}) was above ${field.max}. `; }
                        }
                    }
                });
            }

            promptElectronicSignature(`Complete & Sign off Batch Step: ${step.title}`, (signee) => {
                recordAreaActivityLog(step.areaCode, `Batch production: ${activeBatch.id} executed Step ${step.title}`, activeBatch.id, signee.name, 'Dirty');
                recordEquipmentActivityLog(step.equipId, `Batch production: ${activeBatch.id} processed Step ${step.title}`, activeBatch.id, signee.name, 'Dirty');

                if (isOOS) {
                    state.logAudit(signee.empId, 'OOS_BYPASS', `OOS Parameter bypassed for Batch ${activeBatch.id}. Details: ${oosDetails}`, activeBatch.id, { values });
                    showToast('Out-Of-Specification values recorded.', 'warning');
                }

                stepData.completed = true;
                stepData.values = values;
                stepData.signedBy = signee.empId;
                stepData.signedRole = signee.role;
                stepData.signedAt = new Date().toISOString();

                state.logAudit(signee.empId, 'BATCH_SIGN', `Signed BMR Step: ${step.title} for Batch ${activeBatch.id}`, activeBatch.id, { values });
                state.save();
                
                renderBatchExecutionDetail();
                showToast(`Step signed and completed.`);
            });
        };
    }
}

// ==========================================================================
// 2B. INTERACTIVE ANNEXURE GRID EXECUTION
// ==========================================================================
function renderActiveAnnexureGrid() {
    const template = state.bmrTemplates.find(t => t.code === activeBatch.templateCode && t.companyId === state.activeCompanyId);
    const anxTemplate = state.annexures.find(a => a.id === template.annexureId && a.companyId === state.activeCompanyId);
    
    if (!anxTemplate) return;
    
    document.getElementById('exec-annexure-title').textContent = anxTemplate.name;
    
    const statusBadge = document.getElementById('exec-annexure-status');
    if (activeBatch.annexureSignedBy) {
        statusBadge.textContent = 'Completed & Signed';
        statusBadge.className = 'step-status-badge badge-active';
    } else {
        statusBadge.textContent = 'Awaiting Operator Sign-off';
        statusBadge.className = 'step-status-badge badge-warning';
    }

    // Render Table Headers
    const thead = document.querySelector('#table-exec-annexure-grid thead');
    thead.innerHTML = '';
    const headerTr = document.createElement('tr');
    anxTemplate.columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerTr.appendChild(th);
    });
    thead.appendChild(headerTr);

    // Render Table Body Rows
    const tbody = document.querySelector('#table-exec-annexure-grid tbody');
    tbody.innerHTML = '';
    
    const isCompleted = !!activeBatch.annexureSignedBy;
    const isLocked = activeBatch.status !== 'In Progress';
    
    anxTemplate.rows.forEach((rowName, rIdx) => {
        const tr = document.createElement('tr');
        
        // Col 1: Parameter Row Name
        const tdName = document.createElement('td');
        tdName.innerHTML = `<strong>${rowName}</strong>`;
        tr.appendChild(tdName);
        
        // Saved row data
        const savedRow = activeBatch.annexureData[rowName] || { values: [], verifiedBy: '' };
        
        // Remaining input columns
        for (let cIdx = 1; cIdx < anxTemplate.columns.length; cIdx++) {
            const tdInput = document.createElement('td');
            
            // Render text inputs for cell answers
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-input annexure-cell-input';
            input.style.padding = '6px 10px';
            input.style.fontSize = '13px';
            input.style.minWidth = '120px';
            input.value = savedRow.values[cIdx - 1] || '';
            input.disabled = isCompleted || isLocked;
            
            // Listeners to update answers in-memory
            input.onchange = (e) => {
                if (!activeBatch.annexureData[rowName]) {
                    activeBatch.annexureData[rowName] = { values: [], verifiedBy: '' };
                }
                activeBatch.annexureData[rowName].values[cIdx - 1] = e.target.value;
                state.save(); // Save progress
            };
            
            tdInput.appendChild(input);
            tr.appendChild(tdInput);
        }
        
        tbody.appendChild(tr);
    });

    // Sign off action
    const signMsg = document.getElementById('annexure-signoff-status-msg');
    const signAction = document.getElementById('annexure-signoff-action-area');
    
    if (isCompleted) {
        const signDate = new Date(activeBatch.annexureSignedAt).toLocaleString();
        const signer = state.users.find(u => u.empId === activeBatch.annexureSignedBy) || { name: 'Unknown' };
        signMsg.innerHTML = `
            <div style="background-color: var(--color-teal-glow); border: 1px solid rgba(13, 148, 136, 0.2); border-radius: var(--radius-sm); padding: 12px; display: flex; align-items: center; gap: 12px; color: var(--color-teal); font-size: 13px;">
                <i class="fa-solid fa-signature" style="font-size: 20px;"></i>
                <div>
                    <div><strong>Signed by:</strong> ${signer.name} (Operator)</div>
                    <div style="font-size: 11px; margin-top: 2px;">Signed Date: ${signDate} | Verified digitally under 21 CFR Part 11</div>
                </div>
            </div>
        `;
        signAction.style.display = 'none';
    } else {
        signMsg.innerHTML = '';
        signAction.style.display = 'block';
        
        const signBtn = document.getElementById('btn-sign-annexure');
        
        if (isLocked) {
            signBtn.setAttribute('disabled', 'disabled');
            signBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Record Locked';
        } else {
            signBtn.removeAttribute('disabled');
            signBtn.innerHTML = '<i class="fa-solid fa-signature"></i> Verify & Sign Annexure';
        }
        
        signBtn.onclick = () => {
            // Check that all cells are filled
            let allFilled = true;
            document.querySelectorAll('.annexure-cell-input').forEach(input => {
                if (!input.value.trim()) allFilled = false;
            });
            
            if (!allFilled) {
                showToast('Please fill out all table fields in the annexure.', 'error');
                return;
            }
            
            const activeUser = state.getActiveUser();
            if (activeUser.role !== 'Production Operator' && activeUser.role !== 'Admin') {
                showToast("Access Denied: Only Operators can sign off the execution annexure.", "error");
                return;
            }
            
            promptElectronicSignature(`Sign & Verify Quality checksheet Annexure: ${anxTemplate.name}`, (signee) => {
                activeBatch.annexureSignedBy = signee.empId;
                activeBatch.annexureSignedAt = new Date().toISOString();
                
                // Write operator verify to all rows
                anxTemplate.rows.forEach(row => {
                    if (activeBatch.annexureData[row]) {
                        activeBatch.annexureData[row].verifiedBy = signee.name;
                    }
                });
                
                state.logAudit(signee.empId, 'BATCH_ANNEXURE_SIGN', `Signed and certified Annexure ${anxTemplate.id} for Batch ${activeBatch.id}`, activeBatch.id);
                state.save();
                
                renderBatchExecutionDetail();
                showToast('Annexure checksheet signed successfully.');
            });
        };
    }
}

// ==========================================================================
// 3. WORKFLOW PROGRESSION ENGINE (DYNAMIC CLIENT-DEFINED PATHS)
// ==========================================================================
function renderWorkflowActionButtons() {
    const container = document.getElementById('batch-actions-container');
    if (!container) return;
    container.innerHTML = '';

    const template = state.bmrTemplates.find(t => t.code === activeBatch.templateCode && t.companyId === state.activeCompanyId);
    if (!template) return;

    // Get Workflow Route Configuration
    const workflowId = template.workflowId || 'WF-DEFAULT';
    const workflow = state.workflows.find(w => w.id === workflowId && w.companyId === state.activeCompanyId) || { steps: ['Production Operator', 'Production Supervisor', 'QA Approver'] };
    const workflowRoles = workflow.steps; // e.g., ['Production Operator', 'Production Supervisor', 'QA Reviewer', 'QA Approver']

    // 1. Check if Floor execution is fully complete (all BMR steps + annexures if attached)
    let allStepsDone = true;
    template.steps.forEach(s => {
        if (!activeBatch.stepsData[s.id]?.completed) {
            allStepsDone = false;
        }
    });
    
    if (template.annexureId && !activeBatch.annexureSignedBy) {
        allStepsDone = false;
    }

    const activeUser = state.getActiveUser();
    
    // Status Transitions logic based on active status location
    if (activeBatch.status === 'In Progress') {
        if (allStepsDone) {
            // First role in workflow (usually Production Operator) must submit
            const firstRole = workflowRoles[0] || 'Production Operator';
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            
            // Get next role in loop
            const nextRole = workflowRoles[1] || 'Production Supervisor';
            btn.innerHTML = `<i class="fa-solid fa-share-from-square"></i> Submit for ${nextRole} Review`;
            
            btn.onclick = () => {
                if (activeUser.role !== firstRole && activeUser.role !== 'Admin') {
                    showToast(`Only users with role '${firstRole}' can submit this record.`, 'error');
                    return;
                }

                promptElectronicSignature(`Submit Batch Record ${activeBatch.id} for Review`, (signee) => {
                    const oldState = activeBatch.status;
                    activeBatch.status = `Pending ${nextRole} Review`;
                    
                    state.logAudit(signee.empId, 'BATCH_WORKFLOW', `Batch status progressed from ${oldState} to Pending ${nextRole} Review`, activeBatch.id);
                    state.save();
                    
                    renderBatchExecutionDetail();
                    showToast(`Batch record submitted for review.`);
                });
            };
            container.appendChild(btn);
        } else {
            const info = document.createElement('div');
            info.style.fontSize = '12px';
            info.style.color = 'var(--color-text-muted)';
            info.style.fontStyle = 'italic';
            info.innerHTML = '<i class="fa-solid fa-circle-info"></i> All steps and annexures must be signed off to submit for review.';
            container.appendChild(info);
        }
    } else if (activeBatch.status.startsWith('Pending') && activeBatch.status.endsWith('Review')) {
        // Dynamic intermediary review states (e.g. "Pending Production Supervisor Review", "Pending QA Reviewer Review")
        const currentRoleReviewPending = activeBatch.status.replace('Pending ', '').replace(' Review', '');
        
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        
        // Find position in workflow sequence
        const currentRoleIndex = workflowRoles.indexOf(currentRoleReviewPending);
        const nextRole = workflowRoles[currentRoleIndex + 1];
        
        if (nextRole) {
            // Escalate to next role
            btn.innerHTML = `<i class="fa-solid fa-clipboard-check"></i> Sign & Verify (Escalate to ${nextRole})`;
        } else {
            // This is the last review role, escalate to release stage
            btn.innerHTML = `<i class="fa-solid fa-stamp"></i> Sign Review & Push to Approval`;
        }
        
        btn.onclick = () => {
            if (activeUser.role !== currentRoleReviewPending && activeUser.role !== 'Admin') {
                showToast(`Access Denied: Only users with role '${currentRoleReviewPending}' can sign off.`, 'error');
                return;
            }

            promptElectronicSignature(`Complete ${currentRoleReviewPending} Review for Batch ${activeBatch.id}`, (signee) => {
                const oldState = activeBatch.status;
                
                if (nextRole) {
                    activeBatch.status = `Pending ${nextRole} Review`;
                } else {
                    activeBatch.status = 'Pending QA Approval';
                }
                
                activeBatch.reviews.push({
                    role: currentRoleReviewPending,
                    signedBy: signee.empId,
                    signedAt: new Date().toISOString()
                });
                
                state.logAudit(signee.empId, 'BATCH_WORKFLOW', `Batch status progressed from ${oldState} to ${activeBatch.status}`, activeBatch.id);
                state.save();
                
                renderBatchExecutionDetail();
                showToast(`Review certified and BMR workflow progressed.`);
            });
        };
        container.appendChild(btn);
    } else if (activeBatch.status === 'Pending QA Approval' || activeBatch.status.endsWith('Approval')) {
        // Last step of workflow releases or rejects the BMR
        const finalApproverRole = workflowRoles[workflowRoles.length - 1] || 'QA Approver';
        
        const btnApprove = document.createElement('button');
        btnApprove.className = 'btn btn-success';
        btnApprove.style.marginRight = '10px';
        btnApprove.innerHTML = '<i class="fa-solid fa-stamp"></i> Release / Approve Batch';
        btnApprove.onclick = () => {
            if (activeUser.role !== finalApproverRole && activeUser.role !== 'Admin') {
                showToast(`Access Denied: Only '${finalApproverRole}' can release batches.`, 'error');
                return;
            }

            promptElectronicSignature(`Release and Approve Batch ${activeBatch.id} (Market Release)`, (signee) => {
                const oldState = activeBatch.status;
                activeBatch.status = 'Approved';
                activeBatch.approvals.push({
                    role: finalApproverRole,
                    status: 'Released',
                    signedBy: signee.empId,
                    signedAt: new Date().toISOString()
                });
                
                state.logAudit(signee.empId, 'BATCH_WORKFLOW', `Batch status changed from ${oldState} to Approved (Closed/Released)`, activeBatch.id);
                state.save();
                
                renderBatchExecutionDetail();
                showToast(`Batch ${activeBatch.id} approved and released.`);
            });
        };
        
        const btnReject = document.createElement('button');
        btnReject.className = 'btn btn-danger';
        btnReject.innerHTML = '<i class="fa-solid fa-ban"></i> Reject Batch';
        btnReject.onclick = () => {
            if (activeUser.role !== finalApproverRole && activeUser.role !== 'Admin') {
                showToast(`Access Denied: Only '${finalApproverRole}' can reject batches.`, 'error');
                return;
            }

            promptElectronicSignature(`Reject Batch ${activeBatch.id} (Discard Record)`, (signee) => {
                const oldState = activeBatch.status;
                activeBatch.status = 'Rejected';
                activeBatch.approvals.push({
                    role: finalApproverRole,
                    status: 'Rejected',
                    signedBy: signee.empId,
                    signedAt: new Date().toISOString()
                });
                
                state.logAudit(signee.empId, 'BATCH_WORKFLOW', `Batch status changed from ${oldState} to Rejected`, activeBatch.id);
                state.save();
                
                renderBatchExecutionDetail();
                showToast(`Batch ${activeBatch.id} rejected.`, 'error');
            });
        };
        
        container.appendChild(btnApprove);
        container.appendChild(btnReject);
    } else {
        const msg = document.createElement('div');
        msg.className = 'badge';
        msg.style.padding = '8px 16px';
        
        if (activeBatch.status === 'Approved') {
            msg.className += ' badge-active';
            msg.innerHTML = '<i class="fa-solid fa-circle-check"></i> Batch Released & Closed';
        } else {
            msg.className += ' badge-danger';
            msg.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Batch Rejected & Closed';
        }
        container.appendChild(msg);
    }
}

// ==========================================================================
// 4. LOGBOOKS RENDER + MANUAL E-LOG ENTRY HANDLERS
// ==========================================================================
function renderAreaLogbook() {
    const tbody = document.querySelector('#table-area-logbook tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const logs = state.getTenantAreaLogbook();
    
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted);">No area activity logs. Use the button above to record a manual e-Log entry.</td></tr>';
    } else {
        logs.forEach(log => {
            const time = new Date(log.timestamp).toLocaleString();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${time}</td>
                <td><strong>${log.areaCode}</strong></td>
                <td>${log.areaName}</td>
                <td>${log.activity}</td>
                <td><code>${log.batchId}</code></td>
                <td>${log.signedBy}</td>
                <td><span class="badge ${log.status === 'Clean' ? 'badge-active' : 'badge-warning'}">${log.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Manual Area e-Log Button: Open Modal & Populate Dropdown ---
    const manualAreaBtn = document.getElementById('btn-add-manual-area-log');
    if (manualAreaBtn) {
        manualAreaBtn.onclick = () => {
            const activeUser = state.getActiveUser();
            if (!activeUser.moduleAccess || !activeUser.moduleAccess.includes('e-Log')) {
                showToast('Access Denied: Your account does not have e-Log module access.', 'error');
                return;
            }

            // Populate area select dropdown
            const areaSelect = document.getElementById('man-area-select');
            areaSelect.innerHTML = '<option value="">-- Select Area --</option>';
            state.getTenantAreas().forEach(area => {
                const opt = document.createElement('option');
                opt.value = area.code;
                opt.textContent = `${area.name} (${area.code}) — ${area.cleanStatus}`;
                areaSelect.appendChild(opt);
            });

            // Reset form fields
            document.getElementById('man-area-activity').value = '';
            document.getElementById('man-area-status').value = 'Clean';

            openModal('modal-manual-area-log');
        };
    }
}

// Manual Area e-Log Form Submission
document.getElementById('form-manual-area-log').onsubmit = (e) => {
    e.preventDefault();

    const areaCode = document.getElementById('man-area-select').value;
    const activity = document.getElementById('man-area-activity').value.trim();
    const postStatus = document.getElementById('man-area-status').value;

    if (!areaCode) {
        showToast('Please select a manufacturing area.', 'error');
        return;
    }
    if (!activity) {
        showToast('Please describe the activity performed.', 'error');
        return;
    }

    const area = state.areas.find(a => a.code === areaCode && a.companyId === state.activeCompanyId);
    const areaName = area ? area.name : 'Unknown';

    promptElectronicSignature(`Manual e-Log Entry — Area Cleaning / Activity: ${areaName} (${areaCode})`, (signee) => {
        recordAreaActivityLog(areaCode, activity, 'N/A (Manual e-Log)', signee.name, postStatus);
        state.logAudit(
            signee.empId,
            'MANUAL_ELOG_AREA',
            `Manual e-Log recorded for area ${areaName} (${areaCode}): ${activity}. Post-status: ${postStatus}`,
            areaCode,
            { activity, postStatus }
        );
        closeModal('modal-manual-area-log');
        renderAreaLogbook();
        showToast(`Area e-Log entry recorded for ${areaName}.`);
    });
};

function renderEquipmentLogbook() {
    const tbody = document.querySelector('#table-equipment-logbook tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const logs = state.getTenantEquipmentLogbook();
    
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted);">No equipment activity logs. Use the button above to record a manual e-Log entry.</td></tr>';
    } else {
        logs.forEach(log => {
            const time = new Date(log.timestamp).toLocaleString();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${time}</td>
                <td><strong>${log.equipId}</strong></td>
                <td>${log.equipName}</td>
                <td>${log.activity}</td>
                <td><code>${log.batchId}</code></td>
                <td>${log.signedBy}</td>
                <td><span class="badge ${log.status === 'Active' ? 'badge-active' : log.status === 'Dirty' ? 'badge-warning' : 'badge-danger'}">${log.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Manual Equipment e-Log Button: Open Modal & Populate Dropdown ---
    const manualEquipBtn = document.getElementById('btn-add-manual-equipment-log');
    if (manualEquipBtn) {
        manualEquipBtn.onclick = () => {
            const activeUser = state.getActiveUser();
            if (!activeUser.moduleAccess || !activeUser.moduleAccess.includes('e-Log')) {
                showToast('Access Denied: Your account does not have e-Log module access.', 'error');
                return;
            }

            // Populate equipment select dropdown
            const equipSelect = document.getElementById('man-equip-select');
            equipSelect.innerHTML = '<option value="">-- Select Equipment --</option>';
            state.getTenantEquipment().forEach(eq => {
                const opt = document.createElement('option');
                opt.value = eq.id;
                opt.textContent = `${eq.name} (${eq.id}) — ${eq.status}`;
                equipSelect.appendChild(opt);
            });

            // Reset form fields
            document.getElementById('man-equip-activity').value = '';
            document.getElementById('man-equip-status').value = 'Active';

            openModal('modal-manual-equipment-log');
        };
    }
}

// Manual Equipment e-Log Form Submission
document.getElementById('form-manual-equipment-log').onsubmit = (e) => {
    e.preventDefault();

    const equipId = document.getElementById('man-equip-select').value;
    const activity = document.getElementById('man-equip-activity').value.trim();
    const postStatus = document.getElementById('man-equip-status').value;

    if (!equipId) {
        showToast('Please select an equipment asset.', 'error');
        return;
    }
    if (!activity) {
        showToast('Please describe the activity performed.', 'error');
        return;
    }

    const eq = state.equipment.find(e => e.id === equipId && e.companyId === state.activeCompanyId);
    const equipName = eq ? eq.name : 'Unknown';

    promptElectronicSignature(`Manual e-Log Entry — Equipment Activity / State: ${equipName} (${equipId})`, (signee) => {
        recordEquipmentActivityLog(equipId, activity, 'N/A (Manual e-Log)', signee.name, postStatus);
        state.logAudit(
            signee.empId,
            'MANUAL_ELOG_EQUIP',
            `Manual e-Log recorded for equipment ${equipName} (${equipId}): ${activity}. Post-status: ${postStatus}`,
            equipId,
            { activity, postStatus }
        );
        closeModal('modal-manual-equipment-log');
        renderEquipmentLogbook();
        showToast(`Equipment e-Log entry recorded for ${equipName}.`);
    });
};
