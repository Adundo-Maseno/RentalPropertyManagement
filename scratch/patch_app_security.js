const fs = require('fs');

let appJs = fs.readFileSync('public/app.js', 'utf8');
const isCRLF = appJs.includes('\r\n');
appJs = appJs.replace(/\r\n/g, '\n');

// 1. Add escapeHtml method to BomaSphereApp if not already a member
if (!appJs.includes('  escapeHtml(str) {')) {
  appJs = appJs.replace(
    'class BomaSphereApp {',
    `class BomaSphereApp {\n  escapeHtml(str) { return escapeHtml(str); }`
  );
  console.log('Added escapeHtml method to BomaSphereApp');
}

// 2. Fix XSS in viewing leads table
const oldViewingLeads = `<p class="font-bold text-slate-800 dark:text-white">\${l.prospect_name}</p>
            <p class="text-[11px] text-slate-500 font-mono">\${l.phone} \${l.email ? '• ' + l.email : ''}</p>
          </td>
          <td class="py-3 px-4">
            <p class="font-bold text-slate-700 dark:text-zinc-200">Unit \${l.unit_number || 'N/A'}</p>
            <p class="text-[11px] text-slate-500">\${l.property_name || 'BomaSphere'} (\${this.formatMoney(l.base_rent || 0)}/mo)</p>
          </td>
          <td class="py-3 px-4">
            <p class="font-semibold text-slate-800 dark:text-zinc-100">\${l.preferred_date}</p>
            <p class="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">\${l.time_slot}</p>
          </td>
          <td class="py-3 px-4">\${statusBadge}</td>
          <td class="py-3 px-4 text-slate-600 dark:text-zinc-300 max-w-xs truncate" title="\${l.notes || ''}">
            \${l.notes || '<span class="text-slate-400 italic">No notes provided</span>'}`;

const newViewingLeads = `<p class="font-bold text-slate-800 dark:text-white">\${this.escapeHtml(l.prospect_name)}</p>
            <p class="text-[11px] text-slate-500 font-mono">\${this.escapeHtml(l.phone)} \${l.email ? '• ' + this.escapeHtml(l.email) : ''}</p>
          </td>
          <td class="py-3 px-4">
            <p class="font-bold text-slate-700 dark:text-zinc-200">Unit \${this.escapeHtml(l.unit_number || 'N/A')}</p>
            <p class="text-[11px] text-slate-500">\${this.escapeHtml(l.property_name || 'BomaSphere')} (\${this.formatMoney(l.base_rent || 0)}/mo)</p>
          </td>
          <td class="py-3 px-4">
            <p class="font-semibold text-slate-800 dark:text-zinc-100">\${this.escapeHtml(l.preferred_date)}</p>
            <p class="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">\${this.escapeHtml(l.time_slot)}</p>
          </td>
          <td class="py-3 px-4">\${statusBadge}</td>
          <td class="py-3 px-4 text-slate-600 dark:text-zinc-300 max-w-xs truncate" title="\${this.escapeHtml(l.notes || '')}">
            \${l.notes ? this.escapeHtml(l.notes) : '<span class="text-slate-400 italic">No notes provided</span>'}`;

if (appJs.includes(oldViewingLeads)) {
  appJs = appJs.replace(oldViewingLeads, newViewingLeads);
  console.log('Fixed XSS in viewing leads table');
}

// 3. Fix XSS in communications log table
const oldCommRow = `<td class="py-3 px-4 font-bold text-slate-800">\${c.recipient_name}</td>
        <td class="py-3 px-4 font-mono text-[11px] text-slate-600">\${c.recipient_phone}</td>
        <td class="py-3 px-4 text-slate-600 text-[11px] max-w-md truncate" title="\${c.message}">\${c.message}</td>`;

const newCommRow = `<td class="py-3 px-4 font-bold text-slate-800">\${escapeHtml(c.recipient_name)}</td>
        <td class="py-3 px-4 font-mono text-[11px] text-slate-600">\${escapeHtml(c.recipient_phone)}</td>
        <td class="py-3 px-4 text-slate-600 text-[11px] max-w-md truncate" title="\${escapeHtml(c.message)}">\${escapeHtml(c.message)}</td>`;

if (appJs.includes(oldCommRow)) {
  appJs = appJs.replace(oldCommRow, newCommRow);
  console.log('Fixed XSS in communications log table');
}

