const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

const target = '<!-- MODAL: Custom Billing Invoice -->';
if (!html.includes(target)) {
  console.error('Target not found in public/index.html');
  process.exit(1);
}

const modalHtml = `  <!-- MODAL: Move-In Payment & Digital Lease Prompt -->
  <div id="modal-movein-payment-prompt" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 hidden flex items-center justify-center p-4">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 max-h-[92vh] overflow-y-auto">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
            <i data-lucide="party-popper" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-800 dark:text-zinc-100">Tenant Onboarded &amp; Leased!</h3>
            <p class="text-xs text-slate-500 dark:text-zinc-400">Digital lease bound &amp; move-in ledger generated</p>
          </div>
        </div>
        <button type="button" onclick="app.closeModal('modal-movein-payment-prompt')" class="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="mt-4 space-y-4">
        <!-- Summary Box -->
        <div class="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-slate-100 dark:border-zinc-800">
          <div class="grid grid-cols-2 gap-3 text-xs mb-3">
            <div>
              <span class="text-slate-500 dark:text-zinc-400 block font-medium">Tenant Name</span>
              <span id="prompt-tenant-name" class="font-bold text-slate-800 dark:text-zinc-100 text-sm">--</span>
              <span id="prompt-tenant-phone" class="font-mono text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">--</span>
            </div>
            <div>
              <span class="text-slate-500 dark:text-zinc-400 block font-medium">Assigned Unit</span>
              <span id="prompt-unit-property" class="font-bold text-slate-800 dark:text-zinc-100 text-sm">--</span>
            </div>
          </div>
          <div class="pt-2 border-t border-slate-200 dark:border-zinc-700/60 flex items-center justify-between text-[11px]">
            <div>
              <span class="text-slate-500 dark:text-zinc-400">Lease Ref: </span>
              <span id="prompt-agreement-code" class="font-mono font-semibold text-indigo-600 dark:text-indigo-400">--</span>
            </div>
            <div>
              <span class="text-slate-500 dark:text-zinc-400">Invoice: </span>
              <span id="prompt-invoice-number" class="font-mono font-semibold text-slate-700 dark:text-zinc-300">--</span>
            </div>
          </div>
        </div>

        <!-- Breakdown Box -->
        <div class="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-4">
          <div class="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
            <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
            <span>Initial Move-In Settlement Breakdown</span>
          </div>
          <div class="space-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
            <div class="flex justify-between">
              <span>First Month Rent:</span>
              <span id="prompt-breakdown-rent" class="font-mono font-semibold">KES 0</span>
            </div>
            <div class="flex justify-between">
              <span>Security Deposit:</span>
              <span id="prompt-breakdown-deposit" class="font-mono font-semibold">KES 0</span>
            </div>
            <div class="flex justify-between">
              <span>Water Utility Deposit:</span>
              <span id="prompt-breakdown-water" class="font-mono font-semibold">KES 0</span>
            </div>
            <div class="pt-2 border-t border-emerald-200/70 dark:border-emerald-800/50 flex justify-between items-center text-sm">
              <span class="font-bold text-emerald-900 dark:text-emerald-200">Total Move-In Payable:</span>
              <span id="prompt-invoice-total" class="font-mono font-black text-emerald-700 dark:text-emerald-300 text-base">KES 0</span>
            </div>
          </div>
        </div>

        <!-- Call to Action Prompt Buttons -->
        <div class="space-y-2 pt-1">
          <button type="button" onclick="app.onMoveInPromptAction('mpesa')" class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2">
            <i data-lucide="smartphone" class="w-4 h-4"></i>
            <span>Prompt Lipa Na M-Pesa STK Push</span>
          </button>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" onclick="app.onMoveInPromptAction('manual')" class="py-2.5 px-3 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700/60 text-slate-800 dark:text-zinc-100 rounded-xl font-semibold text-xs transition flex items-center justify-center space-x-1.5 shadow-xs">
              <i data-lucide="receipt" class="w-4 h-4 text-slate-500"></i>
              <span>Record Bank/Cash Receipt</span>
            </button>
            <button type="button" onclick="app.onMoveInPromptAction('sign')" class="py-2.5 px-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl font-semibold text-xs transition flex items-center justify-center space-x-1.5 shadow-xs">
              <i data-lucide="edit-3" class="w-4 h-4 text-indigo-500"></i>
              <span>Digital Lease &amp; E-Sign</span>
            </button>
          </div>
          <button type="button" onclick="app.closeModal('modal-movein-payment-prompt')" class="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition">
            Dismiss &amp; Review on Dashboard Later
          </button>
        </div>
      </div>
    </div>
  </div>

  `;

html = html.replace(target, modalHtml + target);
fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Successfully inserted modal-movein-payment-prompt into public/index.html');

