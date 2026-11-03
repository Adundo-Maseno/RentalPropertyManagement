const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Mobile top header Sign Out button
const oldMobileHeaderChip = `<span id="mobile-user-role-chip" class="max-w-[70px] truncate">Manager</span>\r\n      </button>`;
const oldMobileHeaderChipLF = `<span id="mobile-user-role-chip" class="max-w-[70px] truncate">Manager</span>\n      </button>`;
const newMobileSignOutBtn = `\r\n      <!-- Mobile Sign Out Button -->\r\n      <button onclick="app.logout()" class="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md text-xs font-semibold flex items-center space-x-1 transition" title="Sign Out">\r\n        <i data-lucide="log-out" class="w-3.5 h-3.5"></i>\r\n        <span class="text-[10px]">Exit</span>\r\n      </button>`;

if (html.includes(oldMobileHeaderChip)) {
  html = html.replace(oldMobileHeaderChip, oldMobileHeaderChip + newMobileSignOutBtn);
} else if (html.includes(oldMobileHeaderChipLF)) {
  html = html.replace(oldMobileHeaderChipLF, oldMobileHeaderChipLF + newMobileSignOutBtn.replace(/\r\n/g, '\n'));
}

// 2. Sidebar Footer User Profile Sign Out Button
const oldSidebarFooter = `<div id="sidebar-user-avatar" class="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">\r\n              PM\r\n            </div>\r\n            <div class="min-w-0">\r\n              <p id="sidebar-user-name" class="font-semibold text-slate-800 dark:text-zinc-200 text-xs truncate max-w-[110px]">Patrick Ndegwa</p>\r\n              <p id="sidebar-user-role" class="text-[10px] text-slate-500 truncate">Property Manager</p>\r\n            </div>\r\n          </div>\r\n          <div class="flex items-center space-x-1 shrink-0">\r\n            <button onclick="app.logout()" title="Sign Out of Session" class="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition">\r\n              <i data-lucide="log-out" class="w-4 h-4"></i>\r\n            </button>\r\n          </div>\r\n        </div>\r\n      </div>`;

const newSidebarFooter = `<div id="sidebar-user-avatar" class="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">\r\n              PM\r\n            </div>\r\n            <div class="min-w-0 flex-1">\r\n              <p id="sidebar-user-name" class="font-semibold text-slate-800 dark:text-zinc-200 text-xs truncate">Patrick Ndegwa</p>\r\n              <p id="sidebar-user-role" class="text-[10px] text-slate-500 truncate">Property Manager</p>\r\n            </div>\r\n          </div>\r\n        </div>\r\n        <button onclick="app.logout()" class="w-full mt-2.5 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition">\r\n          <i data-lucide="log-out" class="w-3.5 h-3.5"></i>\r\n          <span>Sign Out</span>\r\n        </button>\r\n      </div>`;

if (html.includes(oldSidebarFooter)) {
  html = html.replace(oldSidebarFooter, newSidebarFooter);
} else {
  const oldSidebarFooterLF = oldSidebarFooter.replace(/\r\n/g, '\n');
  const newSidebarFooterLF = newSidebarFooter.replace(/\r\n/g, '\n');
  if (html.includes(oldSidebarFooterLF)) {
    html = html.replace(oldSidebarFooterLF, newSidebarFooterLF);
  }
}

// 3. Desktop Header Prominent Sign Out Button
const oldHeaderProfile = `<div class="flex items-center space-x-2 py-1 px-2.5 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs">\r\n            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>\r\n            <span class="font-semibold text-slate-800 dark:text-zinc-200" id="header-user-name">Patrick Ndegwa</span>\r\n            <span class="text-[11px] text-slate-500" id="header-user-role">(Property Manager)</span>\r\n            <button onclick="app.logout()" class="ml-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition" title="Sign Out">\r\n              <i data-lucide="log-out" class="w-3.5 h-3.5"></i>\r\n            </button>\r\n          </div>`;

const newHeaderProfile = `<div class="flex items-center space-x-2 py-1 px-2.5 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs">\r\n            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>\r\n            <span class="font-semibold text-slate-800 dark:text-zinc-200" id="header-user-name">Patrick Ndegwa</span>\r\n            <span class="text-[11px] text-slate-500" id="header-user-role">(Property Manager)</span>\r\n          </div>\r\n\r\n          <!-- Visible Sign Out Button -->\r\n          <button onclick="app.logout()" class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 rounded-md font-bold text-xs flex items-center space-x-1.5 transition shadow-2xs" title="Sign Out of Session">\r\n            <i data-lucide="log-out" class="w-3.5 h-3.5 text-rose-600 dark:text-rose-400"></i>\r\n            <span>Sign Out</span>\r\n          </button>`;

if (html.includes(oldHeaderProfile)) {
  html = html.replace(oldHeaderProfile, newHeaderProfile);
} else {
  const oldHeaderProfileLF = oldHeaderProfile.replace(/\r\n/g, '\n');
  const newHeaderProfileLF = newHeaderProfile.replace(/\r\n/g, '\n');
  if (html.includes(oldHeaderProfileLF)) {
    html = html.replace(oldHeaderProfileLF, newHeaderProfileLF);
  }
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('[OK] Enhanced Sign Out buttons across public/index.html');

