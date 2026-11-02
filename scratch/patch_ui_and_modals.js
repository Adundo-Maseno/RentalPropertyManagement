const fs = require('fs');

// 1. Patch public/index.html with modal-broadcast
let html = fs.readFileSync('public/index.html', 'utf8');

const modalBroadcastHTML = `
  <!-- MODAL: Broadcast Notice / Announcement to Tenants -->
  <div id="modal-broadcast" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 hidden flex items-center justify-center p-4">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <i data-lucide="radio" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white text-base">Broadcast Tenant Notice</h3>
            <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Send instant SMS or WhatsApp blast to all active tenants</p>
          </div>
        </div>
        <button onclick="app.closeModal('modal-broadcast')" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="form-broadcast-notice" onsubmit="app.handleBroadcastSubmit(event)" class="mt-4 space-y-4 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Target Property</label>
          <select id="broadcast-property-select" class="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-zinc-100 rounded-lg p-2.5">
            <option value="">All Managed Properties (All Active Tenants)</option>
          </select>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Delivery Channel</label>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex items-center space-x-2 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800">
              <input type="radio" name="broadcast-channel" value="sms" checked class="text-emerald-600">
              <span class="font-semibold text-slate-800 dark:text-zinc-200">SMS Gateway</span>
            </label>
            <label class="flex items-center space-x-2 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800">
              <input type="radio" name="broadcast-channel" value="whatsapp" class="text-emerald-600">
              <span class="font-semibold text-slate-800 dark:text-zinc-200">WhatsApp Business</span>
            </label>
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Announcement Message</label>
          <textarea id="broadcast-message-input" rows="4" required class="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-zinc-100 rounded-lg p-2.5 text-xs" placeholder="e.g. Dear Residents, routine overhead water tank cleaning is scheduled for Wednesday 9:00 AM to 1:00 PM. Water supply will be temporarily paused."></textarea>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0">
          <button type="button" onclick="app.closeModal('modal-broadcast')" class="px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-600 dark:text-zinc-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition">Cancel</button>
          <button type="submit" id="btn-broadcast-submit" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-md transition flex items-center space-x-1.5">
            <i data-lucide="send" class="w-3.5 h-3.5"></i>
            <span>Send Broadcast</span>
          </button>
        </div>
      </form>
    </div>
  </div>
`;

if (!html.includes('id="modal-broadcast"')) {
  const targetAnchor = 'id="modal-send-5th-sms"';
  const closeDivIndex = html.indexOf('</div>\r\n\r\n  <!-- MOBILE BOTTOM TAB NAVIGATION', html.indexOf(targetAnchor));
  const fallbackIndex = closeDivIndex !== -1 ? closeDivIndex : html.indexOf('</div>\n\n  <!-- MOBILE BOTTOM TAB NAVIGATION', html.indexOf(targetAnchor));
  if (fallbackIndex !== -1) {
    html = html.slice(0, fallbackIndex + 6) + modalBroadcastHTML + html.slice(fallbackIndex + 6);
    fs.writeFileSync('public/index.html', html, 'utf8');
    console.log('[OK] Inserted modal-broadcast into public/index.html');
  } else {
    console.error('[ERR] Could not find insertion point in public/index.html');
  }
} else {
  console.log('[INFO] modal-broadcast already present in public/index.html');
}

// 2. Patch public/app.js
let appJs = fs.readFileSync('public/app.js', 'utf8');

// Add constructor aliases if not present
const aliasConstructorCode = `
    // Robust Aliases for dashboard buttons and modal openers
    this.openMaintenanceModal = this.openNewTicketModal.bind(this);
    this.openCreateLeaseModal = this.openAddLeaseModal.bind(this);
    this.openCustomInvoiceModal = this.openCreateInvoiceModal.bind(this);
    this.openRecordExpenseModal = this.openAddExpenseModal.bind(this);
    this.open5thSmsModal = this.openBulk5thSMSModal.bind(this);
    this.dispatch5thDueSms = this.openBulk5thSMSModal.bind(this);
    this.dispatchBulk5thReminders = this.openBulk5thSMSModal.bind(this);
    this.openBroadcastNoticeModal = this.openBroadcastModal.bind(this);
`;

