/* ==========================================================================
   MYCOHAVEN PHARMA PLATFORM STATE MANAGEMENT (MULTI-TENANT)
   Handles Tenant Companies, Data Isolation, Dynamic Annexures, and Workflows
   ========================================================================== */

const STORAGE_KEY = 'mycohaven_pmdms_state';

// 1. Global Vendor Seed Data (MycoHaven Platform Level)
const DEFAULT_COMPANIES = [
    { id: 'AURA', name: 'Aura Pharmaceuticals Ltd.', status: 'Active', licenseExpiry: '2027-12-31', enabledModules: ['eBMR', 'LIMS', 'QMS'] },
    { id: 'BIOC', name: 'BioCure Laboratories', status: 'Active', licenseExpiry: '2026-09-30', enabledModules: ['eBMR', 'DMS'] }
];

// 2. Initial Seed Data (Tenant-specific, scoped by companyId)
const DEFAULT_DEPARTMENTS = [
    { companyId: 'AURA', name: 'Production', active: true },
    { companyId: 'AURA', name: 'QA', active: true },
    { companyId: 'AURA', name: 'QC', active: true },
    { companyId: 'AURA', name: 'Engineering', active: true },
    { companyId: 'BIOC', name: 'Production', active: true },
    { companyId: 'BIOC', name: 'QA', active: true }
];

const DEFAULT_USERS = [
    // Super Admin (Global Vendor Account)
    { companyId: 'SYSTEM', empId: 'EMP-SUPER', name: 'MycoHaven Super Admin', designation: 'Super Administrator', email: 'admin@mycohaven.com', userType: 'Master User', dept: 'Vendor Operations', pin: '0000', active: true, moduleAccess: ['Masters', 'eLogbook', 'eBMR', 'ELN', 'LIMS', 'QMS', 'Reports'], permissions: ['View', 'Create', 'Edit', 'Submit', 'Review', 'Approve'] },
    
    // Aura Pharmaceuticals
    { companyId: 'AURA', empId: 'EMP-AURA-01', name: 'Dr. Sarah Connor', designation: 'QA Admin', email: 's.connor@aura.com', userType: 'Master User', dept: 'QA', pin: '1111', active: true, moduleAccess: ['Masters', 'eLogbook', 'eBMR', 'ELN', 'LIMS', 'QMS', 'Reports'], permissions: ['View', 'Create', 'Edit', 'Submit', 'Review', 'Approve'] },
    { companyId: 'AURA', empId: 'EMP-AURA-02', name: 'John Doe', designation: 'Production Operator', email: 'j.doe@aura.com', userType: 'Production User', dept: 'Production', pin: '2222', active: true, moduleAccess: ['eBMR', 'eLogbook'], permissions: ['View', 'Create', 'Edit', 'Submit'] },
    { companyId: 'AURA', empId: 'EMP-AURA-03', name: 'James Carter', designation: 'Production Supervisor', email: 'j.carter@aura.com', userType: 'Production User', dept: 'Production', pin: '3333', active: true, moduleAccess: ['eBMR', 'eLogbook'], permissions: ['View', 'Review'] },
    { companyId: 'AURA', empId: 'EMP-AURA-04', name: 'Elena Rostova', designation: 'QA Reviewer', email: 'e.rostova@aura.com', userType: 'Production User', dept: 'QA', pin: '4444', active: true, moduleAccess: ['eBMR', 'LIMS', 'QMS'], permissions: ['View', 'Review'] },
    { companyId: 'AURA', empId: 'EMP-AURA-05', name: 'Dr. Alan Grant', designation: 'QA Approver', email: 'a.grant@aura.com', userType: 'Production User', dept: 'QA', pin: '5555', active: true, moduleAccess: ['eBMR', 'LIMS', 'QMS'], permissions: ['View', 'Approve'] },
    { companyId: 'AURA', empId: 'EMP-AURA-06', name: 'Robert Muldoon', designation: 'Engineering Staff', email: 'r.muldoon@aura.com', userType: 'Production User', dept: 'Engineering', pin: '6666', active: true, moduleAccess: ['eLogbook', 'LIMS'], permissions: ['View', 'Edit'] },
    
    // BioCure Laboratories
    { companyId: 'BIOC', empId: 'EMP-BIOC-01', name: 'Alice Smith', designation: 'Admin', email: 'alice@biocure.com', userType: 'Master User', dept: 'QA', pin: '1234', active: true, moduleAccess: ['Masters', 'eLogbook', 'eBMR', 'ELN', 'LIMS', 'QMS', 'Reports'], permissions: ['View', 'Create', 'Edit', 'Submit', 'Review', 'Approve'] },
    { companyId: 'BIOC', empId: 'EMP-BIOC-02', name: 'Bob Johnson', designation: 'Operator', email: 'bob@biocure.com', userType: 'Production User', dept: 'Production', pin: '2345', active: true, moduleAccess: ['eBMR'], permissions: ['View', 'Create', 'Submit'] },
    { companyId: 'BIOC', empId: 'EMP-BIOC-03', name: 'Charlie Brown', designation: 'Supervisor', email: 'charlie@biocure.com', userType: 'Production User', dept: 'Production', pin: '3456', active: true, moduleAccess: ['eBMR'], permissions: ['View', 'Review'] },
    { companyId: 'BIOC', empId: 'EMP-BIOC-04', name: 'Diana Prince', designation: 'Approver', email: 'diana@biocure.com', userType: 'Production User', dept: 'QA', pin: '4567', active: true, moduleAccess: ['eBMR', 'QMS'], permissions: ['View', 'Approve'] }
];

