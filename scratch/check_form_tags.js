const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

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

forms.forEach(f => {
  const re = new RegExp(`<form[^>]*id=["']${f}["'][^>]*>`, 'i');
  const match = html.match(re);
  if (match) {
    console.log(`FORM TAG: ${match[0]}`);
  } else {
    console.log(`FORM TAG NOT FOUND for ${f}`);
  }
});

