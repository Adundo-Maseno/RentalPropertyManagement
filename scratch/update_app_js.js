const fs = require('fs');

let appJs = fs.readFileSync('public/app.js', 'utf8');

// 1. Replace handleAddTenantSubmit block
const oldAddTenant = `    try {
      await this.fetchAPI('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      this.closeModal('modal-add-tenant');
      if (payload.unit_id) {
        this.showToast(\`Tenant "\${name}" registered and lease activated successfully!\`, 'success');
      } else {
        this.showToast(\`Tenant "\${name}" registered successfully!\`, 'success');
      }
      await this.refreshAllData();
      this.renderProperties();
      this.renderUnits();
      this.renderTenants();
      this.renderDashboard();
      if (this.state.currentView === 'leases') this.renderLeaseAgreementsInit();
    } catch (err) {
      console.error(err);
    }`;

const newAddTenant = `    try {
      const res = await this.fetchAPI('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      this.closeModal('modal-add-tenant');
      if (payload.unit_id) {
        this.showToast(\`Tenant "\${name}" registered and lease activated successfully!\`, 'success');
      } else {
        this.showToast(\`Tenant "\${name}" registered successfully!\`, 'success');
      }
      await this.refreshAllData();
      this.renderProperties();
      this.renderUnits();
      this.renderTenants();
      this.renderDashboard();
      if (this.state.currentView === 'leases') this.renderLeases();

      if (payload.unit_id && res && (res.agreement_id || res.invoice_id)) {
        this.promptMoveInSettlement({
          ...res,
          tenant_name: name,
          tenant_phone: phone,
          unit_id: payload.unit_id
        });
      }
    } catch (err) {
      console.error(err);
      this.showToast(err.message || 'Failed to add tenant', 'error');
    }`;

// 2. Replace handleCreateLeaseSubmit block
const oldCreateLease = `    try {
      await this.fetchAPI('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          tenant_id: tenantId,
          start_date: startDate,
          end_date: endDate,
          monthly_rent: monthlyRent,
          deposit_paid: depositPaid,
          water_deposit: waterDeposit,
          terms: terms || 'Standard 1-year tenancy agreement'
        })
      });

      this.closeModal('modal-create-lease');
      this.showToast('New digital lease executed successfully! Unit marked occupied.', 'success');
      await this.refreshAllData();
      this.renderProperties();
      this.renderUnits();
      this.renderTenants();
      this.renderDashboard();
      if (this.state.currentView === 'leases') this.renderLeaseAgreementsInit();
    } catch (err) {
      console.error(err);
      this.showToast(err.message || 'Failed to execute lease', 'error');
    }`;

const newCreateLease = `    try {
      const res = await this.fetchAPI('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          tenant_id: tenantId,
          start_date: startDate,
          end_date: endDate,
          monthly_rent: monthlyRent,
          deposit_paid: depositPaid,
          water_deposit: waterDeposit,
          terms: terms || 'Standard 1-year tenancy agreement'
        })
      });

      this.closeModal('modal-create-lease');
      this.showToast('New digital lease executed successfully! Unit marked occupied.', 'success');
      await this.refreshAllData();
      this.renderProperties();
      this.renderUnits();
      this.renderTenants();
      this.renderDashboard();
      if (this.state.currentView === 'leases') this.renderLeases();

      if (res && (res.agreement_id || res.invoice_id)) {
        this.promptMoveInSettlement({
          ...res,
          tenant_id: tenantId,
          unit_id: unitId
        });
      }
    } catch (err) {
      console.error(err);
      this.showToast(err.message || 'Failed to execute lease', 'error');
    }`;