const DEFAULT_AREAS = [
    // Aura Areas
    { companyId: 'AURA', code: 'DISP-01', name: 'Dispensing Area 1', dept: 'Production', status: 'Active', cleanStatus: 'Clean' },
    { companyId: 'AURA', code: 'GRAN-02', name: 'Granulation Suite B', dept: 'Production', status: 'Active', cleanStatus: 'Clean' },
    { companyId: 'AURA', code: 'COMP-03', name: 'Compression Room 2', dept: 'Production', status: 'Active', cleanStatus: 'Clean' },
    
    // BioCure Areas
    { companyId: 'BIOC', code: 'BC-GRAN-01', name: 'BioCure Granulation A', dept: 'Production', status: 'Active', cleanStatus: 'Clean' },
    { companyId: 'BIOC', code: 'BC-COMP-01', name: 'BioCure Compression Suite', dept: 'Production', status: 'Active', cleanStatus: 'Clean' }
];

const DEFAULT_EQUIPMENT = [
    // Aura Assets
    { companyId: 'AURA', id: 'EQ-DISP-01', name: 'Mettler Toledo Weighing Balance', area: 'DISP-01', make: 'Mettler Toledo', model: 'XS6002S', calibrationDate: '2026-08-15', status: 'Active' },
    { companyId: 'AURA', id: 'EQ-GRAN-02', name: 'RMG Fluid Bed Granulator', area: 'GRAN-02', make: 'Glatt', model: 'GPCG 30', calibrationDate: '2026-05-10', status: 'Active' },
    { companyId: 'AURA', id: 'EQ-COMP-03', name: 'Cadmach Tablet Press', area: 'COMP-03', make: 'Cadmach', model: 'Legacy 40', calibrationDate: '2026-09-30', status: 'Active' },
    
    // BioCure Assets
    { companyId: 'BIOC', id: 'EQ-BC-01', name: 'BioCure Shear Granulator', area: 'BC-GRAN-01', make: 'Niro', model: 'P10', calibrationDate: '2026-10-12', status: 'Active' }
];

const DEFAULT_PRODUCTS = [
    { companyId: 'AURA', code: 'PRD-PARA-500', name: 'Paracetamol 500mg Tablets', batchSize: '500,000 units' },
    { companyId: 'AURA', code: 'PRD-IBU-400', name: 'Ibuprofen 400mg Film Coated Tablets', batchSize: '250,000 units' },
    { companyId: 'BIOC', code: 'PRD-ASP-325', name: 'Aspirin 325mg Tablets', batchSize: '1,000,000 units' }
];

const DEFAULT_ANNEXURES = [
    {
        companyId: 'AURA',
        id: 'ANX-LINE-CLEAR',
        name: 'Line Clearance Checks Annexure',
        columns: ['Check Item', 'Status (Yes/No)', 'Verified By'],
        rows: [
            'Previous product labels removed?',
            'Area swept, washed, and cleaned?',
            'Equipment certified clean and dry?',
            'No trace of previous materials?'
        ]
    },
    {
        companyId: 'AURA',
        id: 'ANX-BAL-VERIFY',
        name: 'Balance Verification checksheet',
        columns: ['Weight Standard', 'Observed Weight (g)', 'Tolerance (g)', 'Verified By'],
        rows: [
            '100g weight check',
            '500g weight check',
            '1000g weight check'
        ]
    }
];

const DEFAULT_WORKFLOWS = [
    {
        companyId: 'AURA',
        id: 'WF-DEFAULT',
        name: 'Standard Approval Sequence',
        steps: ['Production Operator', 'Production Supervisor', 'QA Reviewer', 'QA Approver']
    },
    {
        companyId: 'BIOC',
        id: 'WF-DEFAULT',
        name: 'BioCure Short Approval Sequence',
        steps: ['Production Operator', 'Production Supervisor', 'QA Approver'] // Bypasses QA Reviewer
    }
];

