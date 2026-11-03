const fs = require('fs');
const appJs = fs.readFileSync('public/app.js', 'utf8');

const forms = [
  'form-mpesa-stk',
  'form-manual-payment',
  'form-water-reading',
  'form-ticket',
  'form-add-property',
  'form-add-unit',
  'form-add-tenant',
  'form-add-user',
  'form-auth-login',
  'form-vetting',
  'form-create-lease',
  'form-custom-invoice',
  'form-add-expense',
  'form-broadcast-notice'
];

forms.forEach(formId => {
  const idx = appJs.indexOf(formId);
  console.log(`Form: ${formId} found at index: ${idx}`);
  if (idx !== -1) {
    const snippet = appJs.slice(Math.max(0, idx - 100), Math.min(appJs.length, idx + 400));
    console.log(`--- Snippet around ${formId} ---\n`, snippet, '\n');
  }
});

