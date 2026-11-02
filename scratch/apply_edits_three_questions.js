const fs = require('fs');

// 1. Patch public/index.html
let html = fs.readFileSync('public/index.html', 'utf8');

const viewingLeadsSection = `
          <!-- Inbound Viewing Leads & Prospect Appointments -->
          <div class="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/90 dark:border-zinc-800 shadow-xs overflow-hidden mt-6">
            <div class="p-4 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-800/40">
              <div class="flex items-center space-x-2.5">
                <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <i data-lucide="calendar-check" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="font-bold text-slate-800 dark:text-white text-sm">Prospect House Viewing Appointments &amp; Leads</h3>
                  <p class="text-xs text-slate-500 dark:text-zinc-400">Inbound house tours booked from public vacancy showcase awaiting caretaker walkthrough &amp; leasing</p>
                </div>
              </div>
              <span class="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800" id="viewing-leads-count-badge">0 Scheduled Tours</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 font-semibold border-b border-slate-200 dark:border-zinc-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th class="py-3 px-4">Prospect Details</th>
                    <th class="py-3 px-4">Target Unit &amp; Property</th>
                    <th class="py-3 px-4">Preferred Date &amp; Slot</th>
                    <th class="py-3 px-4">Status</th>
                    <th class="py-3 px-4">Prospect Notes</th>
                    <th class="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-zinc-800" id="viewing-leads-table-body">
                  <!-- Dynamic viewing leads -->
                </tbody>
              </table>
            </div>
          </div>
`;

if (!html.includes('id="viewing-leads-table-body"')) {
  const targetClosingTag = '</section>\r\n\r\n        <!-- ====================================================\r\n        <!-- VIEW 4: INVOICING & RENT LEDGER -->';
  const targetClosingTagLF = '</section>\n\n        <!-- ====================================================\n        <!-- VIEW 4: INVOICING & RENT LEDGER -->';
  
  if (html.includes(targetClosingTag)) {
    html = html.replace(targetClosingTag, viewingLeadsSection + targetClosingTag);
    fs.writeFileSync('public/index.html', html, 'utf8');
    console.log('[OK] Inserted Viewing Leads table into public/index.html');
  } else if (html.includes(targetClosingTagLF)) {
    html = html.replace(targetClosingTagLF, viewingLeadsSection + targetClosingTagLF);
    fs.writeFileSync('public/index.html', html, 'utf8');
    console.log('[OK] Inserted Viewing Leads table into public/index.html (LF)');
  } else {
    // Fallback: insert before </section> of view-tenants
    const vtIndex = html.indexOf('id="view-tenants"');
    const closeSectionIndex = html.indexOf('</section>', vtIndex);
    if (closeSectionIndex !== -1) {
      html = html.slice(0, closeSectionIndex) + viewingLeadsSection + html.slice(closeSectionIndex);
      fs.writeFileSync('public/index.html', html, 'utf8');
      console.log('[OK] Inserted Viewing Leads table before end of view-tenants');
    }
  }
} else {
  console.log('[INFO] viewing-leads-table-body already in public/index.html');
}

// 2. Patch public/app.js
let appJs = fs.readFileSync('public/app.js', 'utf8');

// Ensure viewingLeads is in this.state
if (!appJs.includes('viewingLeads: []')) {
  appJs = appJs.replace('amenityBookings: []', 'amenityBookings: [],\n      viewingLeads: []');
  console.log('[OK] Added viewingLeads to this.state');
}