// 4. Fix XSS in showToast
const oldToast = `    toast.innerHTML = \`
      <span class="w-2 h-2 rounded-full \${type === 'success' ? 'bg-emerald-400' : (type === 'error' ? 'bg-rose-400' : 'bg-blue-400')}"></span>
      <span class="flex-1">\${message}</span>
    \`;`;

const newToast = `    toast.innerHTML = \`
      <span class="w-2 h-2 rounded-full \${type === 'success' ? 'bg-emerald-400' : (type === 'error' ? 'bg-rose-400' : 'bg-blue-400')}"></span>
      <span class="flex-1">\${escapeHtml(message)}</span>
    \`;`;

if (appJs.includes(oldToast)) {
  appJs = appJs.replace(oldToast, newToast);
  console.log('Fixed XSS in showToast');
}

// 5. Fix hardcoded inspection math and submit payload
const oldSubmitInsp = `    const payload = {
      unit_id: Number(unitId),
      tenant_id: 1,
      inspection_type: type,
      inspector_name: this.state.authUser?.name || 'Lead Estate Manager',
      checklist,
      deposit_held: 130000,
      unpaid_utility_arrears: 2150
    };`;

const newSubmitInsp = `    const selectedUnitId = Number(unitId);
    const unit = (this.state.units || []).find(u => u.id === selectedUnitId);
    const lease = (this.state.leaseAgreements || []).find(l => l.unit_id === selectedUnitId && l.status !== 'terminated') 
      || (this.state.leases || []).find(l => l.unit_id === selectedUnitId && l.status === 'active');
    const tenantId = lease ? lease.tenant_id : ((this.state.tenants || []).find(t => t.unit_id === selectedUnitId)?.id || 1);
    const depositHeld = lease ? (lease.deposit_amount || lease.deposit_paid || lease.rent_amount || (unit ? unit.base_rent : 65000)) : (unit ? unit.base_rent : 65000);
    const unpaidInvoices = (this.state.invoices || []).filter(i => (i.unit_id === selectedUnitId || (lease && i.tenant_id === lease.tenant_id)) && Number(i.balance) > 0);
    const arrears = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);

    const payload = {
      unit_id: selectedUnitId,
      tenant_id: Number(tenantId),
      inspection_type: type,
      inspector_name: this.state.authUser?.name || 'Lead Estate Manager',
      checklist,
      deposit_held: Number(depositHeld),
      unpaid_utility_arrears: Number(arrears)
    };`;

if (appJs.includes(oldSubmitInsp)) {
  appJs = appJs.replace(oldSubmitInsp, newSubmitInsp);
  console.log('Fixed hardcoded inspection payload');
}

// 6. Fix inspection math calculations
const oldMath = `    const totalDamages = item1 + item2 + item3 + item4;
    const depositHeld = 130000;
    const unpaidArrears = 2150;
    const netRefund = Math.max(0, depositHeld - totalDamages - unpaidArrears);`;

const newMath = `    const totalDamages = item1 + item2 + item3 + item4;
    const selectedUnitId = Number(document.getElementById('insp-unit-id')?.value || 1);
    const unit = (this.state.units || []).find(u => u.id === selectedUnitId);
    const lease = (this.state.leaseAgreements || []).find(l => l.unit_id === selectedUnitId && l.status !== 'terminated') 
      || (this.state.leases || []).find(l => l.unit_id === selectedUnitId && l.status === 'active');
    const depositHeld = lease ? (lease.deposit_amount || lease.deposit_paid || lease.rent_amount || (unit ? unit.base_rent : 65000)) : (unit ? unit.base_rent : 65000);
    const unpaidInvoices = (this.state.invoices || []).filter(i => (i.unit_id === selectedUnitId || (lease && i.tenant_id === lease.tenant_id)) && Number(i.balance) > 0);
    const unpaidArrears = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
    const netRefund = Math.max(0, depositHeld - totalDamages - unpaidArrears);`;

if (appJs.includes(oldMath)) {
  appJs = appJs.replace(oldMath, newMath);
  console.log('Fixed inspection math dynamic computation');
}

if (isCRLF) {
  appJs = appJs.replace(/\n/g, '\r\n');
}

fs.writeFileSync('public/app.js', appJs, 'utf8');
console.log('Successfully written public/app.js');
