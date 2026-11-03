const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Add unit selector to modal-add-tenant
const targetTenantForm = `        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Emergency Contact Name</label>
            <input type="text" id="tenant-emg-name" placeholder="Relative / Kin" class="w-full border border-slate-300 rounded-lg p-2.5">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Emergency Contact Phone</label>
            <input type="text" id="tenant-emg-phone" placeholder="+2547XXXXXXXX" class="w-full border border-slate-300 rounded-lg p-2.5 font-mono">
          </div>
        </div>`.replace(/\r\n/g, '\n');

const replacementTenantForm = `        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Emergency Contact Name</label>
            <input type="text" id="tenant-emg-name" placeholder="Relative / Kin" class="w-full border border-slate-300 rounded-lg p-2.5">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Emergency Contact Phone</label>
            <input type="text" id="tenant-emg-phone" placeholder="+2547XXXXXXXX" class="w-full border border-slate-300 rounded-lg p-2.5 font-mono">
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100">
          <label class="block font-semibold text-slate-700 mb-1">Assign Vacant Unit &amp; Execute Lease (Optional)</label>
          <select id="tenant-unit-select" onchange="app.onTenantModalUnitChange()" class="w-full border border-slate-300 rounded-lg p-2.5 font-medium">
            <option value="">-- Register Without Lease (Assign Unit Later) --</option>
          </select>
        </div>

        <div id="tenant-lease-fields" class="hidden grid grid-cols-2 gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <label class="block font-semibold text-slate-600 mb-1">Monthly Rent (KES)</label>
            <input type="number" id="tenant-rent-input" placeholder="65000" class="w-full border border-slate-300 bg-white rounded-lg p-2 font-mono text-xs">
          </div>
          <div>
            <label class="block font-semibold text-slate-600 mb-1">Security Deposit (KES)</label>
            <input type="number" id="tenant-deposit-input" placeholder="65000" class="w-full border border-slate-300 bg-white rounded-lg p-2 font-mono text-xs">
          </div>
        </div>`.replace(/\r\n/g, '\n');

// 2. Add resident selector to modal-new-amenity-booking
const targetAmenityForm = `      <form onsubmit="app.submitAmenityBooking(event)" class="mt-4 space-y-3.5 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Select Facility</label>`.replace(/\r\n/g, '\n');

const replacementAmenityForm = `      <form onsubmit="app.submitAmenityBooking(event)" class="mt-4 space-y-3.5 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Resident / Tenant</label>
          <select id="book-amenity-tenant-id" class="w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg p-2 text-xs">
            <!-- dynamic tenants -->
          </select>
        </div>
        <div>
          <label class="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Select Facility</label>`.replace(/\r\n/g, '\n');

// Normalize html to LF for replacement
const normalized = html.replace(/\r\n/g, '\n');

let updated = normalized;
if (normalized.includes(targetTenantForm)) {
  updated = updated.replace(targetTenantForm, replacementTenantForm);
  console.log('Successfully updated tenant form in index.html');
} else {
  console.error('Failed to match targetTenantForm');
}

if (updated.includes(targetAmenityForm)) {
  updated = updated.replace(targetAmenityForm, replacementAmenityForm);
  console.log('Successfully updated amenity form in index.html');
} else {
  console.error('Failed to match targetAmenityForm');
}

fs.writeFileSync('public/index.html', updated, 'utf8');
console.log('Updated public/index.html successfully');

