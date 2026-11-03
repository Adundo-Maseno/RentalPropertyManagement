const fs = require('fs');

const rentals = fs.readFileSync('public/rentals.html', 'utf8');

// Check script tags, fetch endpoints, and inline handlers
const fetchRegex = /fetch\(['"]([^'"]+)['"]/g;
let match;
const endpoints = [];
while ((match = fetchRegex.exec(rentals)) !== null) {
  endpoints.push(match[1]);
}

console.log('Endpoints in rentals.html:', endpoints);

// Check inline handlers in rentals.html
const onRegex = /on(?:click|submit|change|input)=["']([^"']+)["']/g;
const handlers = [];
while ((match = onRegex.exec(rentals)) !== null) {
  handlers.push(match[1]);
}
console.log('Handlers in rentals.html:', handlers);