const DEFAULT_BMR_TEMPLATES = [
    {
        companyId: 'AURA',
        code: 'BMR-PARA-500-REV1',
        name: 'Paracetamol 500mg Granulation & Compression Batch Record',
        productCode: 'PRD-PARA-500',
        status: 'Active',
        annexureId: 'ANX-LINE-CLEAR', // Attached annexure
        workflowId: 'WF-DEFAULT',
        steps: [
            {
                id: 'step-1',
                title: 'Material Dispensing Verification',
                description: 'Verify weight of active pharmaceutical ingredients (API) and excipients.',
                requiredRole: 'Production Operator',
                fields: [
                    { label: 'Paracetamol API Lot Number', type: 'text', required: true },
                    { label: 'Target API Weight (250 kg)', type: 'number', min: 249, max: 251, unit: 'kg', required: true }
                ],
                areaCode: 'DISP-01',
                equipId: 'EQ-DISP-01'
            },
            {
                id: 'step-2',
                title: 'Tablet Compression Run',
                description: 'Perform compression of granulated dry mix on Tablet Press.',
                requiredRole: 'Production Operator',
                fields: [
                    { label: 'Average Tablet Weight (mg)', type: 'number', min: 590, max: 610, unit: 'mg', required: true }
                ],
                areaCode: 'COMP-03',
                equipId: 'EQ-COMP-03'
            }
        ]
    }
];

const DEFAULT_BATCHES = [
    {
        companyId: 'AURA',
        id: 'BCH-2606-01',
        productCode: 'PRD-PARA-500',
        templateCode: 'BMR-PARA-500-REV1',
        batchSize: '500,000 units',
        status: 'In Progress',
        currentStepIndex: 0,
        initiatedBy: 'EMP-AURA-02',
        initiatedAt: '2026-06-21T10:30:00.000Z',
        stepsData: {
            'step-1': { completed: false, values: {}, signedBy: null, signedAt: null },
            'step-2': { completed: false, values: {}, signedBy: null, signedAt: null }
        },
        annexureData: {
            'Previous product labels removed?': { status: '', verified: '' },
            'Area swept, washed, and cleaned?': { status: '', verified: '' },
            'Equipment certified clean and dry?': { status: '', verified: '' },
            'No trace of previous materials?': { status: '', verified: '' }
        },
        reviews: [],
        approvals: []
    }
];

// Helper to hash details for audit log integrity
function generateIntegrityHash(timestamp, userId, action, details) {
    const raw = `${timestamp}|${userId}|${action}|${JSON.stringify(details)}|mycohaven-compliance-key`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'SHA256-SIM-' + Math.abs(hash).toString(16).toUpperCase();
}

