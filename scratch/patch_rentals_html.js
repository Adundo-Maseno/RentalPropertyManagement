const fs = require('fs');

let html = fs.readFileSync('public/rentals.html', 'utf8');

// 1. Replace button onclick in renderVacancies
const oldBtn = `<button onclick="openViewingModal(\${v.id}, '\${v.unit_number}', '\${v.property_name}', '\${v.unit_type}')"`;
const newBtn = `<button onclick="openViewingModal(\${v.id})"`;

if (!html.includes(oldBtn)) {
  console.error('Target oldBtn not found in rentals.html');
  process.exit(1);
}
html = html.replace(oldBtn, newBtn);

// 2. Replace openViewingModal function
const oldFunc = `    function openViewingModal(unitId, unitNum, propName, unitType) {
      document.getElementById('viewing-unit-id').value = unitId;
      document.getElementById('modal-viewing-title').textContent = \`Schedule Viewing: Unit \${unitNum}\`;
      document.getElementById('modal-viewing-sub').textContent = \`\${unitType} &bull; \${propName}\`;
      document.getElementById('viewing-success-box').classList.add('hidden');
      document.getElementById('form-viewing').classList.remove('hidden');

      // Default date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      document.getElementById('viewing-date').value = tomorrow.toISOString().split('T')[0];

      document.getElementById('modal-viewing').classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }`;

const newFunc = `    function openViewingModal(unitId, unitNum, propName, unitType) {
      const v = (allVacancies || []).find(x => x.id === Number(unitId));
      const uNum = unitNum || (v ? v.unit_number : '');
      const pName = propName || (v ? v.property_name : '');
      const uType = unitType || (v ? v.unit_type : 'Apartment');

      document.getElementById('viewing-unit-id').value = unitId;
      document.getElementById('modal-viewing-title').textContent = \`Schedule Viewing: Unit \${uNum}\`;
      document.getElementById('modal-viewing-sub').textContent = \`\${uType} • \${pName}\`;
      document.getElementById('viewing-success-box').classList.add('hidden');
      document.getElementById('form-viewing').classList.remove('hidden');

      // Default date to tomorrow in local timezone
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      document.getElementById('viewing-date').value = \`\${yyyy}-\${mm}-\${dd}\`;

      document.getElementById('modal-viewing').classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }`;

if (!html.includes(oldFunc)) {
  console.error('Target oldFunc not found in rentals.html');
  process.exit(1);
}
html = html.replace(oldFunc, newFunc);

fs.writeFileSync('public/rentals.html', html, 'utf8');
console.log('Successfully updated public/rentals.html');
