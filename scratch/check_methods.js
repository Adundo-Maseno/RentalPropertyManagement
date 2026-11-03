const fs = require('fs');
const appJs = fs.readFileSync('public/app.js', 'utf8');

const methods = [
  'handleMpesaSubmit',
  'handleManualPaymentSubmit',
  'handleWaterSubmit',
  'handleTicketSubmit',
  'handleAddPropertySubmit',
  'handleAddUnitSubmit',
  'handleAddTenantSubmit',
  'handleAddUserSubmit',
  'handlePasswordLogin',
  'submitTenantVetting',
  'handleCreateLeaseSubmit',
  'handleCustomInvoiceSubmit',
  'handleAddExpenseSubmit',
  'handleBroadcastSubmit'
];

methods.forEach(m => {
  const hasMethod = appJs.includes(`${m}(`) || appJs.includes(`${m} =`);
  console.log(`Method ${m}: ${hasMethod ? 'EXISTS' : 'MISSING!'}`);
});