// State container (Multi-Tenant)
export const state = {
    companies: [],
    users: [],
    roles: {},
    departments: [],
    areas: [],
    equipment: [],
    products: [],
    annexures: [],
    workflows: [],
    bmrTemplates: [],
    batches: [],
    auditTrail: [],
    areaLogbook: [],
    equipmentLogbook: [],
    
    // Multi-tenant Session parameters
    activeCompanyId: '', 
    activeUserEmpId: '',
    
    // Initialize Database
    init() {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
            try {
                const parsed = JSON.parse(local);
                this.companies = parsed.companies || [];
                this.users = parsed.users || [];
                this.users.forEach(u => {
                    if (!u.moduleAccess) {
                        u.moduleAccess = ['eBMR', 'LIMS', 'QMS', 'DMS', 'Inventory', 'ELN', 'e-Log'];
                    }
                });
                this.departments = parsed.departments || [];
                this.areas = parsed.areas || [];
                this.equipment = parsed.equipment || [];
                this.products = parsed.products || [];
                this.annexures = parsed.annexures || [];
                this.workflows = parsed.workflows || [];
                this.bmrTemplates = parsed.bmrTemplates || [];
                this.batches = parsed.batches || [];
                this.auditTrail = parsed.auditTrail || [];
                this.areaLogbook = parsed.areaLogbook || [];
                this.equipmentLogbook = parsed.equipmentLogbook || [];
                this.activeCompanyId = parsed.activeCompanyId || DEFAULT_COMPANIES[0].id;
                this.activeUserEmpId = parsed.activeUserEmpId || DEFAULT_USERS[0].empId; // Default Super Admin
            } catch (e) {
                console.error("Failed to parse local storage. Seeding default data...", e);
                this.seed();
            }
        } else {
            this.seed();
        }
    },
    
    // Seed default values
    seed() {
        this.companies = [...DEFAULT_COMPANIES];
        this.users = [...DEFAULT_USERS];
        this.departments = [...DEFAULT_DEPARTMENTS];
        this.areas = [...DEFAULT_AREAS];
        this.equipment = [...DEFAULT_EQUIPMENT];
        this.products = [...DEFAULT_PRODUCTS];
        this.annexures = [...DEFAULT_ANNEXURES];
        this.workflows = [...DEFAULT_WORKFLOWS];
        this.bmrTemplates = [...DEFAULT_BMR_TEMPLATES];
        this.batches = [...DEFAULT_BATCHES];
        this.activeCompanyId = 'AURA'; 
        this.activeUserEmpId = 'EMP-SUPER'; // Super Admin
        this.auditTrail = [];
        this.areaLogbook = [];
        this.equipmentLogbook = [];
        
        // Log Seeding
        this.logAudit('SYSTEM', 'DATABASE_SEED', 'Database seeded with multi-tenant company partitions (Aura, BioCure) and Super Admin.', 'SYSTEM-ROOT');
        this.save();
    },
    
    // Save to Local Storage
    save() {
        const data = {
            companies: this.companies,
            users: this.users,
            departments: this.departments,
            areas: this.areas,
            equipment: this.equipment,
            products: this.products,
            annexures: this.annexures,
            workflows: this.workflows,
            bmrTemplates: this.bmrTemplates,
            batches: this.batches,
            auditTrail: this.auditTrail,
            areaLogbook: this.areaLogbook,
            equipmentLogbook: this.equipmentLogbook,
            activeCompanyId: this.activeCompanyId,
            activeUserEmpId: this.activeUserEmpId
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    // Audit Logger (Multi-Tenant compliant trace)
    logAudit(userId, actionType, description, entityId = null, detailsDiff = null) {
        const timestamp = new Date().toISOString();
        const activeUser = this.users.find(u => u.empId === userId) || { name: 'System', designation: 'SYSTEM' };
        
        const logEntry = {
            companyId: this.activeUserEmpId === 'EMP-SUPER' ? 'SYSTEM' : this.activeCompanyId,
            timestamp,
            userId,
            userName: activeUser.name,
            userRole: activeUser.designation,
            actionType,
            description,
            entityId,
            detailsDiff,
            ipAddress: '192.168.10.142',
            integrityHash: generateIntegrityHash(timestamp, userId, actionType, { description, entityId, detailsDiff })
        };
        
        this.auditTrail.unshift(logEntry);
        this.save();
        return logEntry;
    },

    // Get active user object
    getActiveUser() {
        return this.users.find(u => u.empId === this.activeUserEmpId) || this.users[0];
    },

    // Switch active user & company session
    switchSession(companyId, empId) {
        // Validate matching user
        const user = this.users.find(u => u.empId === empId && (u.companyId === companyId || empId === 'EMP-SUPER'));
        if (user) {
            this.activeCompanyId = companyId;
            this.activeUserEmpId = empId;
            this.logAudit(empId, 'LOGIN', `User session switched to ${user.name} for ${companyId === 'SYSTEM' ? 'MycoHaven Platform' : companyId}`);
            this.save();
            return user;
        }
        return null;
    },

    // RBAC: Check if current active user has a permission
    hasPermission(permission) {
        const user = this.getActiveUser();
        if (!user || !user.active) return false;
        
        return user.permissions && user.permissions.includes(permission);
    },

    // Helper functions for dynamic multi-tenant filters
    getTenantUsers() {
        if (this.activeUserEmpId === 'EMP-SUPER') return this.users;
        return this.users.filter(u => u.companyId === this.activeCompanyId);
    },

    getTenantDepartments() {
        return this.departments.filter(d => d.companyId === this.activeCompanyId);
    },

    getTenantAreas() {
        return this.areas.filter(a => a.companyId === this.activeCompanyId);
    },

    getTenantEquipment() {
        return this.equipment.filter(e => e.companyId === this.activeCompanyId);
    },

    getTenantProducts() {
        return this.products.filter(p => p.companyId === this.activeCompanyId);
    },

    getTenantAnnexures() {
        return this.annexures.filter(a => a.companyId === this.activeCompanyId);
    },

    getTenantWorkflows() {
        return this.workflows.filter(w => w.companyId === this.activeCompanyId);
    },

    getTenantBmrTemplates() {
        return this.bmrTemplates.filter(t => t.companyId === this.activeCompanyId);
    },

    getTenantBatches() {
        return this.batches.filter(b => b.companyId === this.activeCompanyId);
    },

    getTenantAuditTrail() {
        if (this.activeUserEmpId === 'EMP-SUPER') return this.auditTrail;
        return this.auditTrail.filter(l => l.companyId === this.activeCompanyId);
    },

    getTenantAreaLogbook() {
        return this.areaLogbook.filter(l => l.companyId === this.activeCompanyId);
    },

    getTenantEquipmentLogbook() {
        return this.equipmentLogbook.filter(l => l.companyId === this.activeCompanyId);
    }
};

// Auto initialize on import
state.init();
