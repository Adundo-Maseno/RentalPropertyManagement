const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');

const targets = [
  'if (pathname === \'/api/properties\' && method === \'POST\')',
  'if (pathname === \'/api/units\' && method === \'POST\')',
  'if (pathname === \'/api/users\' && method === \'POST\')',
  '// Graceful fallback if portfolio is 100% occupied',
  'if (pathname.startsWith(\'/api/inspections/\') && pathname.endsWith(\'/settle-deposit\') && method === \'POST\')'
];

targets.forEach(t => {
  const idx = s.indexOf(t);
  console.log('=== ' + t + ' ===');
  console.log(s.substring(idx, idx + 350));
});
