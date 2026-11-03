const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const forms = html.match(/id=["'][^"']*form[^"']*["']/gi) || [];
console.log('Forms:', forms);

const modals = html.match(/id=["']modal-[^"']*["']/gi) || [];
console.log('Modals:', modals);