// 3. Methods to add: promptMoveInSettlement, onMoveInPromptAction, openManualPaymentForInvoice
const newMethods = `
  openManualPaymentForInvoice(invoiceId) {
    const inv = this.state.invoices.find(i => i.id === Number(invoiceId));
    this.openManualPaymentModal();
    if (!inv) return;
    const tenantSelect = document.getElementById('pay-manual-tenant');
    if (tenantSelect) {
      tenantSelect.value = inv.tenant_id;
      this.onManualTenantChange(inv.tenant_id);
    }
    const invSelect = document.getElementById('pay-manual-invoice');
    if (invSelect) {
      invSelect.value = inv.id;
    }
    const amtInput = document.getElementById('pay-manual-amount');
    if (amtInput) {
      amtInput.value = inv.balance || inv.amount;
    }
  }

  promptMoveInSettlement(details) {
    this.currentMoveInDetails = details;

    const tenant = this.state.tenants.find(t => t.id === Number(details.tenant_id)) || {};
    const unit = this.state.units.find(u => u.id === Number(details.unit_id)) || {};
    const prop = this.state.properties.find(p => p.id === unit.property_id) || {};

    const tenantName = details.tenant_name || details.name || tenant.name || 'New Resident';
    const tenantPhone = details.tenant_phone || details.phone || tenant.phone || '0700000000';
    const unitLabel = unit.unit_number ? \`\${prop.name || 'Property'} • Unit \${unit.unit_number}\` : (details.unit_number ? \`Unit \${details.unit_number}\` : 'Assigned Unit');
    const agreementCode = details.agreement_code || \`BS-AGR-\${details.agreement_id || 'PENDING'}\`;
    const invoiceNum = details.invoice_number || \`INV-\${details.invoice_id || 'MOVEIN'}\`;
    const totalDue = Number(details.total_due || 0);
    const rent = Number(details.rent || details.monthly_rent || unit.base_rent || unit.monthly_rent || 0);
    const deposit = Number(details.deposit || details.deposit_paid || rent);
    const waterDeposit = Number(details.water_deposit || 5000);

    const nameEl = document.getElementById('prompt-tenant-name');
    if (nameEl) nameEl.textContent = tenantName;

    const phoneEl = document.getElementById('prompt-tenant-phone');
    if (phoneEl) phoneEl.textContent = tenantPhone;

    const unitEl = document.getElementById('prompt-unit-property');
    if (unitEl) unitEl.textContent = unitLabel;

    const codeEl = document.getElementById('prompt-agreement-code');
    if (codeEl) codeEl.textContent = agreementCode;

    const invEl = document.getElementById('prompt-invoice-number');
    if (invEl) invEl.textContent = invoiceNum;

    const rentEl = document.getElementById('prompt-breakdown-rent');
    if (rentEl) rentEl.textContent = \`KES \${rent.toLocaleString()}\`;

    const depEl = document.getElementById('prompt-breakdown-deposit');
    if (depEl) depEl.textContent = \`KES \${deposit.toLocaleString()}\`;

    const waterEl = document.getElementById('prompt-breakdown-water');
    if (waterEl) waterEl.textContent = \`KES \${waterDeposit.toLocaleString()}\`;

    const totalEl = document.getElementById('prompt-invoice-total');
    if (totalEl) totalEl.textContent = \`KES \${totalDue.toLocaleString()}\`;

    this.openModal('modal-movein-payment-prompt');
    if (window.lucide) lucide.createIcons();
  }

  onMoveInPromptAction(action) {
    const details = this.currentMoveInDetails || {};
    this.closeModal('modal-movein-payment-prompt');

    if (action === 'mpesa') {
      if (details.invoice_id) {
        this.openMpesaForInvoice(details.invoice_id);
      } else if (details.tenant_id) {
        this.openMpesaForTenant(details.tenant_id);
      } else {
        this.openMpesaModal();
      }
    } else if (action === 'manual') {
      if (details.invoice_id) {
        this.openManualPaymentForInvoice(details.invoice_id);
      } else {
        this.openManualPaymentModal();
      }
    } else if (action === 'sign') {
      this.switchView('leases');
      if (details.agreement_id) {
        setTimeout(() => this.openLeaseSignModal(details.agreement_id), 120);
      }
    }
  }
`;

// Check targets exist
if (!appJs.includes(oldAddTenant)) {
  console.error('oldAddTenant target not found');
  process.exit(1);
}
if (!appJs.includes(oldCreateLease)) {
  console.error('oldCreateLease target not found');
  process.exit(1);
}

appJs = appJs.replace(oldAddTenant, newAddTenant);
appJs = appJs.replace(oldCreateLease, newCreateLease);

// Insert newMethods right after openManualPaymentModal block
const targetManual = `  openManualPaymentModal() {`;
if (!appJs.includes(targetManual)) {
  console.error('targetManual not found');
  process.exit(1);
}
appJs = appJs.replace(targetManual, newMethods + '\n' + targetManual);

fs.writeFileSync('public/app.js', appJs, 'utf8');
console.log('Successfully updated public/app.js');