// Ensure viewingLeads is fetched in refreshAllData
if (!appJs.includes('/api/viewing-leads')) {
  appJs = appJs.replace(
    "this.fetchAPI('/api/amenity-bookings', { silent: true }).catch(() => [])",
    "this.fetchAPI('/api/amenity-bookings', { silent: true }).catch(() => []),\n        this.fetchAPI('/api/viewing-leads', { silent: true }).catch(() => [])"
  );
  appJs = appJs.replace(
    "this.state.amenityBookings = Array.isArray(amenityBookings?.bookings) ? amenityBookings.bookings : (Array.isArray(amenityBookings) ? amenityBookings : []);",
    "this.state.amenityBookings = Array.isArray(amenityBookings?.bookings) ? amenityBookings.bookings : (Array.isArray(amenityBookings) ? amenityBookings : []);\n      const vlData = arguments[0] || [];\n      // Map viewing leads from parallel results\n      if (Array.isArray(results) && results[8]) {\n        this.state.viewingLeads = Array.isArray(results[8]?.leads) ? results[8].leads : (Array.isArray(results[8]) ? results[8] : []);\n      }"
  );
  console.log('[OK] Hooked /api/viewing-leads into refreshAllData()');
}

// Update openAddLeaseModal to strictly reject occupied units
const oldLeaseModalFnRegex = /openAddLeaseModal\(preselectedUnitId = null\) \{[\s\S]*?unitSelect\.innerHTML = targetUnits\.map\(u => `/;
const newLeaseModalFn = `openAddLeaseModal(preselectedUnitId = null) {
    const unitSelect = document.getElementById('lease-unit-select');
    const tenantSelect = document.getElementById('lease-tenant-select');
    if (!unitSelect || !tenantSelect) return;

    // Check if preselected unit is occupied - strictly reject double-leasing!
    if (preselectedUnitId) {
      const selected = this.state.units.find(u => u.id === Number(preselectedUnitId));
      if (selected && selected.status === 'occupied') {
        this.showToast(\`Unit \${selected.unit_number} (\${selected.property_name || 'Property'}) is currently occupied under an active lease! An occupied house cannot be assigned again. Please terminate or process move-out first.\`, 'warning');
        return;
      }
    }

    // Only allow leasing truly vacant units
    const vacantUnits = this.state.units.filter(u => u.status === 'vacant');
    if (vacantUnits.length === 0) {
      this.showToast('All units across your properties are currently occupied! No vacant units are available to lease.', 'warning');
      return;
    }

    unitSelect.innerHTML = vacantUnits.map(u => \`
      <option value="\${u.id}" \${preselectedUnitId && Number(preselectedUnitId) === u.id ? 'selected' : ''}>
        \${u.property_name} - Unit \${u.unit_number} (\${this.formatMoney(u.base_rent)}/mo) [Vacant]
      </option>
    \`).join('');`;

if (appJs.match(oldLeaseModalFnRegex)) {
  appJs = appJs.replace(oldLeaseModalFnRegex, newLeaseModalFn);
  console.log('[OK] Enforced strict vacant-only validation in openAddLeaseModal');
}

// Add viewing leads rendering and conversion methods
const viewingLeadsMethods = `
  // ==========================================
  // VIEWING LEADS & PROSPECT TOURS
  // ==========================================
  renderViewingLeads() {
    const tbody = document.getElementById('viewing-leads-table-body');
    const badge = document.getElementById('viewing-leads-count-badge');
    if (!tbody) return;

    const leads = this.state.viewingLeads || [];
    if (badge) badge.textContent = \`\${leads.length} Scheduled Tour\${leads.length === 1 ? '' : 's'}\`;

    if (leads.length === 0) {
      tbody.innerHTML = \`
        <tr>
          <td colspan="6" class="p-8 text-center text-slate-400 dark:text-zinc-500">
            <i data-lucide="calendar" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            <p class="font-semibold text-slate-700 dark:text-zinc-300">No House Viewing Appointments Booked Yet</p>
            <p class="text-xs text-slate-500 mt-0.5">When prospective renters book physical tours on the Public Vacancies Showcase, they will appear here.</p>
          </td>
        </tr>
      \`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = leads.map(l => {
      const statusBadge = l.status === 'confirmed'
        ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Confirmed</span>'
        : (l.status === 'completed'
            ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Tour Completed</span>'
            : '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">' + (l.status || 'Pending') + '</span>');

      return \`
        <tr class="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
          <td class="py-3 px-4">
            <p class="font-bold text-slate-800 dark:text-white">\${l.prospect_name}</p>
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
            \${l.notes || '<span class="text-slate-400 italic">No notes provided</span>'}
          </td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end space-x-1.5">
              <button onclick="app.vetViewingLead(\${l.id})" title="AI Tenant Vetting & CRB" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold border border-indigo-200 transition flex items-center space-x-1">
                <i data-lucide="sparkles" class="w-3 h-3"></i>
                <span>Vet</span>
              </button>
              <button onclick="app.convertLeadToTenant(\${l.id})" title="Register as Tenant & Lease" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-semibold border border-emerald-200 transition flex items-center space-x-1">
                <i data-lucide="user-plus" class="w-3 h-3"></i>
                <span>Lease</span>
              </button>
              <button onclick="app.markViewingStatus(\${l.id}, 'completed')" title="Mark Walkthrough Completed" class="p-1 hover:bg-slate-100 text-slate-500 rounded">
                <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600"></i>
              </button>
            </div>
          </td>
        </tr>
      \`;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  vetViewingLead(leadId) {
    const lead = (this.state.viewingLeads || []).find(l => l.id === Number(leadId));
    if (!lead) return;
    this.openTenantVettingModal();
    setTimeout(() => {
      const nameInput = document.getElementById('vet-applicant-name');
      const phoneInput = document.getElementById('vet-phone');
      const emailInput = document.getElementById('vet-email');
      const unitSelect = document.getElementById('vet-unit-select');
      if (nameInput) nameInput.value = lead.prospect_name || '';
      if (phoneInput) phoneInput.value = lead.phone || '';
      if (emailInput && lead.email) emailInput.value = lead.email;
      if (unitSelect && lead.unit_id) unitSelect.value = lead.unit_id;
    }, 100);
  }

  convertLeadToTenant(leadId) {
    const lead = (this.state.viewingLeads || []).find(l => l.id === Number(leadId));
    if (!lead) return;
    this.openAddTenantModal();
    setTimeout(() => {
      const nameInput = document.getElementById('tenant-name-input');
      const phoneInput = document.getElementById('tenant-phone-input');
      const emailInput = document.getElementById('tenant-email-input');
      if (nameInput) nameInput.value = lead.prospect_name || '';
      if (phoneInput) phoneInput.value = lead.phone || '';
      if (emailInput && lead.email) emailInput.value = lead.email;
    }, 100);
  }

  async markViewingStatus(leadId, status) {
    try {
      await this.fetchAPI(\`/api/viewing-leads/\${leadId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      this.showToast('Viewing tour status updated successfully!', 'success');
      await this.refreshAllData();
      this.renderViewingLeads();
    } catch (err) {
      this.showToast(err.message || 'Failed to update viewing lead', 'error');
    }
  }
`;

if (!appJs.includes('renderViewingLeads() {')) {
  // Insert before bottom aliases
  const aliasPos = appJs.indexOf('// Universal Backward Compatibility Prototype Aliases');
  if (aliasPos !== -1) {
    appJs = appJs.slice(0, aliasPos) + viewingLeadsMethods + '\n' + appJs.slice(aliasPos);
  } else {
    appJs += viewingLeadsMethods;
  }
  console.log('[OK] Added viewing leads methods to public/app.js');
}

// Hook renderViewingLeads into renderTenants
if (!appJs.includes('this.renderViewingLeads();')) {
  appJs = appJs.replace('this.renderTenants();', 'this.renderTenants();\n      this.renderViewingLeads();');
  console.log('[OK] Hooked renderViewingLeads() into app render cycle');
}

fs.writeFileSync('public/app.js', appJs, 'utf8');
console.log('[DONE] Applied all 3 core edits.');

