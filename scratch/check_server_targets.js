const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');

function checkSection(target) {
  const idx = s.indexOf(target);
  console.log(`Target "${target}": found at ${idx}`);
}

checkSection('if (pathname === \'/api/properties\' && method === \'POST\')');
checkSection('if (pathname === \'/api/units\' && method === \'POST\')');
checkSection('if (pathname === \'/api/users\' && method === \'POST\')');
checkSection('// Graceful fallback if portfolio is 100% occupied');
checkSection('if (pathname.startsWith(\'/api/inspections/\') && pathname.endsWith(\'/settle-deposit\') && method === \'POST\')');