if (!appJs.includes('this.openCustomInvoiceModal = this.openCreateInvoiceModal.bind(this);')) {
  appJs = appJs.replace('this.deferredPwaPrompt = null;', 'this.deferredPwaPrompt = null;' + aliasConstructorCode);
  console.log('[OK] Added constructor aliases in public/app.js');
}

// Replace openBroadcastModal with modal implementation
const oldBroadcastPattern = /async openBroadcastModal\(\) \{[\s\S]*?openAddExpenseModal\(\) \{/;
const newBroadcastReplacement = `openBroadcastModal() {
    const propSelect = document.getElementById('broadcast-property-select');
    if (propSelect && this.state.properties) {
      propSelect.innerHTML = '<option value="">All Managed Properties (All Active Tenants)</option>' +
        this.state.properties.map(p => \`<option value="\${p.id}">\${p.name}</option>\`).join('');
    }
    const msgInput = document.getElementById('broadcast-message-input');
    if (msgInput) msgInput.value = '';
    this.openModal('modal-broadcast');
  }

  async handleBroadcastSubmit(e) {
    if (e) e.preventDefault();
    const propId = document.getElementById('broadcast-property-select')?.value;
    const channel = document.querySelector('input[name="broadcast-channel"]:checked')?.value || 'sms';
    const message = document.getElementById('broadcast-message-input')?.value?.trim();
    if (!message) {
      this.showToast('Please enter an announcement message.', 'warning');
      return;
    }

    const btn = document.getElementById('btn-broadcast-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Sending...</span>';
    }

    try {
      const payload = {
        type: channel,
        message: message
      };
      if (propId) payload.property_id = Number(propId);

      const res = await this.fetchAPI('/api/communications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      this.closeModal('modal-broadcast');
      this.showToast(\`Broadcast notice sent to \${res.recipients_reached || res.count || 0} registered tenants!\`, 'success');
      await this.refreshAllData();
      this.switchView('communications');
    } catch (err) {
      this.showToast(err.message || 'Failed to send broadcast.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Send Broadcast</span>';
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  openAddExpenseModal() {`;

if (appJs.match(oldBroadcastPattern)) {
  appJs = appJs.replace(oldBroadcastPattern, newBroadcastReplacement);
  console.log('[OK] Replaced prompt-based openBroadcastModal with modal-based implementation in public/app.js');
}

// Add prototype aliases at the bottom if not present
const protoAliases = `
// Universal Backward Compatibility Prototype Aliases
BomaSphereApp.prototype.openMaintenanceModal = BomaSphereApp.prototype.openNewTicketModal;
BomaSphereApp.prototype.openCreateLeaseModal = BomaSphereApp.prototype.openAddLeaseModal;
BomaSphereApp.prototype.openCustomInvoiceModal = BomaSphereApp.prototype.openCreateInvoiceModal;
BomaSphereApp.prototype.openRecordExpenseModal = BomaSphereApp.prototype.openAddExpenseModal;
BomaSphereApp.prototype.open5thSmsModal = BomaSphereApp.prototype.openBulk5thSMSModal;
BomaSphereApp.prototype.dispatch5thDueSms = BomaSphereApp.prototype.openBulk5thSMSModal;
BomaSphereApp.prototype.dispatchBulk5thReminders = BomaSphereApp.prototype.openBulk5thSMSModal;
BomaSphereApp.prototype.openBroadcastNoticeModal = BomaSphereApp.prototype.openBroadcastModal;
`;

if (!appJs.includes('BomaSphereApp.prototype.openCustomInvoiceModal')) {
  appJs += protoAliases;
  console.log('[OK] Added prototype aliases to bottom of public/app.js');
}

fs.writeFileSync('public/app.js', appJs, 'utf8');
console.log('[DONE] All UI & Modal patches applied.');

