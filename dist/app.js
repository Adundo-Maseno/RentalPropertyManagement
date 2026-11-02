/**
 * BomaSphere Property Management System (PMS)
 * Frontend Application Core
 */

// Defense-in-depth HTML sanitization utility to prevent DOM-based XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

class BomaSphereApp {
  constructor() {
    this.escapeHtml = escapeHtml;
    this.state = {
      currentView: 'dashboard',
      authToken: localStorage.getItem('bomasphere_token') || null,
      authUser: null,
      stats: null,
      properties: [],
      units: [],
      tenants: [],
      leases: [],
      invoices: [],
      payments: [],
      waterReadings: [],
      maintenance: [],
      communications: [],
      expenses: [],
      users: [],
      currentResidentId: 1, // Default tenant for self-service portal
      currency: localStorage.getItem('bomasphere_currency') || 'KES',
      fxRates: { KES: 1, USD: 129.50, GBP: 168.20, EUR: 141.00 },
      leaseAgreements: [],
      inspections: [],
      visitorPasses: [],
      amenities: [],
      amenityBookings: []
    };

    this.charts = {
      revenue: null,
      occupancy: null
    };

    this.deferredPwaPrompt = null;

    this.init();
  }

  async init() {
    this.restoreThemeAndMode();
    this.initServiceWorkerAndPwa();
    this.setupNavigation();
    this.setupDateDisplay();
    this.syncCurrencySelector();
    await this.initAuthSession();
    await this.refreshAllData();
    this.initCharts();
    this.setupEventListeners();
  }

  syncCurrencySelector() {
    const sel = document.getElementById('currency-selector');
    if (sel) {
      sel.value = this.state.currency || 'KES';
    }
  }

  // ==========================================
  // NAVIGATION & VIEW SWITCHING
  // ==========================================
  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        const view = link.dataset.view;
        this.switchView(view);
      });
    });

    // Mobile bottom navigation tabs
    const mobileTabBtns = document.querySelectorAll('.mobile-tab-btn');
    mobileTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) {
          this.switchView(view);
        }
      });
    });

    // Mobile drawer backdrop dismiss
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.toggleMobileDrawer(false);
      });
    }
  }

  toggleMobileDrawer(open) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;

    const isOpen = !sidebar.classList.contains('-translate-x-full');
    const shouldOpen = open !== undefined ? open : !isOpen;

    if (shouldOpen) {
      if (backdrop) backdrop.classList.remove('hidden');
      requestAnimationFrame(() => {
        if (backdrop) backdrop.classList.remove('opacity-0');
        sidebar.classList.remove('-translate-x-full');
      });
      document.body.classList.add('overflow-hidden', 'lg:overflow-auto');
    } else {
      if (backdrop) backdrop.classList.add('opacity-0');
      sidebar.classList.add('-translate-x-full');
      document.body.classList.remove('overflow-hidden', 'lg:overflow-auto');
      setTimeout(() => {
        if (backdrop && sidebar.classList.contains('-translate-x-full')) {
          backdrop.classList.add('hidden');
        }
      }, 250);
    }
  }

  switchView(viewName) {
    const userRole = this.state.authUser?.role || 'property_manager';
    const permissions = {
      super_admin: ['dashboard', 'properties', 'tenants', 'invoices', 'payments', 'water', 'maintenance', 'communications', 'landlord', 'expenses', 'higgsfield', 'users', 'tenant-portal', 'leases', 'inspections', 'visitor-passes', 'amenities'],
      property_manager: ['dashboard', 'properties', 'tenants', 'invoices', 'payments', 'water', 'maintenance', 'communications', 'landlord', 'expenses', 'higgsfield', 'users', 'tenant-portal', 'leases', 'inspections', 'visitor-passes', 'amenities'],
      caretaker: ['dashboard', 'properties', 'water', 'maintenance', 'communications', 'inspections', 'visitor-passes'],
      landlord: ['dashboard', 'properties', 'landlord', 'maintenance', 'expenses', 'higgsfield'],
      tenant: ['tenant-portal', 'visitor-passes', 'amenities']
    };

    const allowed = permissions[userRole] || permissions.property_manager;
    if (!allowed.includes(viewName)) {
      const banner = document.getElementById('rbac-restriction-banner');
      const msgEl = document.getElementById('rbac-restriction-message');
      if (banner && msgEl) {
        msgEl.textContent = `Access Restricted (403): Role '${userRole}' is not authorized to access '${viewName}'.`;
        banner.classList.remove('hidden');
      }
      this.showToast(`Access Restricted: '${viewName}' is not accessible by ${userRole}.`, 'error');
      if (!allowed.includes(this.state.currentView)) {
        this.switchView(allowed[0]);
      }
      return;
    } else {
      const banner = document.getElementById('rbac-restriction-banner');
      if (banner && !banner.dataset.manual) {
        banner.classList.add('hidden');
      }
    }

    this.state.currentView = viewName;

    // Update active nav link (desktop)
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update active mobile tab button
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
      if (btn.dataset.view === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Auto-close mobile drawer if open
    this.toggleMobileDrawer(false);

    // Scroll main viewport to top
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Hide all view panels and show the active one
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const activePanel = document.getElementById(`view-${viewName}`);
    if (activePanel) {
      activePanel.classList.remove('hidden');
      if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.fromTo(activePanel, 
          { opacity: 0, y: 8 }, 
          { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' }
        );
      }
    }

    // Update Topbar Title
    const titleMap = {
      dashboard: 'Executive Dashboard',
      properties: 'Portfolio Properties & Units',
      tenants: 'Tenants & Lease Agreements',
      invoices: 'Invoices & Rent Ledger',
      payments: 'M-Pesa & Payment Hub',
      water: 'Water Meter Utility Billing',
      maintenance: 'Maintenance & Work Orders',
      communications: 'SMS & WhatsApp Communications',
      landlord: 'Landlord Remittance Statements',
      expenses: 'Property Operating Expenses',
      higgsfield: 'Higgsfield.ai 4K Tour Studio',
      users: 'Roles & SaaS User Management',
      'tenant-portal': 'Resident Self-Service Portal',
      leases: 'Digital Lease Agreements & E-Signatures',
      inspections: 'Move-In / Move-Out Condition Audits & Deposit Settlement',
      'visitor-passes': 'Gated Estate Visitor Passes & QR Security',
      amenities: 'Shared Estate Amenities & Clubhouse Bookings'
    };

    const titleEl = document.getElementById('page-title');
    if (titleEl) {
      titleEl.innerHTML = `<span>${titleMap[viewName] || 'Dashboard'}</span>`;
    }

    // Trigger re-render of current view
    this.renderCurrentView();

    // Re-render lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  setupDateDisplay() {
    const dateEl = document.getElementById('live-date-display');
    if (dateEl) {
      const now = new Date();
      const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
      dateEl.textContent = now.toLocaleDateString('en-KE', options);
    }
  }

  // ==========================================
  // DATA FETCHING & SYNC (WITH RBAC HEADERS)
  // ==========================================
  async fetchAPI(endpoint, options = {}) {
    try {
      options.headers = options.headers || {};
      if (this.state.authToken) {
        options.headers['Authorization'] = `Bearer ${this.state.authToken}`;
      }
      const res = await fetch(endpoint, options);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          const banner = document.getElementById('rbac-restriction-banner');
          const msgEl = document.getElementById('rbac-restriction-message');
          if (banner && msgEl) {
            banner.classList.remove('hidden');
            msgEl.textContent = errorData.error || 'Access Denied: Insufficient role permissions for this resource.';
          }
        }
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API Fetch Error (${endpoint}):`, err);
      if (!err.message.includes('403 Forbidden')) {
        this.showToast(err.message || 'Network request failed', 'error');
      }
      throw err;
    }
  }

  async refreshAllData() {
    try {
      // Clear restriction banner
      const banner = document.getElementById('rbac-restriction-banner');
      if (banner) banner.classList.add('hidden');

      const role = this.state.authUser ? this.state.authUser.role : 'property_manager';

      // Always fetch base operational entities
      const [statsData, properties, units, tenants, waterReadings, maintenance, comms, leaseAgreements, inspections, visitorPasses, amenities, amenityBookings] = await Promise.all([
        this.fetchAPI('/api/stats').catch(() => ({ stats: null, recentPayments: [], recentTickets: [] })),
        this.fetchAPI('/api/properties').catch(() => []),
        this.fetchAPI('/api/units').catch(() => []),
        this.fetchAPI('/api/tenants').catch(() => []),
        this.fetchAPI('/api/water-readings').catch(() => []),
        this.fetchAPI('/api/maintenance').catch(() => []),
        this.fetchAPI('/api/communications').catch(() => []),
        this.fetchAPI('/api/leases/agreements').catch(() => []),
        this.fetchAPI('/api/inspections').catch(() => []),
        this.fetchAPI('/api/visitor-passes').catch(() => []),
        this.fetchAPI('/api/amenities').catch(() => []),
        this.fetchAPI('/api/amenity-bookings').catch(() => [])
      ]);

      // Role-enforced data retrieval
      let invoices = [];
      let payments = [];
      let expenses = [];
      let users = [];

      if (role !== 'caretaker') {
        invoices = await this.fetchAPI('/api/invoices').catch(() => []);
        payments = await this.fetchAPI('/api/payments').catch(() => []);
      }
      if (role === 'property_manager' || role === 'super_admin' || role === 'landlord') {
        expenses = await this.fetchAPI('/api/expenses').catch(() => []);
      }
      if (role === 'property_manager' || role === 'super_admin') {
        users = await this.fetchAPI('/api/users').catch(() => []);
      }

      this.state.stats = statsData.stats;
      this.state.recentPayments = statsData.recentPayments || [];
      this.state.recentTickets = statsData.recentTickets || [];
      this.state.monthlyGraph = statsData.monthlyGraph;
      this.state.properties = Array.isArray(properties) ? properties : [];
      this.state.units = Array.isArray(units) ? units : [];
      this.state.tenants = Array.isArray(tenants) ? tenants : [];
      this.state.invoices = Array.isArray(invoices) ? invoices : [];
      this.state.payments = Array.isArray(payments) ? payments : [];
      this.state.waterReadings = Array.isArray(waterReadings) ? waterReadings : [];
      this.state.maintenance = Array.isArray(maintenance) ? maintenance : [];
      this.state.communications = Array.isArray(comms) ? comms : [];
      this.state.expenses = Array.isArray(expenses) ? expenses : [];
      this.state.users = Array.isArray(users) ? users : [];
      this.state.leaseAgreements = Array.isArray(leaseAgreements?.agreements) ? leaseAgreements.agreements : (Array.isArray(leaseAgreements) ? leaseAgreements : []);
      this.state.inspections = Array.isArray(inspections?.inspections) ? inspections.inspections : (Array.isArray(inspections) ? inspections : []);
      this.state.visitorPasses = Array.isArray(visitorPasses?.passes) ? visitorPasses.passes : (Array.isArray(visitorPasses) ? visitorPasses : []);
      this.state.amenities = Array.isArray(amenities?.amenities) ? amenities.amenities : (Array.isArray(amenities) ? amenities : []);
      this.state.amenityBookings = Array.isArray(amenityBookings?.bookings) ? amenityBookings.bookings : (Array.isArray(amenityBookings) ? amenityBookings : []);

      this.updateSidebarSummary();
      this.renderCurrentView();
      this.updateCharts();

    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }

  updateSidebarSummary() {
    const s = this.state.stats;
    if (!s) return;

    const unitsCountEl = document.getElementById('sidebar-units-count');
    const occBadgeEl = document.getElementById('sidebar-occupancy-badge');
    if (unitsCountEl) unitsCountEl.textContent = `${s.total_units || 0} Units Total`;
    if (occBadgeEl) occBadgeEl.textContent = `${s.occupancy_rate || 0}% Occupied`;

    // Overdue count badge (defensive Array check)
    const invList = Array.isArray(this.state.invoices) ? this.state.invoices : [];
    const overdueCount = invList.filter(i => i.status === 'overdue').length;
    const navOverdue = document.getElementById('nav-overdue-count');
    if (navOverdue) {
      navOverdue.textContent = overdueCount;
      navOverdue.style.display = overdueCount > 0 ? 'inline-block' : 'none';
    }

    const mobileOverdueDot = document.getElementById('mobile-nav-overdue-dot');
    if (mobileOverdueDot) {
      mobileOverdueDot.classList.toggle('hidden', overdueCount === 0);
    }

    // Active tickets badge
    const navTickets = document.getElementById('nav-tickets-badge');
    if (navTickets) navTickets.textContent = s.active_tickets || 0;
  }

  // ==========================================
  // VIEW RENDERERS
  // ==========================================
  renderCurrentView() {
    switch (this.state.currentView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'properties':
        this.renderProperties();
        this.renderUnits();
        break;
      case 'tenants':
        this.renderTenants();
        break;
      case 'invoices':
        this.renderInvoices();
        break;
      case 'payments':
        this.renderPayments();
        break;
      case 'water':
        this.renderWaterReadings();
        break;
      case 'maintenance':
        this.renderMaintenance();
        break;
      case 'communications':
        this.renderCommunications();
        break;
      case 'landlord':
        this.renderLandlordStatementsInit();
        break;
      case 'expenses':
        this.renderExpenses();
        break;
      case 'higgsfield':
        this.renderHiggsfield();
        break;
      case 'users':
        this.renderUsers();
        break;
      case 'tenant-portal':
        this.renderTenantPortal();
        break;
      case 'leases':
        this.renderLeases();
        break;
      case 'inspections':
        this.renderInspections();
        break;
      case 'visitor-passes':
        this.renderVisitorPasses();
        break;
      case 'amenities':
        this.renderAmenities();
        break;
    }
  }

  animateCounter(elementId, targetValue, prefix = '', suffix = '', decimals = 0) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = `${prefix}${typeof targetValue === 'number' ? targetValue.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : targetValue}${suffix}`;
      return;
    }
    const currentVal = parseFloat((el.textContent || '0').replace(/[^0-9.-]+/g, '')) || 0;
    const obj = { val: currentVal };
    gsap.to(obj, {
      val: targetValue,
      duration: 0.45,
      ease: 'power2.out',
      onUpdate: () => {
        const formatted = obj.val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        el.textContent = `${prefix}${formatted}${suffix}`;
      }
    });
  }

  getCurrencySymbol() {
    const c = this.state.currency || 'KES';
    if (c === 'USD') return '$';
    if (c === 'GBP') return '£';
    if (c === 'EUR') return '€';
    return 'KES ';
  }

  convertCurrency(amtKes) {
    const val = Number(amtKes) || 0;
    const c = this.state.currency || 'KES';
    if (c === 'USD') return val / 129.50;
    if (c === 'GBP') return val / 168.20;
    if (c === 'EUR') return val / 141.00;
    return val;
  }

  updateDashboardKPIs() {
    const s = this.state.stats;
    if (!s) return;
    const sym = this.getCurrencySymbol();
    const isKes = (this.state.currency || 'KES') === 'KES';
    const decimals = isKes ? 0 : 2;

    const convCollected = this.convertCurrency(s.total_collected);
    const convBilled = this.convertCurrency(s.total_billed);
    const convArrears = this.convertCurrency(s.total_arrears);

    this.animateCounter('dash-total-collected', convCollected, sym, '', decimals);
    const billedEl = document.getElementById('dash-total-billed');
    if (billedEl) {
      billedEl.textContent = `${sym}${convBilled.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    }
    this.animateCounter('dash-total-arrears', convArrears, sym, '', decimals);
  }

  // 1. Dashboard
  renderDashboard() {
    const s = this.state.stats;
    if (!s) return;

    this.animateCounter('dash-occupancy-rate', s.occupancy_rate, '', '%');
    document.getElementById('dash-occupied-units').textContent = s.occupied_units;
    document.getElementById('dash-vacant-units').textContent = s.vacant_units;

    this.updateDashboardKPIs();
    const collRate = s.collection_rate !== undefined ? s.collection_rate : (s.total_billed ? ((s.total_collected / s.total_billed) * 100).toFixed(1) : 0);
    document.getElementById('dash-collection-rate').textContent = `${collRate}%`;

    const invList = Array.isArray(this.state.invoices) ? this.state.invoices : [];
    const overdueCount = invList.filter(i => i.status === 'overdue').length;
    document.getElementById('dash-overdue-units-count').textContent = overdueCount;

    this.animateCounter('dash-active-tickets', s.active_tickets);

    // Occupancy legend
    document.getElementById('dash-occupancy-legend-occ').textContent = `${s.occupied_units} units`;
    document.getElementById('dash-occupancy-legend-vac').textContent = `${s.vacant_units} units`;
    document.getElementById('dash-occupancy-legend-maint').textContent = `${s.maintenance_units} units`;

    // Render Recent Payments Feed
    const paymentsContainer = document.getElementById('dash-recent-payments');
    if (paymentsContainer && this.state.recentPayments) {
      if (this.state.recentPayments.length === 0) {
        paymentsContainer.innerHTML = '<div class="py-4 text-center text-xs text-slate-400">No payments recorded yet.</div>';
      } else {
        paymentsContainer.innerHTML = this.state.recentPayments.map(p => `
          <div class="py-3 flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 rounded-full ${p.payment_method === 'M-Pesa' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center font-bold text-xs">
                ${p.payment_method === 'M-Pesa' ? 'MP' : 'BK'}
              </div>
              <div>
                <p class="font-bold text-xs text-slate-800">${p.payer_name || p.tenant_name}</p>
                <p class="text-[11px] text-slate-400">${p.property_name || 'Kilimani'} &bull; Unit ${p.unit_number || 'A101'} &bull; <span class="font-mono text-emerald-600 font-semibold">${p.reference_code || ''}</span></p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-extrabold text-xs text-emerald-600">+${this.formatMoney(p.amount)}</p>
              <p class="text-[10px] text-slate-400">${new Date(p.payment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        `).join('');
      }
    }

    // Render Recent Tickets Feed
    const ticketsContainer = document.getElementById('dash-recent-tickets');
    if (ticketsContainer && this.state.recentTickets) {
      if (this.state.recentTickets.length === 0) {
        ticketsContainer.innerHTML = '<div class="py-4 text-center text-xs text-slate-400">No active work orders.</div>';
      } else {
        ticketsContainer.innerHTML = this.state.recentTickets.map(t => `
          <div class="py-3 flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <span class="w-2.5 h-2.5 rounded-full ${t.priority === 'emergency' ? 'bg-rose-500 animate-urgent' : (t.priority === 'high' ? 'bg-amber-500' : 'bg-slate-400')}"></span>
              <div>
                <p class="font-bold text-xs text-slate-800 truncate max-w-xs">${t.title}</p>
                <p class="text-[11px] text-slate-400">${t.property_name} &bull; Unit ${t.unit_number} &bull; <span class="capitalize text-slate-600 font-medium">${t.category}</span></p>
              </div>
            </div>
            <div class="text-right">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${this.getTicketBadgeClass(t.status)} uppercase">${t.status.replace('_', ' ')}</span>
              <p class="text-[10px] text-slate-400 mt-1">${t.assigned_contractor ? t.assigned_contractor.split(' ')[0] : 'Unassigned'}</p>
            </div>
          </div>
        `).join('');
      }
    }
  }

  // 2. Properties & Units
  renderProperties() {
    const grid = document.getElementById('properties-grid');
    if (!grid) return;

    grid.innerHTML = this.state.properties.map(p => {
      const occPct = p.total_units > 0 ? ((p.occupied_units / p.total_units) * 100).toFixed(0) : 0;
      return `
        <div class="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs text-slate-400">
              <span class="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-600">${p.property_type}</span>
              <span class="font-bold text-emerald-600">${occPct}% Occupied</span>
            </div>
            <h3 class="font-bold text-slate-800 text-base mt-2">${p.name}</h3>
            <p class="text-xs text-slate-500 mt-0.5"><i data-lucide="map-pin" class="w-3 h-3 inline mr-1 text-slate-400"></i>${p.address}, ${p.city}</p>

            <div class="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div class="flex justify-between">
                <span>Landlord:</span>
                <strong class="text-slate-800 truncate max-w-[140px]">${p.landlord_name}</strong>
              </div>
              <div class="flex justify-between">
                <span>Units Breakdown:</span>
                <span><strong>${p.occupied_units}</strong> occ / <strong>${p.vacant_units}</strong> vac</span>
              </div>
              <div class="flex justify-between">
                <span>Paybill / Bank:</span>
                <span class="font-mono text-[11px] text-slate-700 truncate max-w-[150px]">${p.paybill_number || p.bank_name || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-xs text-slate-500 font-medium">Comm. Fee: <strong>${p.management_fee_pct}%</strong></span>
            <button onclick="app.viewPropertyStatement(${p.id})" class="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center">
              <span>Statement</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5 ml-1"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderUnits() {
    const tbody = document.getElementById('units-table-body');
    const filterStatus = document.getElementById('filter-units-status')?.value || 'all';
    const filterProperty = document.getElementById('filter-units-property')?.value || 'all';
    if (!tbody) return;

    let filtered = this.state.units;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(u => u.status === filterStatus);
    }
    if (filterProperty !== 'all') {
      filtered = filtered.filter(u => String(u.property_id) === filterProperty);
    }

    const countEl = document.getElementById('units-table-count');
    if (countEl) countEl.textContent = `(${filtered.length} Units)`;

    tbody.innerHTML = filtered.map(u => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4 font-bold text-slate-800">${u.unit_number}</td>
        <td class="py-3 px-4 text-slate-600">${u.property_name}</td>
        <td class="py-3 px-4 text-slate-600">
          <div>${u.unit_type}</div>
          <span class="text-[10px] text-slate-400">${u.floor}</span>
        </td>
        <td class="py-3 px-4 font-bold text-slate-800">${this.formatMoney(u.base_rent)}</td>
        <td class="py-3 px-4 text-slate-600 text-[11px]">
          <div>Serv: ${this.formatMoney(u.service_charge)}</div>
          <div>Garb: ${this.formatMoney(u.garbage_fee)}</div>
        </td>
        <td class="py-3 px-4 font-mono text-slate-600 text-[11px]">${u.meter_number || 'N/A'}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase ${this.getUnitBadgeClass(u.status)}">
            ${u.status}
          </span>
        </td>
        <td class="py-3 px-4 text-slate-700 font-medium">
          ${u.tenant_name ? `
            <div>${u.tenant_name}</div>
            <div class="text-[10px] text-slate-400 font-mono">${u.tenant_phone}</div>
          ` : '<span class="text-slate-400 italic">No Active Tenant</span>'}
        </td>
        <td class="py-3 px-4 text-right">
          ${u.status === 'vacant' ? `
            <button onclick="app.openAssignTenantModal(${u.id})" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition">Lease</button>
          ` : `
            <button onclick="app.openWaterReadingForUnit(${u.id})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Record Water Meter">
              <i data-lucide="droplet" class="w-4 h-4"></i>
            </button>
          `}
        </td>
      </tr>
    `).join('');

    // Populate property filter dropdown if not populated
    const propFilter = document.getElementById('filter-units-property');
    if (propFilter && propFilter.children.length === 1) {
      this.state.properties.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        propFilter.appendChild(opt);
      });
      propFilter.addEventListener('change', () => this.renderUnits());
    }

    const statusFilter = document.getElementById('filter-units-status');
    if (statusFilter && !statusFilter.hasAttribute('listener-added')) {
      statusFilter.setAttribute('listener-added', 'true');
      statusFilter.addEventListener('change', () => this.renderUnits());
    }
  }

  // 3. Tenants
  renderTenants() {
    const tbody = document.getElementById('tenants-table-body');
    const searchVal = (document.getElementById('tenant-search-input')?.value || '').toLowerCase();
    if (!tbody) return;

    let filtered = this.state.tenants;
    if (searchVal) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchVal) ||
        t.phone.toLowerCase().includes(searchVal) ||
        (t.id_number && t.id_number.toLowerCase().includes(searchVal))
      );
    }

    document.getElementById('tenants-count-label').textContent = `${filtered.length} Registered Tenants`;

    tbody.innerHTML = filtered.map(t => {
      const balance = Number(t.total_balance || 0);
      return `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-3 px-4">
            <div class="flex items-center space-x-2.5">
              <div class="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase">
                ${t.name.substring(0, 2)}
              </div>
              <div>
                <p class="font-bold text-slate-800">${t.name}</p>
                <p class="text-[10px] text-slate-400">${t.email || 'No email registered'}</p>
              </div>
            </div>
          </td>
          <td class="py-3 px-4 font-mono text-[11px] text-slate-600">
            <div>${t.phone}</div>
            <div class="text-slate-400">ID: ${t.id_number || 'N/A'}</div>
          </td>
          <td class="py-3 px-4">
            ${t.unit_number ? `
              <div class="font-bold text-slate-800">${t.unit_number}</div>
              <div class="text-[10px] text-slate-400">${t.property_name}</div>
            ` : '<span class="text-slate-400 italic">No assigned unit</span>'}
          </td>
          <td class="py-3 px-4 text-[11px] text-slate-600">
            ${t.lease_start ? `${t.lease_start} to ${t.lease_end}` : '<span class="text-slate-400">No active lease</span>'}
          </td>
          <td class="py-3 px-4 font-bold text-slate-800">
            ${t.monthly_rent ? this.formatMoney(t.monthly_rent) : '-'}
          </td>
          <td class="py-3 px-4">
            ${balance > 0 ? `
              <span class="font-bold text-rose-600 font-mono">${this.formatMoney(balance)} (Arrears)</span>
            ` : `
              <span class="font-bold text-emerald-600 font-mono">${this.formatMoney(0)} (Cleared)</span>
            `}
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
              ${t.status}
            </span>
          </td>
          <td class="py-3 px-4 text-right space-x-1">
            <button onclick="app.viewTenantLedger(${t.id})" class="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded font-semibold text-[11px] transition" title="View Full Dispute-Proof Ledger Statement">Statement</button>
            <button onclick="app.openMpesaForTenant(${t.id})" class="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold text-[11px] hover:bg-emerald-100 transition" title="Trigger STK Push">Lipa M-Pesa</button>
            <button onclick="app.sendSMSAlert(${t.id})" class="p-1 text-slate-500 hover:text-slate-700 rounded" title="Send SMS reminder">
              <i data-lucide="message-square" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const searchInput = document.getElementById('tenant-search-input');
    if (searchInput && !searchInput.hasAttribute('listener-added')) {
      searchInput.setAttribute('listener-added', 'true');
      searchInput.addEventListener('input', () => this.renderTenants());
    }
  }

  // 4. Invoices
  renderInvoices() {
    const tbody = document.getElementById('invoices-table-body');
    const filterStatus = document.getElementById('filter-invoice-status')?.value || 'all';
    if (!tbody) return;

    let filtered = this.state.invoices;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(i => i.status === filterStatus);
    }

    // Update stats summary
    const totalBilled = filtered.reduce((s, i) => s + Number(i.total_amount), 0);
    const totalPaid = filtered.reduce((s, i) => s + Number(i.amount_paid), 0);
    const totalBalance = filtered.reduce((s, i) => s + Number(i.balance), 0);
    const collectionRate = totalBilled > 0 ? ((totalPaid / totalBilled) * 100).toFixed(1) : 0;

    document.getElementById('inv-stat-total').textContent = this.formatMoney(totalBilled);
    document.getElementById('inv-stat-paid').textContent = this.formatMoney(totalPaid);
    document.getElementById('inv-stat-balance').textContent = this.formatMoney(totalBalance);
    document.getElementById('inv-stat-rate').textContent = `${collectionRate}%`;
    document.getElementById('invoices-count-label').textContent = `${filtered.length} Total Invoices`;

    tbody.innerHTML = filtered.map(i => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4 font-mono font-bold text-slate-800 text-[11px]">${i.invoice_number}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-slate-800">${i.tenant_name}</div>
          <div class="text-[10px] text-slate-400">${i.property_name} &bull; Unit ${i.unit_number}</div>
        </td>
        <td class="py-3 px-4 font-mono text-[11px] text-slate-600">${i.month}</td>
        <td class="py-3 px-4 font-mono text-slate-700">${this.formatMoney(i.rent_amount)}</td>
        <td class="py-3 px-4 font-mono text-slate-700">${this.formatMoney(i.water_amount)}</td>
        <td class="py-3 px-4 font-mono text-slate-700 text-[11px]">${this.formatMoney(Number(i.garbage_amount || 0) + Number(i.service_charge || 0))}</td>
        <td class="py-3 px-4 font-mono font-bold text-slate-800">${this.formatMoney(i.total_amount)}</td>
        <td class="py-3 px-4 font-mono text-emerald-600 font-semibold">${this.formatMoney(i.amount_paid)}</td>
        <td class="py-3 px-4 font-mono ${Number(i.balance) > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}">
          ${this.formatMoney(i.balance)}
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${this.getInvoiceBadgeClass(i.status)}">
            ${i.status.replace('_', ' ')}
          </span>
        </td>
        <td class="py-3 px-4 text-right space-x-1">
          <button onclick="app.viewPrintableInvoice(${i.id})" class="p-1 text-slate-500 hover:text-slate-800 rounded" title="View / Print Invoice">
            <i data-lucide="printer" class="w-4 h-4"></i>
          </button>
          ${Number(i.balance) > 0 ? `
            <button onclick="app.openMpesaForInvoice(${i.id})" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] transition" title="Pay via M-Pesa STK">Lipa</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    const statusFilter = document.getElementById('filter-invoice-status');
    if (statusFilter && !statusFilter.hasAttribute('listener-added')) {
      statusFilter.setAttribute('listener-added', 'true');
      statusFilter.addEventListener('change', () => this.renderInvoices());
    }
  }

  // 5. Payments
  renderPayments() {
    const tbody = document.getElementById('payments-table-body');
    if (!tbody) return;

    document.getElementById('payments-count-label').textContent = `${this.state.payments.length} Transactions`;

    tbody.innerHTML = this.state.payments.map(p => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4 font-mono font-bold text-slate-800 text-[11px]">${p.receipt_number}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-slate-800">${p.payer_name || p.tenant_name}</div>
          <div class="text-[10px] text-slate-400">${p.property_name || 'Kilimani'} &bull; Unit ${p.unit_number || 'A101'}</div>
        </td>
        <td class="py-3 px-4 font-mono font-extrabold text-emerald-600">+${this.formatMoney(p.amount)}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${p.payment_method === 'M-Pesa' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}">
            ${p.payment_method}
          </span>
        </td>
        <td class="py-3 px-4 font-mono font-bold text-slate-700 text-[11px]">${p.reference_code || '-'}</td>
        <td class="py-3 px-4 text-slate-500 text-[11px]">${p.payment_date}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
            ${p.status}
          </span>
        </td>
        <td class="py-3 px-4 text-right">
          <button onclick="app.viewPrintableReceipt(${p.id})" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] transition flex items-center space-x-1 ml-auto">
            <i data-lucide="receipt" class="w-3 h-3"></i>
            <span>Receipt</span>
          </button>
        </td>
      </tr>
    `).join('');
  }

  // 6. Water Readings
  renderWaterReadings() {
    const tbody = document.getElementById('water-readings-table-body');
    if (!tbody) return;

    document.getElementById('water-readings-count').textContent = `${this.state.waterReadings.length} Logged Readings`;

    tbody.innerHTML = this.state.waterReadings.map(w => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-slate-800">Unit ${w.unit_number}</div>
          <div class="text-[10px] text-slate-400">${w.property_name}</div>
        </td>
        <td class="py-3 px-4 font-mono text-[11px] text-slate-600">${w.meter_number || 'N/A'}</td>
        <td class="py-3 px-4 font-mono text-[11px] text-slate-700">${w.month}</td>
        <td class="py-3 px-4 font-mono text-slate-600">${w.previous_reading}</td>
        <td class="py-3 px-4 font-mono font-bold text-slate-800">${w.current_reading}</td>
        <td class="py-3 px-4 font-mono font-bold text-blue-600">${w.units_consumed} m³</td>
        <td class="py-3 px-4 font-mono text-slate-600">${this.formatMoney(w.rate_per_unit)}</td>
        <td class="py-3 px-4 font-mono font-bold text-emerald-600">${this.formatMoney(w.total_cost)}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${w.invoiced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
            ${w.invoiced ? 'Billed in Inv' : 'Pending Bill'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // 7. Maintenance Work Orders
  renderMaintenance() {
    const statuses = ['open', 'assigned', 'in_progress', 'completed'];
    statuses.forEach(st => {
      const col = document.getElementById(`kanban-col-${st}`);
      const countEl = document.getElementById(`kanban-count-${st === 'in_progress' ? 'inprogress' : st}`);
      if (!col) return;

      const tickets = this.state.maintenance.filter(m => m.status === st);
      if (countEl) countEl.textContent = tickets.length;

      col.innerHTML = tickets.map(t => `
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:shadow-sm transition">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[10px] font-bold text-slate-400">${t.ticket_number}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${this.getPriorityBadgeClass(t.priority)}">
              ${t.priority}
            </span>
          </div>
          <h4 class="font-bold text-slate-800 text-xs mt-1.5 leading-snug">${t.title}</h4>
          <p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${t.description}</p>

          <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              <span class="font-semibold text-slate-700">${t.property_name}</span> &bull; ${t.unit_number}
            </div>
            ${t.actual_cost > 0 ? `
              <span class="font-mono font-bold text-slate-800">${this.formatMoney(t.actual_cost)}</span>
            ` : (t.estimated_cost > 0 ? `
              <span class="font-mono text-slate-400">Est: ${this.formatMoney(t.estimated_cost)}</span>
            ` : '')}
          </div>

          <div class="mt-2 flex items-center justify-between">
            <div class="text-[10px] text-slate-400 truncate max-w-[120px]">
              <i data-lucide="user" class="w-3 h-3 inline mr-0.5"></i>${t.assigned_contractor || 'Unassigned'}
            </div>
            <select class="text-[10px] border border-slate-200 rounded p-1 bg-slate-50 font-semibold" onchange="app.updateTicketStatus(${t.id}, this.value)">
              <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
              <option value="assigned" ${t.status === 'assigned' ? 'selected' : ''}>Assigned</option>
              <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
          </div>
        </div>
      `).join('');
    });
  }

  // 8. Communications
  renderCommunications() {
    const tbody = document.getElementById('comms-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.state.communications.map(c => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.type === 'sms' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
            ${c.type}
          </span>
        </td>
        <td class="py-3 px-4 font-bold text-slate-800">${c.recipient_name}</td>
        <td class="py-3 px-4 font-mono text-[11px] text-slate-600">${c.recipient_phone}</td>
        <td class="py-3 px-4 text-slate-600 text-[11px] max-w-md truncate" title="${c.message}">${c.message}</td>
        <td class="py-3 px-4 text-slate-500 capitalize text-[11px]">${(c.purpose || 'direct').replace('_', ' ')}</td>
        <td class="py-3 px-4 text-slate-400 text-[10px]">${c.sent_at}</td>
        <td class="py-3 px-4">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
            Delivered
          </span>
        </td>
      </tr>
    `).join('');

    // Populate tenants select in composer
    const tenantSelect = document.getElementById('comm-tenant-select');
    if (tenantSelect && tenantSelect.children.length === 0) {
      this.state.tenants.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (${t.phone}) - Unit ${t.unit_number || 'N/A'}`;
        tenantSelect.appendChild(opt);
      });
    }
  }

  // 9. Landlord Statements
  renderLandlordStatementsInit() {
    const propSelect = document.getElementById('statement-property-select');
    if (propSelect && propSelect.children.length === 0) {
      this.state.properties.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        propSelect.appendChild(opt);
      });
    }
    this.generateLandlordStatement();
  }

  async generateLandlordStatement() {
    const propId = document.getElementById('statement-property-select')?.value || 1;
    const month = document.getElementById('statement-month-input')?.value || '2026-11';

    try {
      const data = await this.fetchAPI(`/api/reports/landlord-statement?property_id=${propId}&month=${month}`);
      const st = data.statement;
      const container = document.getElementById('landlord-statement-container');
      if (!container) return;

      container.innerHTML = `
        <div class="border-b border-slate-200 pb-6 flex items-start justify-between">
          <div>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold uppercase tracking-wider bg-slate-900 text-white px-2.5 py-0.5 rounded">Owner Remittance Statement</span>
              <span class="text-xs text-slate-500 font-mono">${month}</span>
            </div>
            <h2 class="text-2xl font-extrabold text-slate-900 mt-2">${st.property.name}</h2>
            <p class="text-xs text-slate-500">${st.property.address}, ${st.property.city}</p>
          </div>
          <div class="text-right">
            <h4 class="font-bold text-slate-800 text-sm">BomaSphere Property Managers</h4>
            <p class="text-xs text-slate-500">NextGen Mall, Mombasa Rd &bull; Nairobi</p>
            <p class="text-xs text-slate-500 font-mono">+254 708 403 513</p>
            <button onclick="window.print()" class="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-xs no-print">
              <i data-lucide="printer" class="w-3.5 h-3.5 inline mr-1"></i>Print Statement
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6 my-6 text-xs">
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span class="text-slate-400 font-bold uppercase text-[10px]">Landlord / Beneficiary</span>
            <p class="font-extrabold text-slate-900 text-sm mt-1">${st.property.landlord_name}</p>
            <p class="text-slate-600 mt-0.5">${st.property.landlord_email} &bull; ${st.property.landlord_phone}</p>
            <p class="text-slate-600 font-mono mt-1">Bank: ${st.property.bank_name || 'KCB Bank'} | Acc: ${st.property.bank_account || 'N/A'}</p>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span class="text-slate-400 font-bold uppercase text-[10px]">Net Payout Payable</span>
            <div>
              <span class="text-2xl font-extrabold text-emerald-600">${this.formatMoney(st.net_remittance_payout)}</span>
              <p class="text-[11px] text-slate-500">Gross Collections minus Agency Commission & Approved Expenses</p>
            </div>
          </div>
        </div>

        <div class="space-y-4 text-xs">
          <h4 class="font-bold text-slate-800 uppercase text-[11px] tracking-wider">Financial Remittance Calculation</h4>
          <table class="w-full text-left">
            <tbody class="divide-y divide-slate-100">
              <tr class="py-2">
                <td class="py-2 text-slate-600">Gross Rent Billed (${month})</td>
                <td class="py-2 font-mono text-right font-medium">${this.formatMoney(st.total_billed)}</td>
              </tr>
              <tr class="py-2 bg-emerald-50/50">
                <td class="py-2 text-slate-900 font-bold">Total Rent Collections Received</td>
                <td class="py-2 font-mono text-right font-extrabold text-emerald-700">${this.formatMoney(st.gross_collections)}</td>
              </tr>
              <tr class="py-2">
                <td class="py-2 text-slate-600">Less: Agency Management Commission (${st.management_fee_rate}%)</td>
                <td class="py-2 font-mono text-right text-rose-600 font-semibold">-${this.formatMoney(st.management_fee_amount)}</td>
              </tr>
              <tr class="py-2">
                <td class="py-2 text-slate-600">Less: Property Operating & Repair Expenses</td>
                <td class="py-2 font-mono text-right text-rose-600 font-semibold">-${this.formatMoney(st.operating_expenses)}</td>
              </tr>
              <tr class="py-3 border-t-2 border-slate-900 bg-slate-900 text-white font-bold text-sm">
                <td class="py-3 px-3">NET REMITTANCE TO LANDLORD</td>
                <td class="py-3 px-3 font-mono text-right text-emerald-400 font-extrabold">${this.formatMoney(st.net_remittance_payout)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${st.expenses_breakdown.length > 0 ? `
          <div class="mt-6 pt-4 border-t border-slate-100 text-xs">
            <h4 class="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-2">Itemized Expense Deductions</h4>
            <div class="space-y-1">
              ${st.expenses_breakdown.map(e => `
                <div class="flex justify-between text-slate-600 py-1 border-b border-slate-100">
                  <span>${e.description} (${e.category})</span>
                  <span class="font-mono">${this.formatMoney(e.amount)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error(err);
    }
  }

  // 10. Expenses
  renderExpenses() {
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;

    document.getElementById('expenses-count-label').textContent = `${this.state.expenses.length} Recorded Vouchers`;

    tbody.innerHTML = this.state.expenses.map(e => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4 font-mono font-bold text-slate-800 text-[11px]">${e.receipt_voucher || 'VCH-00'}</td>
        <td class="py-3 px-4 font-medium text-slate-800">${e.property_name}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
            ${e.category}
          </span>
        </td>
        <td class="py-3 px-4 text-slate-600 text-[11px]">${e.description}</td>
        <td class="py-3 px-4 font-mono font-bold text-rose-600">-${this.formatMoney(e.amount)}</td>
        <td class="py-3 px-4 text-slate-700 text-[11px]">${e.paid_to}</td>
        <td class="py-3 px-4 text-slate-500 font-mono text-[11px]">${e.expense_date}</td>
      </tr>
    `).join('');
  }

  // 11. Tenant Self-Service Portal View
  renderTenantPortal() {
    const isTenantRole = this.state.authUser?.role === 'tenant';
    const switchContainer = document.getElementById('resident-switch-container');
    const verifiedBadge = document.getElementById('resident-verified-badge');

    if (isTenantRole) {
      if (switchContainer) switchContainer.classList.add('hidden');
      if (verifiedBadge) verifiedBadge.classList.remove('hidden');
      if (this.state.authUser.tenant_id) {
        this.state.currentResidentId = this.state.authUser.tenant_id;
      }
    } else {
      if (switchContainer) switchContainer.classList.remove('hidden');
      if (verifiedBadge) verifiedBadge.classList.add('hidden');
    }

    const tenantSelect = document.getElementById('resident-switch-select');
    if (tenantSelect && tenantSelect.children.length === 0) {
      this.state.tenants.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (Unit ${t.unit_number || 'A101'})`;
        tenantSelect.appendChild(opt);
      });
      tenantSelect.value = this.state.currentResidentId;
    }

    const currentTenant = this.state.tenants.find(t => t.id === Number(this.state.currentResidentId)) || this.state.tenants[0];
    if (!currentTenant) return;

    document.getElementById('resident-portal-name').textContent = `Welcome back, ${currentTenant.name}!`;
    const balance = Number(currentTenant.total_balance || 0);
    const balanceEl = document.getElementById('resident-portal-balance');
    balanceEl.textContent = this.formatMoney(balance);
    balanceEl.className = balance > 0 ? 'text-2xl font-extrabold text-rose-600 mt-1' : 'text-2xl font-extrabold text-emerald-600 mt-1';

    document.getElementById('resident-portal-rent').textContent = this.formatMoney(currentTenant.monthly_rent || 65000);

    // Resident Invoices
    const tenantInvoices = this.state.invoices.filter(i => i.tenant_id === currentTenant.id);
    const invList = document.getElementById('resident-invoices-list');
    if (invList) {
      if (tenantInvoices.length === 0) {
        invList.innerHTML = '<p class="text-xs text-slate-400 py-3">No invoices on record.</p>';
      } else {
        invList.innerHTML = tenantInvoices.map(i => `
          <div class="py-3 flex items-center justify-between text-xs">
            <div>
              <p class="font-bold text-slate-800">${i.month} Rent & Utility Invoice</p>
              <p class="text-[11px] text-slate-400 font-mono">${i.invoice_number} &bull; Due: ${i.due_date}</p>
            </div>
            <div class="text-right">
              <p class="font-bold text-slate-800">${this.formatMoney(i.total_amount)}</p>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${this.getInvoiceBadgeClass(i.status)}">${i.status}</span>
            </div>
          </div>
        `).join('');
      }
    }

    // Resident Payments
    const tenantPayments = this.state.payments.filter(p => p.tenant_id === currentTenant.id);
    const payList = document.getElementById('resident-payments-list');
    if (payList) {
      if (tenantPayments.length === 0) {
        payList.innerHTML = '<p class="text-xs text-slate-400 py-3">No payments on record yet.</p>';
      } else {
        payList.innerHTML = tenantPayments.map(p => `
          <div class="py-3 flex items-center justify-between text-xs">
            <div>
              <p class="font-bold text-slate-800">${p.payment_method} &bull; <span class="font-mono text-emerald-600">${p.reference_code}</span></p>
              <p class="text-[11px] text-slate-400">${p.payment_date}</p>
            </div>
            <div class="text-right">
              <p class="font-extrabold text-emerald-600">+${this.formatMoney(p.amount)}</p>
              <button onclick="app.viewPrintableReceipt(${p.id})" class="text-[11px] text-slate-500 hover:text-slate-800 underline">View Receipt</button>
            </div>
          </div>
        `).join('');
      }
    }
  }

  switchResident(tenantId) {
    this.state.currentResidentId = Number(tenantId);
    this.renderTenantPortal();
  }

  // ==========================================
  // CHART INITIALIZATION & UPDATES
  // ==========================================
  initCharts() {
    if (typeof Chart === 'undefined') {
      console.warn('[BomaSphere] Chart.js is not loaded; skipping chart init.');
      return;
    }
    // 1. Revenue trend bar chart
    const revCtx = document.getElementById('revenueTrendChart')?.getContext('2d');
    if (revCtx) {
      this.charts.revenue = new Chart(revCtx, {
        type: 'bar',
        data: {
          labels: ['Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026'],
          datasets: [
            {
              label: 'Total Billed (KES)',
              data: [610000, 625000, 640000, 650000, 665000, 668884],
              backgroundColor: '#1e293b',
              borderRadius: 6
            },
            {
              label: 'Rent Collected (KES)',
              data: [590000, 615000, 630000, 638000, 652000, 451759],
              backgroundColor: '#10b981',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` KES ${ctx.parsed.y.toLocaleString()}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (val) => `KES ${(val / 1000).toFixed(0)}k`
              },
              grid: { color: '#f1f5f9' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    }

    // 2. Occupancy Doughnut
    const occCtx = document.getElementById('occupancyDoughnutChart')?.getContext('2d');
    if (occCtx) {
      this.charts.occupancy = new Chart(occCtx, {
        type: 'doughnut',
        data: {
          labels: ['Occupied', 'Vacant', 'Maintenance'],
          datasets: [{
            data: [10, 2, 1],
            backgroundColor: ['#10b981', '#0284c7', '#f59e0b'],
            borderWidth: 0,
            cutout: '75%'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  updateCharts() {
    if (typeof Chart === 'undefined') return;
    if (!this.state.stats) return;
    const s = this.state.stats;

    if (this.charts.occupancy) {
      this.charts.occupancy.data.datasets[0].data = [
        s.occupied_units,
        s.vacant_units,
        s.maintenance_units
      ];
      this.charts.occupancy.update();
    }
  }

  // ==========================================
  // MODAL ACTIONS & BILLING GATEWAYS
  // ==========================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const dialog = modal.querySelector('div.bg-white') || modal.firstElementChild;
        if (dialog) {
          gsap.fromTo(dialog, 
            { scale: 0.95, opacity: 0, y: 10 }, 
            { scale: 1, opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' }
          );
        }
      }
      if (window.lucide) lucide.createIcons();
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const dialog = modal.querySelector('div.bg-white') || modal.firstElementChild;
        if (dialog) {
          gsap.to(dialog, {
            scale: 0.95,
            opacity: 0,
            duration: 0.15,
            ease: 'power2.in',
            onComplete: () => {
              modal.classList.add('hidden');
              gsap.set(dialog, { clearProps: 'all' });
            }
          });
          return;
        }
      }
      modal.classList.add('hidden');
    }
  }

  // Open M-Pesa STK Push Modal
  openMpesaModal() {
    const select = document.getElementById('mpesa-tenant-select');
    select.innerHTML = '<option value="">-- Choose Tenant --</option>' + this.state.tenants.map(t => `
      <option value="${t.id}" data-phone="${t.phone}">${t.name} (Unit ${t.unit_number || 'A101'})</option>
    `).join('');

    this.openModal('modal-mpesa');
  }

  openMpesaForTenant(tenantId) {
    this.openMpesaModal();
    const select = document.getElementById('mpesa-tenant-select');
    select.value = tenantId;
    this.onMpesaTenantChange(tenantId);
  }

  openMpesaForInvoice(invoiceId) {
    const inv = this.state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    this.openMpesaForTenant(inv.tenant_id);
    const invSelect = document.getElementById('mpesa-invoice-select');
    if (invSelect) {
      invSelect.value = invoiceId;
      document.getElementById('mpesa-amount-input').value = inv.balance;
    }
  }

  onMpesaTenantChange(tenantId) {
    const tenant = this.state.tenants.find(t => t.id === Number(tenantId));
    if (!tenant) return;

    document.getElementById('mpesa-phone-input').value = tenant.phone;

    // Filter unpaid invoices for this tenant
    const invs = this.state.invoices.filter(i => i.tenant_id === tenant.id && Number(i.balance) > 0);
    const invSelect = document.getElementById('mpesa-invoice-select');

    if (invs.length === 0) {
      invSelect.innerHTML = '<option value="">No outstanding balance (General credit)</option>';
      document.getElementById('mpesa-amount-input').value = tenant.monthly_rent || 65000;
    } else {
      invSelect.innerHTML = invs.map(i => `
        <option value="${i.id}" data-bal="${i.balance}">${i.invoice_number} (${i.month}) - Balance: KES ${Number(i.balance).toLocaleString()}</option>
      `).join('');
      document.getElementById('mpesa-amount-input').value = invs[0].balance;
    }
  }

  onMpesaInvoiceChange(invId) {
    const inv = this.state.invoices.find(i => i.id === Number(invId));
    if (inv) {
      document.getElementById('mpesa-amount-input').value = inv.balance;
    }
  }

  async handleMpesaSubmit(e) {
    e.preventDefault();
    const tenantId = document.getElementById('mpesa-tenant-select').value;
    const invoiceId = document.getElementById('mpesa-invoice-select').value || null;
    const phone = document.getElementById('mpesa-phone-input').value;
    const amount = document.getElementById('mpesa-amount-input').value;
    const btn = document.getElementById('btn-submit-stk');

    btn.disabled = true;
    btn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>Pinging Handset...</span>
    `;

    // Process Daraja STK Push prompt & USSD confirmation
    await new Promise(r => setTimeout(r, 1400));

    try {
      const res = await this.fetchAPI('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          invoice_id: invoiceId,
          amount: Number(amount),
          payment_method: 'M-Pesa',
          payer_phone: phone,
          notes: 'Lipa Na M-Pesa Online STK Push confirmation'
        })
      });

      this.closeModal('modal-mpesa');
      this.showToast(`🎉 M-Pesa ${res.reference_code} Confirmed! KES ${Number(amount).toLocaleString()} received.`, 'success');
      
      await this.refreshAllData();
      
      // Prompt receipt view
      this.viewPrintableReceipt(res.payment_id);

    } catch (err) {
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Send STK Prompt</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  // Automated Monthly Billing Engine
  async runBatchBilling() {
    if (!confirm('Run the Automated Invoicing Engine for all occupied units for November 2026? This will aggregate monthly base rent, unbilled water meter readings, garbage, and service charges.')) {
      return;
    }

    try {
      const res = await this.fetchAPI('/api/invoices/generate-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: '2026-11' })
      });

      this.showToast(`⚡ Batch billing complete! Generated ${res.invoices_created} invoices.`, 'success');
      await this.refreshAllData();
      this.switchView('invoices');
    } catch (err) {
      console.error(err);
    }
  }

  // Water meter entry
  openWaterReadingModal() {
    const unitSelect = document.getElementById('water-unit-select');
    unitSelect.innerHTML = this.state.units.filter(u => u.status === 'occupied').map(u => `
      <option value="${u.id}">${u.property_name} - Unit ${u.unit_number} (Meter: ${u.meter_number || 'WM-01'})</option>
    `).join('');

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('water-date-input').value = today;
    document.getElementById('water-prev-input').value = 150.0;
    document.getElementById('water-curr-input').value = 162.5;
    this.calcWaterCost();

    this.openModal('modal-water-reading');
  }

  openWaterReadingForUnit(unitId) {
    this.openWaterReadingModal();
    document.getElementById('water-unit-select').value = unitId;
  }

  calcWaterCost() {
    const prev = Number(document.getElementById('water-prev-input')?.value || 0);
    const curr = Number(document.getElementById('water-curr-input')?.value || 0);
    const consumed = Math.max(0, curr - prev);
    const cost = consumed * 175.0; // standard KES rate

    const unitsEl = document.getElementById('water-calc-units');
    const costEl = document.getElementById('water-calc-cost');
    if (unitsEl) unitsEl.textContent = `${consumed.toFixed(1)} m³`;
    if (costEl) costEl.textContent = `KES ${cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  }

  async handleWaterSubmit(e) {
    e.preventDefault();
    const unitId = document.getElementById('water-unit-select').value;
    const month = document.getElementById('water-month-input').value;
    const date = document.getElementById('water-date-input').value;
    const prev = document.getElementById('water-prev-input').value;
    const curr = document.getElementById('water-curr-input').value;

    try {
      await this.fetchAPI('/api/water-readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          month,
          reading_date: date,
          previous_reading: prev,
          current_reading: curr,
          rate_per_unit: 175.0
        })
      });

      this.closeModal('modal-water-reading');
      this.showToast('Water reading saved and linked to unit billing!', 'success');
      await this.refreshAllData();
      this.switchView('water');
    } catch (err) {
      console.error(err);
    }
  }

  // Maintenance tickets
  openMaintenanceModal() {
    this.openNewTicketModal();
  }

  openNewTicketModal() {
    const select = document.getElementById('ticket-unit-select');
    if (select && this.state.units) {
      select.innerHTML = this.state.units.map(u => `
        <option value="${u.id}">${u.property_name} - Unit ${u.unit_number} (${u.status.toUpperCase()})</option>
      `).join('');
    }
    const form = document.getElementById('form-ticket');
    if (form) form.reset();
    this.openModal('modal-maintenance-ticket');
  }

  async handleTicketSubmit(e) {
    e.preventDefault();
    const unitId = document.getElementById('ticket-unit-select').value;
    const unit = this.state.units.find(u => u.id === Number(unitId));
    const title = document.getElementById('ticket-title').value;
    const cat = document.getElementById('ticket-category').value;
    const priority = document.getElementById('ticket-priority').value;
    const estCost = document.getElementById('ticket-est-cost').value || 0;
    const contractor = document.getElementById('ticket-contractor').value || '';
    const desc = document.getElementById('ticket-desc').value;

    try {
      const res = await this.fetchAPI('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: unit ? unit.property_id : 1,
          unit_id: unitId,
          tenant_id: null,
          title,
          category: cat,
          priority,
          estimated_cost: Number(estCost),
          assigned_contractor: contractor,
          description: desc
        })
      });

      this.closeModal('modal-maintenance-ticket');
      this.showToast(`Work order ${res.ticket_number} created and dispatched!`, 'success');
      await this.refreshAllData();
      this.switchView('maintenance');
    } catch (err) {
      console.error(err);
    }
  }

  async updateTicketStatus(ticketId, newStatus) {
    try {
      await this.fetchAPI(`/api/maintenance/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      this.showToast(`Ticket status updated to ${newStatus}`, 'info');
      await this.refreshAllData();
    } catch (err) {
      console.error(err);
    }
  }

  // Receipts & Invoice Printing
  viewPrintableReceipt(paymentId) {
    const p = this.state.payments.find(pay => pay.id === paymentId);
    if (!p) return;

    const modalTitle = document.getElementById('printable-modal-title');
    if (modalTitle) modalTitle.textContent = `Official Rent Receipt: ${p.receipt_number}`;

    const area = document.getElementById('printable-area');
    area.innerHTML = `
      <div class="border-2 border-slate-900 rounded-xl p-8 max-w-xl mx-auto bg-white text-slate-900 font-sans">
        
        <!-- Header -->
        <div class="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <div class="flex items-center space-x-2">
              <span class="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center text-lg">B</span>
              <span class="font-extrabold text-xl tracking-tight">BomaSphere Management</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">Licensed Property Agents & Valuers</p>
            <p class="text-xs text-slate-500">NextGen Mall, Mombasa Road &bull; Nairobi</p>
            <p class="text-xs text-slate-500 font-mono">PIN: P051948201Z &bull; Tel: +254 708 403 513</p>
          </div>
          <div class="text-right">
            <span class="px-3 py-1 bg-emerald-100 text-emerald-900 font-extrabold text-xs rounded border border-emerald-300 uppercase">Rent Receipt</span>
            <p class="font-mono font-bold text-sm text-slate-800 mt-2">${p.receipt_number}</p>
            <p class="text-xs text-slate-500">${p.payment_date}</p>
          </div>
        </div>

        <!-- Body Details -->
        <div class="grid grid-cols-2 gap-4 py-4 border-b border-slate-200 text-xs">
          <div>
            <span class="text-slate-400 font-bold uppercase text-[10px]">Received From:</span>
            <p class="font-bold text-sm text-slate-900 mt-0.5">${p.payer_name || p.tenant_name}</p>
            <p class="text-slate-600">${p.property_name || 'Kilimani Heights'} &bull; Unit ${p.unit_number || 'A101'}</p>
          </div>
          <div class="text-right">
            <span class="text-slate-400 font-bold uppercase text-[10px]">Payment Method:</span>
            <p class="font-bold text-sm text-slate-900 mt-0.5">${p.payment_method}</p>
            <p class="font-mono text-emerald-700 font-bold">Ref: ${p.reference_code || 'M-Pesa Verified'}</p>
          </div>
        </div>

        <!-- Amount Box -->
        <div class="my-6 p-4 rounded-lg bg-slate-50 border border-slate-200 text-center">
          <span class="text-xs text-slate-500 font-semibold uppercase">Total Amount Received</span>
          <div class="text-3xl font-black text-slate-900 font-mono mt-1">KES ${Number(p.amount).toLocaleString()}.00</div>
          <p class="text-[11px] text-slate-500 italic mt-1">Payment applied towards November 2026 rent and utilities.</p>
        </div>

        <!-- Signature & Stamp -->
        <div class="flex items-end justify-between pt-4 border-t border-slate-200 text-xs">
          <div>
            <div class="w-24 h-12 border border-dashed border-emerald-400 rounded flex items-center justify-center text-[10px] text-emerald-600 font-bold uppercase tracking-wider rotate-[-5deg]">
              PAID & VERIFIED
            </div>
            <p class="text-[10px] text-slate-400 mt-1">Automated Electronic Stamp</p>
          </div>
          <div class="text-right">
            <div class="w-36 border-b border-slate-900 mb-1"></div>
            <span class="text-[11px] text-slate-600 font-semibold">Authorized Signatory</span>
          </div>
        </div>

      </div>
    `;

    this.openModal('modal-printable');
  }

  viewPrintableInvoice(invoiceId) {
    const inv = this.state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    const modalTitle = document.getElementById('printable-modal-title');
    if (modalTitle) modalTitle.textContent = `Invoice: ${inv.invoice_number}`;

    const area = document.getElementById('printable-area');
    area.innerHTML = `
      <div class="border border-slate-200 rounded-xl p-8 max-w-2xl mx-auto bg-white text-slate-900 font-sans">
        <div class="flex items-start justify-between border-b pb-4">
          <div>
            <h2 class="font-black text-2xl tracking-tight text-slate-900">BomaSphere Properties</h2>
            <p class="text-xs text-slate-500">Property Management & Advisory</p>
            <p class="text-xs text-slate-500">NextGen Mall, Mombasa Rd &bull; Nairobi</p>
          </div>
          <div class="text-right">
            <span class="px-2.5 py-0.5 rounded text-xs font-bold uppercase ${this.getInvoiceBadgeClass(inv.status)}">${inv.status}</span>
            <p class="font-mono font-bold text-sm text-slate-900 mt-2">${inv.invoice_number}</p>
            <p class="text-xs text-slate-500">Due: ${inv.due_date}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 my-6 text-xs">
          <div>
            <span class="text-slate-400 uppercase font-bold text-[10px]">Billed To:</span>
            <p class="font-bold text-slate-900 text-sm mt-0.5">${inv.tenant_name}</p>
            <p class="text-slate-600">${inv.property_name} &bull; Unit ${inv.unit_number}</p>
            <p class="text-slate-600 font-mono">${inv.tenant_phone}</p>
          </div>
          <div class="text-right">
            <span class="text-slate-400 uppercase font-bold text-[10px]">Payment Instructions:</span>
            <p class="font-bold text-slate-800 mt-0.5">Lipa Na M-Pesa</p>
            <p class="font-mono text-emerald-700 font-bold">${inv.paybill_number || 'Paybill: 522522'}</p>
            <p class="text-slate-500 text-[11px]">Bank: ${inv.bank_name || 'KCB'} (${inv.bank_account || '1189452300'})</p>
          </div>
        </div>

        <table class="w-full text-left text-xs my-4">
          <thead class="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th class="py-2.5 px-3">Item Description</th>
              <th class="py-2.5 px-3 text-right">Amount (KES)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-mono">
            <tr>
              <td class="py-2.5 px-3 font-sans text-slate-800">Monthly Rent (${inv.month})</td>
              <td class="py-2.5 px-3 text-right font-medium">KES ${Number(inv.rent_amount).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="py-2.5 px-3 font-sans text-slate-800">Water Consumption Meter Charges</td>
              <td class="py-2.5 px-3 text-right font-medium">KES ${Number(inv.water_amount).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="py-2.5 px-3 font-sans text-slate-800">Garbage Collection Services</td>
              <td class="py-2.5 px-3 text-right font-medium">KES ${Number(inv.garbage_amount).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="py-2.5 px-3 font-sans text-slate-800">Compound Service Charge & Security</td>
              <td class="py-2.5 px-3 text-right font-medium">KES ${Number(inv.service_charge).toLocaleString()}</td>
            </tr>
            ${Number(inv.late_fee) > 0 ? `
              <tr>
                <td class="py-2.5 px-3 font-sans text-rose-700 font-bold">Late Payment Penalty (5%)</td>
                <td class="py-2.5 px-3 text-right text-rose-700 font-bold">KES ${Number(inv.late_fee).toLocaleString()}</td>
              </tr>
            ` : ''}
            <tr class="border-t-2 border-slate-900 font-bold text-sm font-sans bg-slate-50">
              <td class="py-3 px-3">Total Amount Due</td>
              <td class="py-3 px-3 text-right font-mono text-slate-900">KES ${Number(inv.total_amount).toLocaleString()}</td>
            </tr>
            <tr class="text-xs">
              <td class="py-2 px-3 text-slate-500">Amount Paid</td>
              <td class="py-2 px-3 text-right text-emerald-600">KES ${Number(inv.amount_paid).toLocaleString()}</td>
            </tr>
            <tr class="font-bold text-sm text-rose-600">
              <td class="py-2 px-3">Remaining Balance</td>
              <td class="py-2 px-3 text-right font-mono">KES ${Number(inv.balance).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    this.openModal('modal-printable');
  }

  // Direct Communication Templates
  useTemplate(type) {
    const msgInput = document.getElementById('comm-message-text');
    if (!msgInput) return;

    if (type === 'arrears') {
      msgInput.value = 'URGENT NOTICE: Your rent payment is past due. Kindly clear your balance today via Paybill 522522 to avoid disruption of utility services.';
    } else if (type === 'water') {
      msgInput.value = 'NOTICE: Routine borehole maintenance and water storage tank flushing is scheduled for tomorrow between 9:00 AM and 1:00 PM.';
    } else if (type === 'inspection') {
      msgInput.value = 'Dear resident, please note that quarterly plumbing and smoke detector inspections will be conducted this Thursday. Thank you for your cooperation.';
    }
  }

  async sendQuickComm() {
    const channel = document.getElementById('comm-channel-select').value;
    const tenantId = document.getElementById('comm-tenant-select').value;
    const message = document.getElementById('comm-message-text').value;
    const tenant = this.state.tenants.find(t => t.id === Number(tenantId));

    if (!message) {
      alert('Please enter a message');
      return;
    }

    try {
      await this.fetchAPI('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: channel,
          recipient_name: tenant ? tenant.name : 'Resident',
          recipient_phone: tenant ? tenant.phone : '+254700000000',
          tenant_id: tenantId,
          message,
          purpose: 'direct_dispatch'
        })
      });

      document.getElementById('comm-message-text').value = '';
      this.showToast(`${channel.toUpperCase()} message sent to ${tenant ? tenant.name : 'Resident'}!`, 'success');
      await this.refreshAllData();
    } catch (err) {
      console.error(err);
    }
  }

  showArrearsSMS() {
    this.switchView('communications');
    this.useTemplate('arrears');
  }

  // ==========================================
  // PROPERTY & UNIT MODALS
  // ==========================================
  openAddPropertyModal() {
    this.openModal('modal-add-property');
  }

  async handleAddPropertySubmit(e) {
    e.preventDefault();
    const name = document.getElementById('prop-name').value;
    const type = document.getElementById('prop-type').value;
    const city = document.getElementById('prop-city').value;
    const address = document.getElementById('prop-address').value;
    const landlord = document.getElementById('prop-landlord').value;
    const fee = document.getElementById('prop-fee').value;
    const paybill = document.getElementById('prop-paybill').value;
    const bank = document.getElementById('prop-bank').value;

    try {
      await this.fetchAPI('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, property_type: type, city, address,
          landlord_name: landlord, landlord_phone: '+254700000000', landlord_email: 'landlord@property.co.ke',
          management_fee_pct: Number(fee), paybill_number: paybill, bank_name: bank
        })
      });

      this.closeModal('modal-add-property');
      this.showToast(`Property "${name}" created successfully!`, 'success');
      await this.refreshAllData();
      this.renderProperties();
    } catch (err) {
      console.error(err);
    }
  }

  openAddUnitModal() {
    const select = document.getElementById('unit-prop-select');
    select.innerHTML = this.state.properties.map(p => `
      <option value="${p.id}">${p.name} (${p.city})</option>
    `).join('');
    this.openModal('modal-add-unit');
  }

  async handleAddUnitSubmit(e) {
    e.preventDefault();
    const propertyId = document.getElementById('unit-prop-select').value;
    const unitNumber = document.getElementById('unit-number-input').value;
    const floor = document.getElementById('unit-floor-input').value;
    const unitType = document.getElementById('unit-type-input').value;
    const rent = document.getElementById('unit-rent-input').value;
    const service = document.getElementById('unit-service-input').value || 0;
    const garbage = document.getElementById('unit-garbage-input').value || 0;
    const meter = document.getElementById('unit-meter-input').value || '';

    try {
      await this.fetchAPI('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: Number(propertyId),
          unit_number: unitNumber,
          floor,
          unit_type: unitType,
          base_rent: Number(rent),
          service_charge: Number(service),
          garbage_fee: Number(garbage),
          meter_number: meter,
          status: 'vacant'
        })
      });

      this.closeModal('modal-add-unit');
      this.showToast(`Unit ${unitNumber} added to property!`, 'success');
      await this.refreshAllData();
      this.renderUnits();
    } catch (err) {
      console.error(err);
    }
  }

  // ==========================================
  // TENANT & LEASE MODALS
  // ==========================================
  openAddTenantModal() {
    this.openModal('modal-add-tenant');
  }

  async handleAddTenantSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('tenant-name-input').value;
    const phone = document.getElementById('tenant-phone-input').value;
    const idNumber = document.getElementById('tenant-idnum-input').value;
    const email = document.getElementById('tenant-email-input').value || '';
    const emgName = document.getElementById('tenant-emg-name').value || '';
    const emgPhone = document.getElementById('tenant-emg-phone').value || '';

    try {
      await this.fetchAPI('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, phone, id_number: idNumber, email,
          emergency_contact_name: emgName, emergency_contact_phone: emgPhone,
          status: 'active'
        })
      });

      this.closeModal('modal-add-tenant');
      this.showToast(`Tenant "${name}" registered successfully!`, 'success');
      await this.refreshAllData();
      this.renderTenants();
    } catch (err) {
      console.error(err);
    }
  }

  openAddLeaseModal(preselectedUnitId = null) {
    const unitSelect = document.getElementById('lease-unit-select');
    const tenantSelect = document.getElementById('lease-tenant-select');
    if (!unitSelect || !tenantSelect) return;

    const vacantUnits = this.state.units.filter(u => u.status === 'vacant');
    let targetUnits = [...vacantUnits];
    if (preselectedUnitId) {
      const selected = this.state.units.find(u => u.id === Number(preselectedUnitId));
      if (selected && !targetUnits.some(u => u.id === selected.id)) {
        targetUnits = [selected, ...targetUnits];
      }
    }

    if (targetUnits.length === 0) {
      this.showToast('All units are currently occupied or in maintenance! Please add a vacant unit first.', 'warning');
      return;
    }

    unitSelect.innerHTML = targetUnits.map(u => `
      <option value="${u.id}" ${preselectedUnitId && Number(preselectedUnitId) === u.id ? 'selected' : ''}>
        ${u.property_name} - Unit ${u.unit_number} (${this.formatMoney(u.base_rent)}/mo)
      </option>
    `).join('');

    tenantSelect.innerHTML = this.state.tenants.map(t => `
      <option value="${t.id}">${t.name} (${t.phone || 'No phone'})</option>
    `).join('');

    const initialUnitId = unitSelect.value;
    this.onLeaseUnitSelected(initialUnitId);

    const startDate = document.getElementById('lease-start-date');
    const endDate = document.getElementById('lease-end-date');
    if (startDate) startDate.value = '2026-11-01';
    if (endDate) endDate.value = '2027-10-31';

    this.openModal('modal-create-lease');
  }

  openAssignTenantModal(unitId) {
    this.openAddLeaseModal(unitId);
  }

  onLeaseUnitSelected(unitId) {
    const unit = this.state.units.find(u => u.id === Number(unitId));
    if (!unit) return;
    const rentInput = document.getElementById('lease-rent-input');
    const depositInput = document.getElementById('lease-deposit-input');
    if (rentInput) rentInput.value = unit.base_rent;
    if (depositInput) depositInput.value = unit.base_rent;
  }

  async handleCreateLeaseSubmit(e) {
    e.preventDefault();
    const unitId = Number(document.getElementById('lease-unit-select').value);
    const tenantId = Number(document.getElementById('lease-tenant-select').value);
    const monthlyRent = Number(document.getElementById('lease-rent-input').value);
    const depositPaid = Number(document.getElementById('lease-deposit-input').value);
    const waterDeposit = Number(document.getElementById('lease-water-dep-input').value || 5000);
    const startDate = document.getElementById('lease-start-date').value;
    const endDate = document.getElementById('lease-end-date').value;
    const terms = document.getElementById('lease-terms-input').value;

    try {
      await this.fetchAPI('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          tenant_id: tenantId,
          start_date: startDate,
          end_date: endDate,
          monthly_rent: monthlyRent,
          deposit_paid: depositPaid,
          water_deposit: waterDeposit,
          terms: terms || 'Standard 1-year tenancy agreement'
        })
      });

      this.closeModal('modal-create-lease');
      this.showToast('New digital lease executed successfully! Unit marked occupied.', 'success');
      await this.refreshAllData();
      this.renderUnits();
      this.renderTenants();
      if (this.state.currentView === 'leases') this.renderLeaseAgreementsInit();
    } catch (err) {
      console.error(err);
      this.showToast(err.message || 'Failed to execute lease', 'error');
    }
  }

  async createLease(unitId, tenantId, rent, startDate, endDate) {
    try {
      await this.fetchAPI('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          tenant_id: tenantId,
          start_date: startDate,
          end_date: endDate,
          monthly_rent: rent,
          deposit_paid: rent,
          water_deposit: 5000,
          terms: 'Standard 1-year tenancy agreement'
        })
      });

      this.showToast('New lease created! Unit marked occupied.', 'success');
      await this.refreshAllData();
      this.renderUnits();
      this.renderTenants();
    } catch (err) {
      console.error(err);
    }
  }

  // ==========================================
  // INVOICING & PAYMENT HELPERS
  // ==========================================
  openCreateInvoiceModal() {
    const select = document.getElementById('invoice-tenant-select');
    if (!select) return;

    const activeTenants = this.state.tenants.filter(t => t.unit_id);
    const tenantsList = activeTenants.length > 0 ? activeTenants : this.state.tenants;

    if (tenantsList.length === 0) {
      this.showToast('No registered tenants found to invoice.', 'warning');
      return;
    }

    select.innerHTML = tenantsList.map(t => `
      <option value="${t.id}">${t.name} (${t.property_name || 'Property'} - Unit ${t.unit_number || 'N/A'})</option>
    `).join('');

    this.onInvoiceTenantSelected(select.value);
    this.openModal('modal-custom-invoice');
  }

  onInvoiceTenantSelected(tenantId) {
    const tenant = this.state.tenants.find(t => t.id === Number(tenantId));
    if (!tenant) return;
    const unit = this.state.units.find(u => u.id === tenant.unit_id) || {};

    const rentInput = document.getElementById('invoice-rent-input');
    const waterInput = document.getElementById('invoice-water-input');
    const serviceInput = document.getElementById('invoice-service-input');
    const garbageInput = document.getElementById('invoice-garbage-input');
    const notesInput = document.getElementById('invoice-notes-input');

    if (rentInput) rentInput.value = tenant.monthly_rent || unit.base_rent || 60000;
    if (waterInput) waterInput.value = 2500;
    if (serviceInput) serviceInput.value = unit.service_charge || 3500;
    if (garbageInput) garbageInput.value = unit.garbage_fee || 500;
    if (notesInput) notesInput.value = `Monthly billing for Unit ${tenant.unit_number || unit.unit_number || 'N/A'}`;

    this.calculateInvoiceTotal();
  }

  calculateInvoiceTotal() {
    const rent = Number(document.getElementById('invoice-rent-input')?.value || 0);
    const water = Number(document.getElementById('invoice-water-input')?.value || 0);
    const service = Number(document.getElementById('invoice-service-input')?.value || 0);
    const garbage = Number(document.getElementById('invoice-garbage-input')?.value || 0);
    const late = Number(document.getElementById('invoice-late-input')?.value || 0);
    const other = Number(document.getElementById('invoice-other-input')?.value || 0);

    const total = rent + water + service + garbage + late + other;
    const totalEl = document.getElementById('invoice-calculated-total');
    if (totalEl) totalEl.textContent = this.formatMoney(total);
  }

  async handleCustomInvoiceSubmit(e) {
    e.preventDefault();
    const tenantId = Number(document.getElementById('invoice-tenant-select').value);
    const tenant = this.state.tenants.find(t => t.id === tenantId);
    const unitId = tenant ? (tenant.unit_id || 1) : 1;
    const month = document.getElementById('invoice-month-input').value || '2026-11';
    const dueDate = document.getElementById('invoice-due-date').value || '2026-11-05';
    const rent = Number(document.getElementById('invoice-rent-input').value || 0);
    const water = Number(document.getElementById('invoice-water-input').value || 0);
    const service = Number(document.getElementById('invoice-service-input').value || 0);
    const garbage = Number(document.getElementById('invoice-garbage-input').value || 0);
    const late = Number(document.getElementById('invoice-late-input').value || 0);
    const other = Number(document.getElementById('invoice-other-input').value || 0);
    const notes = document.getElementById('invoice-notes-input').value;

    const lease = this.state.leases?.find(l => l.tenant_id === tenantId && l.status === 'active') || { id: 1 };

    try {
      const res = await this.fetchAPI('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lease_id: lease.id,
          tenant_id: tenantId,
          unit_id: unitId,
          month,
          due_date: dueDate,
          rent_amount: rent,
          water_amount: water,
          service_charge: service,
          garbage_amount: garbage,
          late_fee: late,
          other_charges: other,
          notes: notes || 'Custom billing statement'
        })
      });

      this.closeModal('modal-custom-invoice');
      this.showToast(`Custom invoice ${res.invoice_number || 'created'} issued successfully!`, 'success');
      await this.refreshAllData();
      this.renderInvoices();
    } catch (err) {
      console.error(err);
      this.showToast(err.message || 'Failed to generate invoice', 'error');
    }
  }

  openManualPaymentModal() {
    const tenantSelect = document.getElementById('pay-manual-tenant');
    tenantSelect.innerHTML = '<option value="">-- Select Tenant --</option>' + this.state.tenants.map(t => `
      <option value="${t.id}">${t.name} (Unit ${t.unit_number || 'A101'})</option>
    `).join('');

    this.openModal('modal-manual-payment');
  }

  onManualTenantChange(tenantId) {
    const tenant = this.state.tenants.find(t => t.id === Number(tenantId));
    if (!tenant) return;

    const invs = this.state.invoices.filter(i => i.tenant_id === tenant.id && Number(i.balance) > 0);
    const invSelect = document.getElementById('pay-manual-invoice');
    if (invs.length === 0) {
      invSelect.innerHTML = '<option value="">No pending invoice (General account credit)</option>';
      document.getElementById('pay-manual-amount').value = tenant.monthly_rent || 65000;
    } else {
      invSelect.innerHTML = invs.map(i => `
        <option value="${i.id}" data-bal="${i.balance}">${i.invoice_number} - Balance: KES ${Number(i.balance).toLocaleString()}</option>
      `).join('');
      document.getElementById('pay-manual-amount').value = invs[0].balance;
    }
  }

  async handleManualPaymentSubmit(e) {
    e.preventDefault();
    const tenantId = document.getElementById('pay-manual-tenant').value;
    const invId = document.getElementById('pay-manual-invoice').value || null;
    const method = document.getElementById('pay-manual-method').value;
    const amount = document.getElementById('pay-manual-amount').value;
    const ref = document.getElementById('pay-manual-ref').value;
    const notes = document.getElementById('pay-manual-notes').value;
    const tenant = this.state.tenants.find(t => t.id === Number(tenantId));

    try {
      const res = await this.fetchAPI('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: Number(tenantId),
          invoice_id: invId ? Number(invId) : null,
          amount: Number(amount),
          payment_method: method,
          reference_code: ref,
          payer_name: tenant ? tenant.name : '',
          payer_phone: tenant ? tenant.phone : '',
          notes
        })
      });

      this.closeModal('modal-manual-payment');
      this.showToast(`Receipt ${res.receipt_number} generated for KES ${Number(amount).toLocaleString()}!`, 'success');
      await this.refreshAllData();
      this.viewPrintableReceipt(res.payment_id);
    } catch (err) {
      console.error(err);
    }
  }

  onWaterUnitChange(unitId) {
    const reading = this.state.waterReadings.find(w => w.unit_id === Number(unitId));
    if (reading) {
      document.getElementById('water-prev-input').value = reading.current_reading;
      document.getElementById('water-curr-input').value = (Number(reading.current_reading) + 12.0).toFixed(1);
    } else {
      document.getElementById('water-prev-input').value = 100.0;
      document.getElementById('water-curr-input').value = 114.5;
    }
    this.calcWaterCost();
  }

  // ==========================================
  // BROADCAST & EXPENSES
  // ==========================================
  async openBroadcastModal() {
    const msg = prompt('Enter Announcement / Notice to Broadcast to All Tenants:\n\n(e.g., Routine tank cleaning scheduled for Wednesday 10am)');
    if (!msg) return;

    const channel = prompt('Choose Channel (sms or whatsapp):', 'sms') || 'sms';

    try {
      const res = await this.fetchAPI('/api/communications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: channel,
          message: msg
        })
      });

      this.showToast(`Broadcast notice sent to ${res.recipients_reached} registered tenants!`, 'success');
      await this.refreshAllData();
      this.switchView('communications');
    } catch (err) {
      console.error(err);
    }
  }

  openAddExpenseModal() {
    const select = document.getElementById('expense-property-select');
    if (!select || !this.state.properties) return;

    select.innerHTML = this.state.properties.map(p => `
      <option value="${p.id}">${p.name} (${p.city})</option>
    `).join('');

    const dateInput = document.getElementById('expense-date-input');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    const voucherInput = document.getElementById('expense-voucher-input');
    if (voucherInput) {
      voucherInput.value = `VCH-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(10 + Math.random()*90)}`;
    }

    const form = document.getElementById('form-add-expense');
    if (form) {
      const descEl = document.getElementById('expense-desc-input');
      const amtEl = document.getElementById('expense-amount-input');
      const paidEl = document.getElementById('expense-paidto-input');
      if (descEl) descEl.value = '';
      if (amtEl) amtEl.value = '';
      if (paidEl) paidEl.value = '';
    }

    this.openModal('modal-add-expense');
  }

  async handleAddExpenseSubmit(e) {
    e.preventDefault();
    const propId = Number(document.getElementById('expense-property-select').value);
    const cat = document.getElementById('expense-category-select').value;
    const desc = document.getElementById('expense-desc-input').value;
    const amount = Number(document.getElementById('expense-amount-input').value);
    const paidTo = document.getElementById('expense-paidto-input').value;
    const expDate = document.getElementById('expense-date-input').value;
    const voucher = document.getElementById('expense-voucher-input').value;

    try {
      await this.fetchAPI('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propId,
          category: cat,
          description: desc,
          amount,
          paid_to: paidTo,
          expense_date: expDate,
          receipt_voucher: voucher
        })
      });

      this.closeModal('modal-add-expense');
      this.showToast('Property expense voucher recorded successfully!', 'success');
      await this.refreshAllData();
      this.renderExpenses();
    } catch (err) {
      console.error(err);
      this.showToast(err.message || 'Failed to record expense', 'error');
    }
  }

  viewPropertyStatement(propId) {
    this.switchView('landlord');
    const select = document.getElementById('statement-property-select');
    if (select) {
      select.value = propId;
      this.generateLandlordStatement();
    }
  }

  // Setup Event Listeners
  setupEventListeners() {
    // Quick buttons
    document.getElementById('btn-quick-mpesa')?.addEventListener('click', () => this.openMpesaModal());
    document.getElementById('btn-quick-invoice')?.addEventListener('click', () => this.runBatchBilling());
  }

  // ==========================================
  // HIGGSFIELD.AI VIRTUAL TOUR & STAGING STUDIO
  // ==========================================
  renderHiggsfield() {
    const select = document.getElementById('hg-unit-select');
    if (select && select.children.length === 0) {
      const vacantOrPrimeUnits = this.state.units.filter(u => u.status === 'vacant' || (u.unit_type && (u.unit_type.includes('Penthouse') || u.unit_type.includes('Villa'))));
      const unitsToDisplay = vacantOrPrimeUnits.length > 0 ? vacantOrPrimeUnits : this.state.units;
      select.innerHTML = unitsToDisplay.map(u => `
        <option value="${u.id}" data-name="${u.property_name} - Unit ${u.unit_number}" data-type="${u.unit_type}" data-city="${u.property_city || 'Nairobi'}">
          ${u.property_name} &bull; Unit ${u.unit_number} (${u.unit_type})
        </option>
      `).join('');
    }
    this.updateHiggsfieldPrompt();
  }

  onHiggsfieldUnitChange(unitId) {
    this.updateHiggsfieldPrompt();
  }

  setHiggsfieldMode(mode) {
    this.state.hgMode = mode;
    const btnVacant = document.getElementById('hg-mode-vacant');
    const btnInspection = document.getElementById('hg-mode-inspection');
    if (!btnVacant || !btnInspection) return;

    if (mode === 'inspection') {
      btnInspection.className = 'px-3 py-1.5 rounded-md font-semibold bg-white text-slate-900 shadow-xs transition';
      btnVacant.className = 'px-3 py-1.5 rounded-md font-semibold text-slate-600 hover:text-slate-900 transition';
      document.getElementById('btn-hg-generate').innerHTML = `<i data-lucide="shield-check" class="w-4 h-4 inline mr-1"></i><span>Render Inspection Proof (Digital Twin)</span>`;
      document.getElementById('hg-preview-title').textContent = 'Pre-Move-In Verified Digital Inspection Record';
      document.getElementById('hg-preview-desc').textContent = 'Timestamped 4K camera scan recording exact flooring, paint, sanitary fittings, and fixture condition prior to key handover.';
    } else {
      btnVacant.className = 'px-3 py-1.5 rounded-md font-semibold bg-white text-slate-900 shadow-xs transition';
      btnInspection.className = 'px-3 py-1.5 rounded-md font-semibold text-slate-600 hover:text-slate-900 transition';
      document.getElementById('btn-hg-generate').innerHTML = `<i data-lucide="video" class="w-4 h-4 inline mr-1"></i><span>Render 4K Cinematic Walkthrough</span>`;
      document.getElementById('hg-preview-title').textContent = 'Kilimani Royal Heights · Unit A202 Walkthrough';
      document.getElementById('hg-preview-desc').textContent = 'Click "Render 4K Cinematic Walkthrough" to generate physics-aware drone and interior tour footage.';
    }
    if (window.lucide) lucide.createIcons();
    this.updateHiggsfieldPrompt();
  }

  updateHiggsfieldPrompt() {
    const unitSelect = document.getElementById('hg-unit-select');
    const motion = document.getElementById('hg-camera-motion')?.value || 'dolly_interior';
    const style = document.getElementById('hg-staging-style')?.value || 'luxury';
    const promptEl = document.getElementById('hg-prompt-text');
    if (!promptEl) return;

    const opt = unitSelect?.selectedOptions?.[0];
    const unitName = opt ? opt.dataset.name : 'Kilimani Heights - Unit A202';
    const unitType = opt ? opt.dataset.type : '2-Bedroom Master Ensuite';

    const motions = {
      dolly_interior: 'Smooth eye-level tracking dolly shot gliding forward through open sunlit living room to master bedroom suite, 35mm lens, 4k 60fps, subtle depth of field',
      drone_aerial: 'Cinematic 4K aerial drone pullback ascending smoothly from private balcony revealing panoramic Nairobi skyline, golden hour volumetric lighting, physics-aware camera damping',
      orbit_360: 'Continuous 360-degree exterior orbital flyaround around architectural building facade, lush landscaped perimeter gardens, dusk ambient lighting',
      pedestal_balcony: 'Slow vertical pedestal rise from balcony teak floor up to panoramic horizon vista, soft breeze rustling drapery, hyper-realistic reflections'
    };

    const styles = {
      scandi: 'virtually staged in contemporary Nordic Scandinavian minimalism, light oak flooring, muted earth tones, linen upholstery, indoor greenery',
      luxury: 'virtually staged in executive luxury penthouse aesthetic, Italian Calacatta marble, brushed champagne brass accents, ambient recessed LED illumination',
      minimalist: 'virtually staged in clean Japandi architectural layout, low-profile furniture, natural textured clay walls, soft diffused daylight',
      coastal: 'virtually staged in luxury Swahili coastal villa aesthetic, woven rattan finishes, white-washed walls, ocean breeze drapery'
    };

    promptEl.value = `[HIGGSFIELD CINEMA STUDIO v3]: ${motions[motion]}, ${styles[style]}, depicting ${unitName} (${unitType}), photorealistic textures, zero character drift via Soul ID, architectural showcase standard.`;
  }

  setHiggsfieldRatio(btn, ratio) {
    document.querySelectorAll('.aspect-btn').forEach(b => {
      b.classList.remove('active', 'bg-violet-600', 'text-white', 'border-violet-600');
      b.classList.add('bg-white', 'text-slate-700', 'border-slate-300');
    });
    btn.classList.add('active', 'bg-violet-600', 'text-white', 'border-violet-600');
    btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-300');
    this.state.hgRatio = ratio;
  }

  generateHiggsfieldVideo() {
    const btn = document.getElementById('btn-hg-generate');
    const barContainer = document.getElementById('hg-render-bar-container');
    const bar = document.getElementById('hg-render-bar');
    const stepLabel = document.getElementById('hg-render-step');
    const pctLabel = document.getElementById('hg-render-pct');
    const graphic = document.getElementById('hg-viewport-graphic');
    const hudCoords = document.getElementById('hg-hud-coords');

    btn.disabled = true;
    barContainer.classList.remove('hidden');

    const steps = [
      { pct: 15, msg: 'Choreographing camera splines in Cinema Studio...' },
      { pct: 38, msg: 'Resolving architectural lighting & ray-traced reflections...' },
      { pct: 67, msg: 'Applying Soul ID consistent materials & staging...' },
      { pct: 89, msg: 'Physics-aware frame interpolation (60 fps 4K)...' },
      { pct: 100, msg: 'Master render finished!' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        const s = steps[currentStep];
        bar.style.width = `${s.pct}%`;
        pctLabel.textContent = `${s.pct}%`;
        stepLabel.textContent = s.msg;
        hudCoords.textContent = `CAM: [X: ${(Math.random()*20).toFixed(1)}, Y: ${(Math.random()*15).toFixed(1)}, Z: ${(Math.random()*5).toFixed(1)}] · 35mm f/1.8`;
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          barContainer.classList.add('hidden');
          btn.disabled = false;
          
          if (window.gsap) {
            gsap.fromTo(graphic, 
              { scale: 0.92, opacity: 0 }, 
              { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' }
            );
          }

          document.getElementById('hg-preview-title').innerHTML = `
            <span class="text-emerald-400 flex items-center justify-center space-x-1">
              <i data-lucide="check-circle" class="w-4 h-4 inline mr-1"></i>
              <span>4K Ultra-HD Tour Ready</span>
            </span>
          `;
          document.getElementById('hg-preview-desc').textContent = 'Render completed via Higgsfield Soul ID. Ready to broadcast to prospective tenants via WhatsApp or syndicate to property portals.';
          if (window.lucide) lucide.createIcons();

          this.showToast('Higgsfield 4K Virtual Walkthrough rendered successfully!', 'success');
        }, 400);
      }
    }, 450);
  }

  loadSampleTour(key) {
    const titles = {
      kilimani: 'Kilimani Royal Heights · Balcony Skyline Drone Reveal (4K)',
      nyali: 'Nyali Ocean Breeze Villas · 360 Beachfront Facade Flyaround (4K)',
      westlands: 'Westlands Executive Suites · Dolly Interior Walkthrough (4K)'
    };
    document.getElementById('hg-preview-title').textContent = titles[key] || 'Property Tour';
    document.getElementById('hg-preview-desc').textContent = 'Loaded verified footage from Higgsfield Cinema Studio library.';
    this.showToast(`Loaded ${titles[key]} preview`, 'info');
  }

  // ==========================================
  // BOMAHUT CORE: BULK 5TH RENT DUE REMINDERS & TENANT LEDGER
  // ==========================================
  dispatchBulk5thReminders() {
    this.openBulk5thSMSModal();
  }

  openBulk5thSMSModal() {
    const pendingInvoices = this.state.invoices.filter(i => Number(i.balance) > 0);
    const listEl = document.getElementById('sms-recipients-list');
    const countEl = document.getElementById('sms-recipients-count');
    const totalEl = document.getElementById('sms-total-arrears');
    const dispatchBtn = document.getElementById('btn-dispatch-5th-sms');

    if (!listEl) return;

    if (pendingInvoices.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-500 dark:text-zinc-400">
          <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-500 mx-auto mb-2"></i>
          <p class="font-bold text-slate-800 dark:text-zinc-200">All tenants are fully paid up!</p>
          <p class="mt-0.5">No overdue balances detected for the current billing cycle.</p>
        </div>
      `;
      if (countEl) countEl.textContent = '0 Tenants';
      if (totalEl) totalEl.textContent = this.formatMoney(0);
      if (dispatchBtn) dispatchBtn.disabled = true;
      this.openModal('modal-send-5th-sms');
      if (window.lucide) lucide.createIcons();
      return;
    }

    const totalArrears = pendingInvoices.reduce((acc, i) => acc + Number(i.balance), 0);
    if (countEl) countEl.textContent = `${pendingInvoices.length} Tenants`;
    if (totalEl) totalEl.textContent = this.formatMoney(totalArrears);
    if (dispatchBtn) dispatchBtn.disabled = false;

    listEl.innerHTML = pendingInvoices.map(inv => `
      <label class="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer text-xs">
        <div class="flex items-center space-x-3">
          <input type="checkbox" name="sms-invoice-check" value="${inv.id}" checked class="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4">
          <div>
            <div class="font-bold text-slate-900 dark:text-zinc-100">${inv.tenant_name}</div>
            <div class="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">${inv.property_name || 'Property'} &bull; Unit ${inv.unit_number} &bull; ${inv.tenant_phone}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-mono font-bold text-rose-600 dark:text-rose-400">${this.formatMoney(inv.balance)}</div>
          <div class="text-[10px] text-slate-400 uppercase font-semibold">${inv.status}</div>
        </div>
      </label>
    `).join('');

    this.openModal('modal-send-5th-sms');
    if (window.lucide) lucide.createIcons();
  }

  toggleAllSmsRecipients() {
    const checkboxes = document.querySelectorAll('input[name="sms-invoice-check"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
  }

  async executeBulk5thSmsDispatch() {
    const checkedBoxes = document.querySelectorAll('input[name="sms-invoice-check"]:checked');
    if (checkedBoxes.length === 0) {
      this.showToast('Please select at least one tenant to send reminder.', 'warning');
      return;
    }

    const selectedIds = Array.from(checkedBoxes).map(cb => Number(cb.value));
    const targetInvoices = this.state.invoices.filter(i => selectedIds.includes(i.id));

    const btnText = document.getElementById('btn-dispatch-5th-sms-text');
    const dispatchBtn = document.getElementById('btn-dispatch-5th-sms');
    if (dispatchBtn) dispatchBtn.disabled = true;

    let dispatched = 0;
    for (let idx = 0; idx < targetInvoices.length; idx++) {
      const inv = targetInvoices[idx];
      if (btnText) btnText.textContent = `Sending (${idx + 1}/${targetInvoices.length})...`;

      const msg = `Dear ${inv.tenant_name}, rent for Unit ${inv.unit_number} (${inv.month}) is due on 5th. Total: KES ${Number(inv.balance).toLocaleString()} (incl. water/utilities). Pay via ${inv.paybill_number || 'Paybill 522522'}. - BomaSphere Management`;

      try {
        await this.fetchAPI('/api/communications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'sms',
            recipient_name: inv.tenant_name,
            recipient_phone: inv.tenant_phone,
            tenant_id: inv.tenant_id,
            message: msg,
            purpose: 'rent_reminder'
          })
        });
        dispatched++;
      } catch (err) {
        console.error('Failed to dispatch reminder to', inv.tenant_name, err);
      }
    }

    if (btnText) btnText.textContent = 'Dispatch Reminders';
    if (dispatchBtn) dispatchBtn.disabled = false;
    this.closeModal('modal-send-5th-sms');
    this.showToast(`⚡ Successfully dispatched ${dispatched} automated SMS rent due reminders!`, 'success');
    await this.refreshAllData();
    this.switchView('communications');
  }

  viewTenantLedger(tenantId) {
    const tenant = this.state.tenants.find(t => t.id === Number(tenantId));
    if (!tenant) return;

    const invoices = this.state.invoices.filter(i => i.tenant_id === tenant.id);
    const payments = this.state.payments.filter(p => p.tenant_id === tenant.id);

    const modalTitle = document.getElementById('printable-modal-title');
    if (modalTitle) modalTitle.textContent = `Tenant Account Statement: ${tenant.name}`;

    const area = document.getElementById('printable-area');
    area.innerHTML = `
      <div class="border border-slate-200 rounded-xl p-8 max-w-3xl mx-auto bg-white text-slate-900 font-sans">
        <div class="flex items-start justify-between border-b pb-4">
          <div>
            <h2 class="font-black text-2xl tracking-tight text-slate-900">BomaSphere Property Management</h2>
            <p class="text-xs text-slate-500">Official Tenant Statement of Account</p>
            <p class="text-xs text-slate-500 font-mono">ODPC Compliant &bull; NextGen Mall, Nairobi</p>
          </div>
          <div class="text-right">
            <span class="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-slate-900 text-white">Statement</span>
            <p class="text-xs text-slate-500 mt-2">Date: ${new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 my-6 text-xs">
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span class="text-slate-400 font-bold uppercase text-[10px]">Tenant Details:</span>
            <p class="font-bold text-slate-900 text-sm mt-1">${tenant.name}</p>
            <p class="text-slate-600">${tenant.property_name || 'Kilimani Heights'} &bull; Unit ${tenant.unit_number || 'A101'}</p>
            <p class="text-slate-600 font-mono mt-0.5">Phone: ${tenant.phone} &bull; ID: ${tenant.id_number || 'N/A'}</p>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span class="text-slate-400 font-bold uppercase text-[10px]">Current Account Status:</span>
            <div>
              <span class="text-2xl font-extrabold ${Number(tenant.total_balance) > 0 ? 'text-rose-600' : 'text-emerald-600'} font-mono">
                KES ${Number(tenant.total_balance || 0).toLocaleString()}
              </span>
              <p class="text-[11px] text-slate-500">${Number(tenant.total_balance) > 0 ? 'Outstanding Arrears Due' : 'Account Cleared & In Good Standing'}</p>
            </div>
          </div>
        </div>

        <h4 class="font-bold text-slate-800 uppercase text-xs tracking-wider mb-2">Itemized Invoices & Utility Debits</h4>
        <table class="w-full text-left text-xs mb-6 border border-slate-200 rounded-lg overflow-hidden">
          <thead class="bg-slate-50 text-slate-600 font-semibold border-b">
            <tr>
              <th class="py-2.5 px-3">Invoice #</th>
              <th class="py-2.5 px-3">Month</th>
              <th class="py-2.5 px-3 text-right">Rent</th>
              <th class="py-2.5 px-3 text-right">Water</th>
              <th class="py-2.5 px-3 text-right">Service/Garb.</th>
              <th class="py-2.5 px-3 text-right">Total Due</th>
              <th class="py-2.5 px-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-mono">
            ${invoices.map(i => `
              <tr>
                <td class="py-2 px-3 font-semibold text-slate-800">${i.invoice_number}</td>
                <td class="py-2 px-3">${i.month}</td>
                <td class="py-2 px-3 text-right">KES ${Number(i.rent_amount).toLocaleString()}</td>
                <td class="py-2 px-3 text-right">KES ${Number(i.water_amount).toLocaleString()}</td>
                <td class="py-2 px-3 text-right">KES ${Number(Number(i.garbage_amount)+Number(i.service_charge)).toLocaleString()}</td>
                <td class="py-2 px-3 text-right font-bold">KES ${Number(i.total_amount).toLocaleString()}</td>
                <td class="py-2 px-3 text-right font-bold ${Number(i.balance) > 0 ? 'text-rose-600' : 'text-slate-400'}">KES ${Number(i.balance).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h4 class="font-bold text-slate-800 uppercase text-xs tracking-wider mb-2">Verified Payment Credits (M-Pesa & Bank)</h4>
        <table class="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead class="bg-slate-50 text-slate-600 font-semibold border-b">
            <tr>
              <th class="py-2.5 px-3">Receipt #</th>
              <th class="py-2.5 px-3">Date & Time</th>
              <th class="py-2.5 px-3">Method</th>
              <th class="py-2.5 px-3">M-Pesa / Bank Ref</th>
              <th class="py-2.5 px-3 text-right">Amount Credited</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-mono">
            ${payments.map(p => `
              <tr>
                <td class="py-2 px-3 font-semibold text-slate-800">${p.receipt_number}</td>
                <td class="py-2 px-3 text-slate-500 font-sans">${p.payment_date}</td>
                <td class="py-2 px-3 font-sans">${p.payment_method}</td>
                <td class="py-2 px-3 font-bold text-emerald-700">${p.reference_code}</td>
                <td class="py-2 px-3 text-right font-bold text-emerald-600">+KES ${Number(p.amount).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <p>Certified Official Statement generated by BomaSphere PMS.</p>
          <button onclick="window.print()" class="px-3 py-1 bg-slate-900 text-white rounded font-bold no-print">Print Statement</button>
        </div>
      </div>
    `;

    this.openModal('modal-printable');
  }

  // ==========================================
  // HELPERS & BADGE CLASSES
  // ==========================================
  getUnitBadgeClass(status) {
    switch (status) {
      case 'occupied': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'vacant': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'maintenance': return 'bg-amber-50 text-amber-700 border border-amber-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  getInvoiceBadgeClass(status) {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'partially_paid': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'unpaid': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'overdue': return 'bg-rose-50 text-rose-700 border border-rose-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  getPriorityBadgeClass(priority) {
    switch (priority) {
      case 'emergency': return 'bg-rose-100 text-rose-800 border border-rose-300';
      case 'high': return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  getTicketBadgeClass(status) {
    switch (status) {
      case 'open': return 'bg-slate-100 text-slate-700';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-amber-100 text-amber-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  // ==========================================
  // REAL RBAC AUTHENTICATION, SESSIONS & THEMES
  // ==========================================
  restoreThemeAndMode() {
    // Theme
    const savedTheme = localStorage.getItem('bomasphere_theme') || 'swiss';
    this.setTheme(savedTheme, false);

    // Dark Mode
    const savedDark = localStorage.getItem('bomasphere_dark');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedDark !== null ? savedDark === 'true' : prefersDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.querySelectorAll('.dark-mode-icon, #dark-mode-icon, .dark-mode-icon-mobile').forEach(icon => {
      icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    });

    if (window.lucide) lucide.createIcons();
  }

  toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('bomasphere_dark', isDark ? 'true' : 'false');
    document.querySelectorAll('.dark-mode-icon, #dark-mode-icon, .dark-mode-icon-mobile').forEach(icon => {
      icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    });
    if (window.lucide) lucide.createIcons();
    this.showToast(isDark ? 'Dark Mode Active' : 'Light Mode Active', 'info');
  }

  setTheme(themeName, showToast = true) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('bomasphere_theme', themeName);
    const selector = document.getElementById('theme-selector');
    if (selector) selector.value = themeName;
    if (showToast) {
      const names = {
        swiss: 'Swiss Minimal',
        emerald: 'Savanna Emerald',
        ivory: 'Warm Ivory',
        obsidian: 'Obsidian Cyber'
      };
      this.showToast(`Applied Theme: ${names[themeName] || themeName}`, 'info');
    }
  }

  // ==========================================
  // PROGRESSIVE WEB APP (PWA) & SERVICE WORKER
  // ==========================================
  initServiceWorkerAndPwa() {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => {
            console.log('[PWA] Service Worker registered with scope:', reg.scope);
          })
          .catch(err => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // 2. Capture BeforeInstallPrompt for native installability
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferredPwaPrompt = e;
      console.log('[PWA] Captured beforeinstallprompt event. Ready for native install.');

      // Unhide install buttons on desktop header & mobile topbar
      const btn = document.getElementById('btn-pwa-install');
      const mobileBtn = document.getElementById('btn-pwa-install-mobile');
      if (btn) {
        btn.classList.remove('hidden');
        btn.classList.add('flex');
      }
      if (mobileBtn) {
        mobileBtn.classList.remove('hidden');
        mobileBtn.classList.add('flex');
      }
      if (window.lucide) lucide.createIcons();
    });

    // 3. Handle App Installed event
    window.addEventListener('appinstalled', () => {
      this.deferredPwaPrompt = null;
      const btn = document.getElementById('btn-pwa-install');
      const mobileBtn = document.getElementById('btn-pwa-install-mobile');
      if (btn) btn.classList.add('hidden');
      if (mobileBtn) mobileBtn.classList.add('hidden');
      this.showToast('BomaSphere installed as a native app!', 'success');
      console.log('[PWA] Application successfully installed.');
    });
  }

  async promptPwaInstall() {
    if (!this.deferredPwaPrompt) {
      this.showToast('To install BomaSphere, tap your browser menu and choose "Install App" or "Add to Home Screen".', 'info');
      return;
    }

    this.deferredPwaPrompt.prompt();
    const choice = await this.deferredPwaPrompt.userChoice;
    console.log('[PWA] User install choice outcome:', choice ? choice.outcome : 'unknown');
    this.deferredPwaPrompt = null;

    const btn = document.getElementById('btn-pwa-install');
    const mobileBtn = document.getElementById('btn-pwa-install-mobile');
    if (btn) btn.classList.add('hidden');
    if (mobileBtn) mobileBtn.classList.add('hidden');
  }

  // Real Server-Enforced RBAC Session Initialization
  async initAuthSession() {
    const savedToken = localStorage.getItem('bomasphere_token');
    if (savedToken) {
      this.state.authToken = savedToken;
      try {
        const res = await this.fetchAPI('/api/auth/me');
        if (res && res.user) {
          this.state.authUser = res.user;
          this.updateUserSessionDisplay();
          return;
        }
      } catch (e) {
        console.warn('Session expired or invalid, please sign in.');
      }
    }
    // If no valid authenticated session, present the clean Sign In screen
    this.openAuthModal();
  }

  async handlePasswordLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    const emailEl = document.getElementById('login-email-input');
    const passwordEl = document.getElementById('login-password-input');
    const errAlert = document.getElementById('login-error-alert');
    const errText = document.getElementById('login-error-text');
    const submitBtn = document.getElementById('login-submit-btn');

    if (errAlert) errAlert.classList.add('hidden');
    if (!emailEl || !passwordEl) return;

    const email = emailEl.value.trim();
    const password = passwordEl.value;

    if (!email || !password) {
      if (errAlert && errText) {
        errText.textContent = 'Please enter both your work email and password.';
        errAlert.classList.remove('hidden');
      }
      return;
    }

    const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Signing In...</span>
      `;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid email or password');
      }

      this.state.authToken = data.token;
      this.state.authUser = data.user;
      localStorage.setItem('bomasphere_token', data.token);

      this.closeModal('modal-auth-login');
      this.updateUserSessionDisplay();
      this.showToast(`Welcome back, ${data.user.name}!`, 'success');

      const banner = document.getElementById('rbac-restriction-banner');
      if (banner) banner.classList.add('hidden');

      await this.refreshAllData();

      if (data.user.role === 'tenant') {
        this.switchView('tenant-portal');
      } else if (data.user.role === 'caretaker') {
        this.switchView('water');
      } else if (data.user.role === 'landlord') {
        this.switchView('landlord');
      } else {
        this.switchView('dashboard');
      }
    } catch (err) {
      console.error('Sign in failed:', err);
      if (errAlert && errText) {
        errText.textContent = err.message || 'Invalid email or password. Please try again.';
        errAlert.classList.remove('hidden');
      } else {
        this.showToast(err.message || 'Sign in failed', 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    }
  }

  logout() {
    try {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.state.authToken ? `Bearer ${this.state.authToken}` : ''
        }
      }).catch(() => {});
    } catch (e) {}

    this.state.authToken = null;
    this.state.authUser = null;
    localStorage.removeItem('bomasphere_token');

    const emailInput = document.getElementById('login-email-input');
    const passwordInput = document.getElementById('login-password-input');
    const errAlert = document.getElementById('login-error-alert');
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (errAlert) errAlert.classList.add('hidden');

    this.showToast('You have been signed out successfully.', 'info');
    this.openAuthModal();
  }

  toggleLoginPasswordVisibility() {
    const input = document.getElementById('login-password-input');
    const btn = document.getElementById('btn-toggle-password');
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (btn) btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      if (btn) btn.textContent = 'Show';
    }
  }

  copyUserEmail(email) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(email);
    }
    this.showToast(`Email copied: ${email}`, 'info');
  }

  openAuthModal() {
    this.openModal('modal-auth-login');
  }

  updateUserSessionDisplay() {
    const user = this.state.authUser;
    if (!user) return;

    const roleTitles = {
      super_admin: 'Super Admin',
      property_manager: 'Property Manager',
      caretaker: 'Site Caretaker',
      landlord: 'Landlord / Investor',
      tenant: 'Resident Tenant'
    };

    const headerName = document.getElementById('header-user-name');
    const headerRole = document.getElementById('header-user-role');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarRole = document.getElementById('sidebar-user-role');
    const sidebarAvatar = document.getElementById('sidebar-user-avatar');

    const formattedRole = roleTitles[user.role] || user.role;

    if (headerName) headerName.textContent = user.name.split(' (')[0];
    if (headerRole) headerRole.textContent = `(${formattedRole})`;
    if (sidebarName) sidebarName.textContent = user.name.split(' (')[0];
    if (sidebarRole) sidebarRole.textContent = formattedRole;
    if (sidebarAvatar) {
      sidebarAvatar.textContent = user.name.substring(0, 2).toUpperCase();
    }
    const mobileRole = document.getElementById('mobile-user-role-chip');
    if (mobileRole) mobileRole.textContent = formattedRole;

    // Role-based Navigation Enforcement
    const permissions = {
      super_admin: ['dashboard', 'properties', 'tenants', 'invoices', 'payments', 'water', 'maintenance', 'communications', 'landlord', 'expenses', 'higgsfield', 'users', 'tenant-portal', 'leases', 'inspections', 'visitor-passes', 'amenities'],
      property_manager: ['dashboard', 'properties', 'tenants', 'invoices', 'payments', 'water', 'maintenance', 'communications', 'landlord', 'expenses', 'higgsfield', 'users', 'tenant-portal', 'leases', 'inspections', 'visitor-passes', 'amenities'],
      caretaker: ['dashboard', 'properties', 'water', 'maintenance', 'communications', 'inspections', 'visitor-passes'],
      landlord: ['dashboard', 'properties', 'landlord', 'maintenance', 'expenses', 'higgsfield'],
      tenant: ['tenant-portal', 'visitor-passes', 'amenities']
    };

    const allowed = permissions[user.role] || permissions.property_manager;

    document.querySelectorAll('.nav-link').forEach(link => {
      const view = link.dataset.view;
      if (allowed.includes(view)) {
        link.style.display = 'flex';
      } else {
        link.style.display = 'none';
      }
    });

    // Enforce mobile bottom navigation tabs
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
      const view = btn.dataset.view;
      if (view) {
        if (allowed.includes(view)) {
          btn.style.display = 'flex';
        } else {
          btn.style.display = 'none';
        }
      }
    });

    // Enforce action buttons and feature permissions
    this.enforceActionRBAC(user.role);

    if (!allowed.includes(this.state.currentView)) {
      this.switchView(allowed[0]);
    }
  }

  enforceActionRBAC(role) {
    const isCaretaker = role === 'caretaker';
    const isTenant = role === 'tenant';
    const isLandlord = role === 'landlord';

    document.querySelectorAll('[data-rbac]').forEach(el => {
      const rbacType = el.getAttribute('data-rbac');
      if (rbacType === 'financial' && (isCaretaker || isTenant)) {
        el.style.display = 'none';
      } else if (rbacType === 'invoicing' && (isCaretaker || isTenant || isLandlord)) {
        el.style.display = 'none';
      } else if (rbacType === 'admin' && (isCaretaker || isTenant || isLandlord)) {
        el.style.display = 'none';
      } else if (rbacType === 'expense' && (isCaretaker || isTenant)) {
        el.style.display = 'none';
      } else if (rbacType === 'leasing' && (isCaretaker || isTenant || isLandlord)) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    });

    // Caretaker financial masking on dashboard
    if (isCaretaker) {
      const collectionsEl = document.getElementById('dash-total-collections');
      const billedEl = document.getElementById('dash-gross-billed');
      const arrearsEl = document.getElementById('dash-aging-arrears');
      if (collectionsEl) collectionsEl.textContent = '🔒 Restricted';
      if (billedEl) billedEl.textContent = '🔒 Restricted';
      if (arrearsEl) arrearsEl.textContent = '🔒 Restricted';
    }
  }

  async switchAuthAccount(role, refresh = true) {
    try {
      const res = await this.fetchAPI('/api/auth/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (res && res.user) {
        this.state.authUser = res.user;
        this.state.authToken = res.token || `token_${res.user.role}`;
        localStorage.setItem('bomasphere_token', this.state.authToken);
        this.updateUserSessionDisplay();
        if (refresh) await this.refreshAllData();
        this.showToast(`Switched active profile to ${res.user.name}`, 'info');
      }
    } catch (err) {
      console.error('Failed to switch auth account:', err);
      // Fallback local switch
      const fallbackUser = this.state.users?.find(u => u.role === role) || { role, name: role };
      this.state.authUser = fallbackUser;
      this.state.authToken = `token_${role}`;
      localStorage.setItem('bomasphere_token', this.state.authToken);
      this.updateUserSessionDisplay();
    }
  }

  // Alias for backward compatibility
  async switchUserRole(role) {
    return await this.switchAuthAccount(role, true);
  }

  renderUsers() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    const users = this.state.users || [];
    const countEl = document.getElementById('users-count-label');
    if (countEl) countEl.textContent = `${users.length} Active System Users`;

    const roleBadges = {
      super_admin: 'bg-purple-50 text-purple-700 border border-purple-200',
      property_manager: 'bg-slate-900 text-white',
      caretaker: 'bg-blue-50 text-blue-700 border border-blue-200',
      landlord: 'bg-amber-50 text-amber-700 border border-amber-200',
      tenant: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    };

    const roleNames = {
      super_admin: 'Super Admin',
      property_manager: 'Property Manager',
      caretaker: 'Site Caretaker',
      landlord: 'Landlord',
      tenant: 'Resident Tenant'
    };

    tbody.innerHTML = users.map(u => {
      const prop = this.state.properties.find(p => p.id === u.property_id);
      const scopeLabel = prop ? prop.name : 'Global (All Portfolios)';
      return `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-3 px-4">
            <div class="flex items-center space-x-2.5">
              <div class="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs uppercase">
                ${u.name.substring(0, 2)}
              </div>
              <div>
                <p class="font-bold text-slate-800">${u.name}</p>
                <p class="text-[10px] text-slate-400">ID #${u.id}</p>
              </div>
            </div>
          </td>
          <td class="py-3 px-4">
            <div class="text-slate-800 font-medium">${u.email}</div>
            <div class="text-[11px] font-mono text-slate-500">${u.phone || 'N/A'}</div>
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${roleBadges[u.role] || 'bg-slate-100 text-slate-700'}">
              ${roleNames[u.role] || u.role}
            </span>
          </td>
          <td class="py-3 px-4 text-xs font-medium text-slate-700">
            ${scopeLabel}
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
              ${u.status || 'active'}
            </span>
          </td>
          <td class="py-3 px-4 text-right space-x-1.5">
            <button onclick="app.copyUserEmail('${u.email}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-[11px] transition">
              Copy Email
            </button>
            <button onclick="app.deleteUser(${u.id})" class="p-1 text-slate-400 hover:text-rose-600 rounded transition" title="Delete User">
              <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  openAddUserModal() {
    const propSelect = document.getElementById('user-prop-input');
    if (propSelect) {
      propSelect.innerHTML = `
        <option value="">-- All Properties (Global Access) --</option>
        ${this.state.properties.map(p => `<option value="${p.id}">${p.name} (${p.city})</option>`).join('')}
      `;
    }
    this.openModal('modal-add-user');
  }

  async handleAddUserSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('user-name-input').value;
    const email = document.getElementById('user-email-input').value;
    const phone = document.getElementById('user-phone-input').value;
    const role = document.getElementById('user-role-input').value;
    const propVal = document.getElementById('user-prop-input').value;

    try {
      await this.fetchAPI('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          role,
          property_id: propVal ? Number(propVal) : null
        })
      });

      this.closeModal('modal-add-user');
      document.getElementById('form-add-user').reset();
      this.showToast(`User ${name} provisioned successfully!`, 'success');
      await this.refreshAllData();
      this.renderUsers();
    } catch (err) {
      console.error(err);
    }
  }

  async deleteUser(userId) {
    if (!confirm('Are you sure you want to deactivate and remove this user?')) return;
    try {
      await this.fetchAPI(`/api/users/${userId}`, { method: 'DELETE' });
      this.showToast('User removed successfully', 'info');
      await this.refreshAllData();
      this.renderUsers();
    } catch (err) {
      console.error(err);
    }
  }

  // ==========================================
  // NEXT-GEN PRODUCTION FEATURES (1 - 5)
  // ==========================================

  // FEATURE 1: 2-Way Interactive WhatsApp Business Bot
  async sendTestWhatsapp(cmd) {
    const input = document.getElementById('whatsapp-input-text');
    if (input) input.value = cmd;
    await this.sendCustomWhatsapp();
  }

  async sendCustomWhatsapp() {
    const input = document.getElementById('whatsapp-input-text');
    const stream = document.getElementById('whatsapp-chat-stream');
    if (!input || !stream) return;

    const message = input.value.trim();
    if (!message) return;
    input.value = '';

    const outDiv = document.createElement('div');
    outDiv.className = 'flex items-start justify-end space-x-2';
    outDiv.innerHTML = `
      <div class="bg-emerald-700 text-white p-2.5 rounded-2xl rounded-tr-xs max-w-sm text-[11px] leading-relaxed">
        ${escapeHtml(message)}
      </div>
    `;
    stream.appendChild(outDiv);
    stream.scrollTop = stream.scrollHeight;

    try {
      const res = await this.fetchAPI('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, phone: '+254722889900' })
      });

      const inDiv = document.createElement('div');
      inDiv.className = 'flex items-start space-x-2 pt-1';
      inDiv.innerHTML = `
        <div class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">W</div>
        <div class="bg-slate-800 text-slate-100 p-2.5 rounded-2xl rounded-tl-xs max-w-sm text-[11px] leading-relaxed">
          ${escapeHtml(res.reply).replace(/\n/g, '<br>')}
        </div>
      `;
      stream.appendChild(inDiv);
      stream.scrollTop = stream.scrollHeight;

      if (res.action === 'pay') {
        this.showToast('M-Pesa STK push initiated via WhatsApp!', 'success');
      } else if (res.action === 'ticket') {
        this.showToast('Maintenance ticket created via WhatsApp webhook!', 'success');
        await this.refreshAllData();
      }
    } catch (err) {
      console.error('WhatsApp webhook error:', err);
    }
  }

  // FEATURE 2: AI Tenant Vetting & CRB Scoring
  async openTenantVettingModal() {
    const select = document.getElementById('vet-unit-select');
    if (select) {
      select.innerHTML = this.state.units.map(u => `
        <option value="${u.id}">Unit ${u.unit_number} - ${u.unit_type} (KES ${Number(u.base_rent).toLocaleString()})</option>
      `).join('');
    }
    await this.loadTenantVettings();
    this.openModal('modal-tenant-vetting');
  }

  async loadTenantVettings() {
    try {
      const res = await this.fetchAPI('/api/tenant-vetting');
      const tbody = document.getElementById('vetting-table-body');
      if (!tbody) return;

      const vettings = res.vettings || [];
      tbody.innerHTML = vettings.map(v => {
        const riskColor = v.risk_category.includes('Low') 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
          : (v.risk_category.includes('Medium') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200');

        return `
          <tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50">
            <td class="py-2.5 px-3">
              <span class="font-bold text-slate-800 dark:text-zinc-200 block">${escapeHtml(v.applicant_name)}</span>
              <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(v.phone)}</span>
            </td>
            <td class="py-2.5 px-3 font-medium">Unit ${v.unit_number || 'A202'}</td>
            <td class="py-2.5 px-3">
              <div class="font-bold">KES ${Number(v.monthly_income).toLocaleString()}</div>
              <span class="text-[10px] text-slate-500">Rent-to-Income: ${v.rent_to_income_pct}%</span>
            </td>
            <td class="py-2.5 px-3 font-mono font-bold ${v.crb_score >= 700 ? 'text-emerald-600' : 'text-amber-600'}">${v.crb_score}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${riskColor}">${escapeHtml(v.risk_category)}</span>
            </td>
            <td class="py-2.5 px-3 text-[11px] text-slate-600 dark:text-zinc-300 max-w-xs truncate" title="${escapeHtml(v.recommendation)}">
              ${escapeHtml(v.recommendation)}
            </td>
          </tr>
        `;
      }).join('');
      if (window.lucide) lucide.createIcons();
    } catch (e) {
      console.warn('Vettings load error:', e);
    }
  }

  async submitTenantVetting(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-vetting');
    const name = document.getElementById('vet-name').value;
    const phone = document.getElementById('vet-phone').value;
    const idNum = document.getElementById('vet-id').value;
    const income = document.getElementById('vet-income').value;
    const unitId = document.getElementById('vet-unit-select').value;

    btn.disabled = true;
    btn.innerHTML = '<span>Screening CRB &amp; Cash Flow...</span>';

    try {
      const res = await this.fetchAPI('/api/tenant-vetting/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicant_name: name, phone, id_number: idNum, monthly_income: income, requested_unit_id: unitId })
      });

      this.showToast(`Vetting Complete: ${res.applicant_name} scored ${res.crb_score} (${res.risk_category})`, 'success');
      document.getElementById('form-vetting').reset();
      await this.loadTenantVettings();
    } catch (err) {
      alert(err.message || 'Vetting analysis failed');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="zap" class="w-3.5 h-3.5"></i><span>Execute Instant AI Risk Assessment</span>';
      if (window.lucide) lucide.createIcons();
    }
  }

  // FEATURE 3: Smart IoT Telemetry & Burst Leak Detection
  toggleIotPanel() {
    const panel = document.getElementById('iot-telemetry-panel');
    if (panel) {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        this.refreshIotTelemetry();
      }
    }
  }

  async refreshIotTelemetry() {
    try {
      const [devRes, alertRes] = await Promise.all([
        this.fetchAPI('/api/iot/devices'),
        this.fetchAPI('/api/iot/leak-alerts')
      ]);

      const devices = devRes.devices || [];
      const alerts = alertRes.alerts || [];

      const alertContainer = document.getElementById('iot-leak-alert-container');
      if (alertContainer) {
        if (alerts.length > 0) {
          const a = alerts[0];
          alertContainer.innerHTML = `
            <div class="bg-rose-950/70 border border-rose-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-200 text-xs">
              <div class="flex items-start space-x-2.5">
                <i data-lucide="alert-triangle" class="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce"></i>
                <div>
                  <div class="font-bold text-white flex items-center space-x-2">
                    <span>${escapeHtml(a.title)}</span>
                    <span class="bg-rose-600 text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">Continuous Flow: ${a.flow_detected_lph} L/hr</span>
                  </div>
                  <p class="text-[11px] text-rose-300 mt-0.5">${escapeHtml(a.message)}</p>
                </div>
              </div>
              <button onclick="app.toggleSmartValve(${a.device_id}, 'closed')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-md transition shrink-0 flex items-center space-x-1">
                <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i>
                <span>Emergency Valve Shutoff</span>
              </button>
            </div>
          `;
        } else {
          alertContainer.innerHTML = `
            <div class="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 flex items-center space-x-2 text-emerald-300 text-xs">
              <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>
              <span>All smart water meters operating within normal baseline. No active pipe leaks detected.</span>
            </div>
          `;
        }
      }

      const grid = document.getElementById('iot-devices-grid');
      if (grid) {
        grid.innerHTML = devices.map(d => `
          <div class="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-mono font-bold text-emerald-400">${d.meter_number}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${d.valve_status === 'open' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">
                Valve ${d.valve_status}
              </span>
            </div>
            <div>
              <p class="font-bold text-white">Unit ${d.unit_number || 'A101'}</p>
              <p class="text-[10px] text-slate-400 truncate">${d.property_name}</p>
            </div>
            <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-300 pt-1 border-t border-slate-700/60">
              <div>Flow: <span class="font-bold ${d.flow_rate_lph > 0 ? 'text-amber-400' : 'text-slate-400'}">${d.flow_rate_lph} L/h</span></div>
              <div>Battery: <span class="font-bold text-slate-200">${d.battery_pct}%</span></div>
              <div>Signal: <span class="font-mono">${d.signal_rssi} dBm</span></div>
              <div>Total: <span class="font-bold text-slate-200">${d.total_cubic_meters} m³</span></div>
            </div>
            <div class="pt-1">
              <button onclick="app.toggleSmartValve(${d.id}, '${d.valve_status === 'open' ? 'closed' : 'open'}')" class="w-full py-1 text-[11px] rounded bg-slate-700 hover:bg-slate-600 text-white font-medium transition">
                Toggle ${d.valve_status === 'open' ? 'Shutoff' : 'Open'}
              </button>
            </div>
          </div>
        `).join('');
      }

      if (window.lucide) lucide.createIcons();
    } catch (e) {
      console.warn('IoT telemetry error:', e);
    }
  }

  async toggleSmartValve(deviceId, newStatus) {
    try {
      await this.fetchAPI('/api/iot/valve-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, valve_status: newStatus })
      });
      this.showToast(`Valve command executed: Meter #${deviceId} is now ${newStatus.toUpperCase()}`, 'info');
      await this.refreshIotTelemetry();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // FEATURE 4: Multi-Property KRA eTIMS & 7.5% MRI Tax
  async openEtimsModal(invoiceId) {
    try {
      const res = await this.fetchAPI(`/api/tax/etims/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId || 1 })
      });

      const rec = res.record;
      const content = document.getElementById('etims-cert-content');
      if (content) {
        content.innerHTML = `
          <div class="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-center space-y-2">
            <div class="font-mono font-bold text-sm text-slate-900 dark:text-white">${rec.control_code}</div>
            <div class="inline-block bg-white p-2 rounded-lg border border-slate-200 shadow-xs">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(rec.qr_code_url)}" alt="eTIMS QR Code" class="w-32 h-32 mx-auto">
            </div>
            <p class="text-[11px] text-slate-500 font-mono">Scan to verify electronic signature on itax.kra.go.ke</p>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-lg border border-slate-200 dark:border-zinc-700">
              <span class="text-[10px] text-slate-400 uppercase font-semibold">Taxable Rental Income</span>
              <p class="font-bold text-sm text-slate-800 dark:text-zinc-200">KES ${Number(rec.taxable_amount).toLocaleString()}</p>
            </div>
            <div class="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <span class="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">7.5% MRI Tax Withheld</span>
              <p class="font-bold text-sm text-emerald-800 dark:text-emerald-300">KES ${Number(rec.tax_payable).toLocaleString()}</p>
            </div>
          </div>

          <div class="text-[11px] text-slate-500 p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-lg">
            <strong>KRA Section 6A Compliance:</strong> Monthly Rental Income (MRI) Tax rate of 7.5% applied on gross residential receipts. Transmitted via KRA VSCU middleware.
          </div>
        `;
      }

      this.openModal('modal-etims-cert');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // FEATURE 5: Artisan Escrow Marketplace
  async openArtisanMarketplaceModal() {
    await this.loadMarketplace();
    this.openModal('modal-artisan-marketplace');
  }

  async loadMarketplace() {
    try {
      const [fundisRes, escrowsRes] = await Promise.all([
        this.fetchAPI('/api/marketplace/fundis'),
        this.fetchAPI('/api/marketplace/escrows')
      ]);

      const fundis = fundisRes.fundis || [];
      const escrows = escrowsRes.escrows || [];

      const fundisGrid = document.getElementById('fundis-directory-grid');
      if (fundisGrid) {
        fundisGrid.innerHTML = fundis.map(f => `
          <div class="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800 dark:text-zinc-100">${escapeHtml(f.name)}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                ★ ${f.rating} (${f.jobs_completed} jobs)
              </span>
            </div>
            <p class="text-[11px] text-slate-500">${escapeHtml(f.trade)} &bull; ${escapeHtml(f.location)}</p>
            <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-zinc-700/60 text-[11px]">
              <span class="font-mono font-semibold text-slate-700 dark:text-zinc-300">KES ${Number(f.daily_rate).toLocaleString()}/day</span>
              <a href="tel:${f.phone}" class="text-emerald-600 font-semibold hover:underline">${f.phone}</a>
            </div>
          </div>
        `).join('');
      }

      const tbody = document.getElementById('escrows-table-body');
      if (tbody) {
        tbody.innerHTML = escrows.map(e => `
          <tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50">
            <td class="py-2.5 px-3 font-mono font-bold">${e.ticket_number}</td>
            <td class="py-2.5 px-3">
              <span class="font-semibold text-slate-800 dark:text-zinc-200">${escapeHtml(e.fundi_name || 'Vetted Fundi')}</span>
              <span class="text-[10px] text-slate-400 block">${escapeHtml(e.fundi_trade || '')}</span>
            </td>
            <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">KES ${Number(e.amount).toLocaleString()}</td>
            <td class="py-2.5 px-3 text-[11px] text-slate-500 max-w-xs truncate">${escapeHtml(e.milestone_desc || 'Repair completed')}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${e.status === 'held' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
                ${e.status === 'held' ? 'Held in Escrow' : 'Disbursed (B2C)'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-right">
              ${e.status === 'held' ? `
                <button onclick="app.releaseEscrow(${e.id})" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] shadow-xs transition">
                  Release M-Pesa
                </button>
              ` : `
                <span class="font-mono text-[10px] text-emerald-600">${e.b2c_disbursement_ref || 'PAID'}</span>
              `}
            </td>
          </tr>
        `).join('');
      }

      if (window.lucide) lucide.createIcons();
    } catch (e) {
      console.warn('Marketplace load error:', e);
    }
  }

  async releaseEscrow(escrowId) {
    if (!confirm('Authorize M-Pesa B2C disbursement for completed repair milestone?')) return;
    try {
      const res = await this.fetchAPI('/api/marketplace/escrow/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escrow_id: escrowId })
      });
      this.showToast(`🎉 Escrow Disbursed! ${res.b2c_disbursement_ref} sent to fundi via M-Pesa B2C.`, 'success');
      await this.loadMarketplace();
      await this.refreshAllData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================
  // MULTI-CURRENCY & ENTERPRISE MODULES
  // ==========================================
  setCurrency(curr) {
    this.state.currency = curr || 'KES';
    try {
      localStorage.setItem('bomasphere_currency', this.state.currency);
    } catch (e) {}

    const sel = document.getElementById('currency-selector');
    if (sel && sel.value !== this.state.currency) {
      sel.value = this.state.currency;
    }

    // Always update dashboard summary elements
    this.updateDashboardKPIs();

    // Re-render current active view
    this.renderCurrentView();

    const currNames = { KES: 'Kenyan Shillings (KES)', USD: 'US Dollars ($)', GBP: 'British Pounds (£)', EUR: 'Euros (€)' };
    this.showToast(`Active Currency: ${currNames[this.state.currency] || this.state.currency}`, 'info');
  }

  formatMoney(amt) {
    if (amt === null || amt === undefined || isNaN(Number(amt))) return '-';
    const val = Number(amt);
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const c = this.state.currency || 'KES';

    let formatted = '';
    if (c === 'USD') {
      formatted = '$' + (absVal / 129.50).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (c === 'GBP') {
      formatted = '£' + (absVal / 168.20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (c === 'EUR') {
      formatted = '€' + (absVal / 141.00).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      formatted = 'KES ' + Math.round(absVal).toLocaleString();
    }

    return isNegative ? `-${formatted}` : formatted;
  }

  // MODULE 1: DIGITAL LEASE AGREEMENTS & E-SIGNATURES
  renderLeases() {
    const tbody = document.getElementById('leases-table-body');
    if (!tbody) return;
    const leases = this.state.leaseAgreements || [];
    if (!leases.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No digital lease agreements on record.</td></tr>`;
      return;
    }

    tbody.innerHTML = leases.map(l => {
      const isSigned = l.tenant_signed || l.status === 'executed';
      const signBadge = isSigned 
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
             <i data-lucide="check-circle" class="w-3 h-3 mr-1"></i> E-Signed (${l.tenant_signed_at ? l.tenant_signed_at.substring(0, 10) : 'Digital'})
           </span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
             <i data-lucide="clock" class="w-3 h-3 mr-1"></i> Awaiting Signature
           </span>`;

      const statusBadge = l.status === 'executed'
        ? `<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Executed</span>`
        : `<span class="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">${this.escapeHtml(l.status || 'Pending')}</span>`;

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition">
          <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${this.escapeHtml(l.agreement_code)}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-800 dark:text-zinc-200">${this.escapeHtml(l.property_name || 'Kilimani Royal Heights')}</div>
            <div class="text-[11px] text-slate-400">Unit ${this.escapeHtml(l.unit_number || 'A101')}</div>
          </td>
          <td class="py-3 px-4 text-slate-800 dark:text-zinc-200 font-medium">${this.escapeHtml(l.tenant_name || 'Resident')}</td>
          <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${this.formatMoney(l.monthly_rent)}</td>
          <td class="py-3 px-4 text-slate-500 dark:text-zinc-400 text-[11px]">
            ${this.escapeHtml(l.start_date)} to ${this.escapeHtml(l.end_date)}
          </td>
          <td class="py-3 px-4">${signBadge}</td>
          <td class="py-3 px-4">${statusBadge}</td>
          <td class="py-3 px-4 text-right">
            ${isSigned 
              ? `<button onclick="app.viewLeaseDetails(${l.id})" class="px-2.5 py-1 text-slate-600 hover:text-slate-900 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-semibold text-[11px] transition">View Hash</button>`
              : `<button onclick="app.openLeaseSignModal(${l.id})" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px] shadow-xs transition flex items-center space-x-1 inline-flex">
                   <i data-lucide="edit-3" class="w-3 h-3"></i>
                   <span>E-Sign</span>
                 </button>`
            }
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  openLeaseSignModal(id) {
    const lease = (this.state.leaseAgreements || []).find(l => l.id == id);
    if (!lease) return;

    document.getElementById('modal-lease-id').value = lease.id;
    document.getElementById('sign-lease-code').textContent = lease.agreement_code;
    document.getElementById('sign-lease-tenant').textContent = lease.tenant_name || 'Resident';
    document.getElementById('sign-lease-rent').textContent = this.formatMoney(lease.monthly_rent);
    document.getElementById('sign-lease-period').textContent = `${lease.start_date} to ${lease.end_date}`;

    this.openModal('modal-lease-sign');
    setTimeout(() => this.initLeaseSignaturePad(), 150);
  }

  viewLeaseDetails(id) {
    const lease = (this.state.leaseAgreements || []).find(l => l.id == id);
    if (!lease) return;
    alert(`Digital Agreement: ${lease.agreement_code}\nStatus: Executed\nContract Hash: ${lease.contract_hash || 'SHA256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069'}\nSigned At: ${lease.tenant_signed_at || 'Recorded'}\nTenant: ${lease.tenant_name}`);
  }

  initLeaseSignaturePad() {
    const canvas = document.getElementById('lease-signature-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#047857';

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if (e.touches && e.touches[0]) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      isDrawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
    };

    const draw = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    };

    const endDraw = () => {
      if (isDrawing) {
        isDrawing = false;
      }
    };

    canvas.onmousedown = startDraw;
    canvas.onmousemove = draw;
    window.onmouseup = endDraw;

    canvas.ontouchstart = startDraw;
    canvas.ontouchmove = draw;
    window.ontouchend = endDraw;
  }

  clearLeaseSignature() {
    const canvas = document.getElementById('lease-signature-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async submitLeaseSignature() {
    const id = document.getElementById('modal-lease-id').value;
    if (!id) return;
    const canvas = document.getElementById('lease-signature-pad');
    const signatureSvg = canvas ? canvas.toDataURL('image/png') : '<svg>e-signature</svg>';

    try {
      const res = await this.fetchAPI(`/api/leases/agreements/${id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: signatureSvg,
          signature_svg: signatureSvg,
          signer_role: 'manager',
          signer_name: this.state.authUser?.name || 'Lead Estate Manager'
        })
      });
      this.closeModal('modal-lease-sign');
      this.showToast(`Agreement Counter-Signed! Hash: ${(res.agreement?.contract_hash || res.contract_hash || 'SHA256').substring(0, 16)}...`, 'success');
      await this.refreshAllData();
      this.renderLeases();
    } catch (err) {
      this.showToast(err.message || 'Failed to sign lease agreement', 'error');
    }
  }

  // MODULE 2: MOVE-IN / MOVE-OUT INSPECTIONS & DEPOSIT SETTLEMENT
  renderInspections() {
    const tbody = document.getElementById('inspections-table-body');
    if (!tbody) return;
    const items = this.state.inspections || [];
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No property inspection audits recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(insp => {
      const isMoveOut = insp.inspection_type === 'move_out';
      const typeBadge = isMoveOut 
        ? `<span class="px-2 py-0.5 rounded font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200">Move-Out Exit</span>`
        : `<span class="px-2 py-0.5 rounded font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200">Move-In Handover</span>`;

      const isSettled = insp.status === 'settled' || insp.deposit_refund_status === 'settled';
      const statusBadge = isSettled
        ? `<span class="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Settled (Voucher Disbursed)</span>`
        : `<span class="px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300">${this.escapeHtml(insp.status || 'completed')}</span>`;

      const deductions = (Number(insp.damages_total || insp.damage_deductions) || 0) + (Number(insp.unpaid_utility_arrears || insp.unpaid_arrears_deductions) || 0);

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition">
          <td class="py-3 px-4">${typeBadge}</td>
          <td class="py-3 px-4 font-bold text-slate-800 dark:text-zinc-200">
            ${this.escapeHtml(insp.property_name || 'Kilimani Royal Heights')} - Unit ${this.escapeHtml(insp.unit_number || 'A101')}
          </td>
          <td class="py-3 px-4 text-[11px] text-slate-600 dark:text-zinc-300">
            <div class="font-semibold">${this.escapeHtml(insp.inspector_name || 'Estates Inspector')}</div>
            <div class="text-slate-400">${this.escapeHtml(insp.inspection_date)}</div>
          </td>
          <td class="py-3 px-4 font-mono font-bold text-slate-800 dark:text-zinc-200">${this.formatMoney(insp.deposit_held)}</td>
          <td class="py-3 px-4 font-mono text-rose-600 dark:text-rose-400 font-bold">- ${this.formatMoney(deductions)}</td>
          <td class="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">${this.formatMoney(insp.net_deposit_refund)}</td>
          <td class="py-3 px-4">${statusBadge}</td>
          <td class="py-3 px-4 text-right">
            ${isMoveOut && !isSettled
              ? `<button onclick="app.settleDepositRefund(${insp.id})" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] shadow-xs transition">Disburse Refund</button>`
              : `<span class="text-slate-400 text-[11px]">Audit Complete</span>`
            }
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  openNewInspectionModal() {
    const sel = document.getElementById('insp-unit-id');
    if (sel) {
      sel.innerHTML = (this.state.units || []).map(u => 
        `<option value="${u.id}">${this.escapeHtml(u.property_name || 'Property')} - Unit ${this.escapeHtml(u.unit_number)}</option>`
      ).join('');
    }
    this.updateInspectionMath();
    this.openModal('modal-new-inspection');
  }

  updateInspectionMath() {
    const item1 = document.getElementById('insp-item-1-status')?.value === 'Damaged' ? 4500 : 0;
    const item2 = document.getElementById('insp-item-2-status')?.value === 'Damaged' ? 2500 : 0;
    const item3 = document.getElementById('insp-item-3-status')?.value === 'Damaged' ? 3200 : 0;
    const item4 = document.getElementById('insp-item-4-status')?.value === 'Damaged' ? 1800 : 0;

    const c1 = document.getElementById('insp-item-1-cost');
    const c2 = document.getElementById('insp-item-2-cost');
    const c3 = document.getElementById('insp-item-3-cost');
    const c4 = document.getElementById('insp-item-4-cost');
    if (c1) c1.textContent = `KES ${item1.toLocaleString()}`;
    if (c2) c2.textContent = `KES ${item2.toLocaleString()}`;
    if (c3) c3.textContent = `KES ${item3.toLocaleString()}`;
    if (c4) c4.textContent = `KES ${item4.toLocaleString()}`;

    const totalDamages = item1 + item2 + item3 + item4;
    const depositHeld = 130000;
    const unpaidArrears = 2150;
    const netRefund = Math.max(0, depositHeld - totalDamages - unpaidArrears);

    const mathDamages = document.getElementById('insp-math-damages');
    const mathNet = document.getElementById('insp-math-net');
    if (mathDamages) mathDamages.textContent = `- KES ${totalDamages.toLocaleString()}`;
    if (mathNet) mathNet.textContent = `KES ${netRefund.toLocaleString()}`;
  }

  async submitInspectionReport(e) {
    if (e) e.preventDefault();
    const type = document.getElementById('insp-type')?.value || 'move_out';
    const unitId = document.getElementById('insp-unit-id')?.value || 1;

    const item1 = document.getElementById('insp-item-1-status')?.value === 'Damaged' ? 4500 : 0;
    const item2 = document.getElementById('insp-item-2-status')?.value === 'Damaged' ? 2500 : 0;
    const item3 = document.getElementById('insp-item-3-status')?.value === 'Damaged' ? 3200 : 0;
    const item4 = document.getElementById('insp-item-4-status')?.value === 'Damaged' ? 1800 : 0;

    const checklist = [
      { item: 'Living Room Walls & Paint', status: item1 ? 'Damaged' : 'Pristine', repair_cost: item1 },
      { item: 'Kitchen Sink & Mixer Taps', status: item2 ? 'Damaged' : 'Pristine', repair_cost: item2 },
      { item: 'Bathroom Shower & Mirror', status: item3 ? 'Damaged' : 'Pristine', repair_cost: item3 },
      { item: 'Sockets, Switches & Fixtures', status: item4 ? 'Damaged' : 'Pristine', repair_cost: item4 }
    ];

    const payload = {
      unit_id: Number(unitId),
      tenant_id: 1,
      inspection_type: type,
      inspector_name: this.state.authUser?.name || 'Lead Estate Manager',
      checklist,
      deposit_held: 130000,
      unpaid_utility_arrears: 2150
    };

    try {
      await this.fetchAPI('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      this.closeModal('modal-new-inspection');
      this.showToast('Inspection Audit Logged and Deposit Settlement Saved!', 'success');
      await this.refreshAllData();
      this.renderInspections();
    } catch (err) {
      this.showToast(err.message || 'Failed to submit inspection report', 'error');
    }
  }

  async settleDepositRefund(id) {
    if (!confirm('Authorize deposit settlement payout for this inspection?')) return;
    try {
      const res = await this.fetchAPI(`/api/inspections/${id}/settle-deposit`, {
        method: 'POST'
      });
      this.showToast(`Deposit settled! Net refund: KES ${Number(res.net_refund_amount || 0).toLocaleString()} (${res.voucher_number})`, 'success');
      await this.refreshAllData();
      this.renderInspections();
    } catch (err) {
      this.showToast(err.message || 'Failed to settle deposit', 'error');
    }
  }

  // MODULE 3: GATED ESTATE VISITOR PASSES & QR BARRIER SECURITY
  renderVisitorPasses() {
    const tbody = document.getElementById('visitor-passes-table-body');
    if (!tbody) return;
    const passes = this.state.visitorPasses || [];
    if (!passes.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">No active visitor passes found.</td></tr>`;
      return;
    }

    tbody.innerHTML = passes.map(p => {
      let statusBadge;
      if (p.gate_status === 'checked_in') {
        statusBadge = `<span class="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Inside Estate</span>`;
      } else if (p.gate_status === 'checked_out') {
        statusBadge = `<span class="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700 border border-slate-300">Exited</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 border border-blue-300">Active (Expected)</span>`;
      }

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition">
          <td class="py-3 px-4">
            <span class="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">${this.escapeHtml(p.pass_code)}</span>
          </td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-800 dark:text-zinc-200">${this.escapeHtml(p.property_name || 'Kilimani Royal Heights')}</div>
            <div class="text-[11px] text-slate-400">Unit ${this.escapeHtml(p.unit_number || 'A101')} &bull; ${this.escapeHtml(p.resident_name || 'Resident')}</div>
          </td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-800 dark:text-zinc-200">${this.escapeHtml(p.visitor_name)}</div>
            <div class="text-[11px] text-slate-400 font-mono">${this.escapeHtml(p.visitor_phone || '-')}</div>
          </td>
          <td class="py-3 px-4 font-mono font-bold text-slate-700 dark:text-zinc-300">${this.escapeHtml(p.vehicle_plate || 'Pedestrian')}</td>
          <td class="py-3 px-4 text-[11px] text-slate-600 dark:text-zinc-400">
            <div>${this.escapeHtml(p.valid_date)}</div>
            <div class="text-slate-400">${this.escapeHtml(p.valid_time_slot)}</div>
          </td>
          <td class="py-3 px-4">${statusBadge}</td>
          <td class="py-3 px-4 text-right">
            ${p.gate_status !== 'checked_out'
              ? `<button onclick="app.quickGateCheck('${p.pass_code}', '${p.gate_status === 'checked_in' ? 'check_out' : 'check_in'}')" class="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold transition">
                  ${p.gate_status === 'checked_in' ? 'Log Exit' : 'Log Entry'}
                 </button>`
              : `<span class="text-slate-400 text-[11px]">Pass Concluded</span>`
            }
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  openNewVisitorPassModal() {
    const today = new Date().toISOString().substring(0, 10);
    const dateInput = document.getElementById('pass-valid-date');
    if (dateInput) dateInput.value = today;
    this.openModal('modal-new-visitor-pass');
  }

  async submitNewVisitorPass(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('pass-visitor-name')?.value;
    const phone = document.getElementById('pass-visitor-phone')?.value;
    const plate = document.getElementById('pass-vehicle-plate')?.value;
    const validDate = document.getElementById('pass-valid-date')?.value;
    const slot = document.getElementById('pass-time-slot')?.value;

    try {
      const res = await this.fetchAPI('/api/visitor-passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: 1,
          visitor_name: name,
          visitor_phone: phone,
          vehicle_plate: plate,
          valid_date: validDate,
          valid_time_slot: slot
        })
      });
      this.closeModal('modal-new-visitor-pass');
      this.showToast(`Visitor Pass Generated! PIN: ${res.pass_code}`, 'success');
      await this.refreshAllData();
      this.renderVisitorPasses();
    } catch (err) {
      this.showToast(err.message || 'Failed to issue visitor pass', 'error');
    }
  }

  openGateSecurityScannerModal() {
    const resultDiv = document.getElementById('gate-scan-result');
    if (resultDiv) {
      resultDiv.classList.add('hidden');
      resultDiv.innerHTML = '';
    }
    const input = document.getElementById('scan-pass-code');
    if (input) input.value = '';
    this.openModal('modal-visitor-scanner');
  }

  async validateGatePass(action) {
    const code = document.getElementById('scan-pass-code')?.value.trim();
    if (!code) {
      this.showToast('Please enter a 4-digit PIN or pass code', 'error');
      return;
    }

    try {
      const res = await this.fetchAPI('/api/visitor-passes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass_code: code, action })
      });

      const resultDiv = document.getElementById('gate-scan-result');
      if (resultDiv) {
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-900 dark:text-emerald-200 space-y-1';
        resultDiv.innerHTML = `
          <div class="font-bold flex items-center space-x-1">
            <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
            <span>Barrier Authorized: ${this.escapeHtml(action === 'check_in' ? 'Check-In Granted' : 'Check-Out Cleared')}</span>
          </div>
          <div>Visitor: <strong>${this.escapeHtml(res.visitor_pass.visitor_name)}</strong></div>
          <div>Vehicle: <strong>${this.escapeHtml(res.visitor_pass.vehicle_plate || 'Pedestrian')}</strong></div>
          <div>Destination: Unit ${this.escapeHtml(res.visitor_pass.unit_number || 'A101')}</div>
        `;
        if (window.lucide) lucide.createIcons();
      }
      this.showToast(`Barrier Updated for Pass ${res.visitor_pass.pass_code}`, 'success');
      await this.refreshAllData();
      this.renderVisitorPasses();
    } catch (err) {
      const resultDiv = document.getElementById('gate-scan-result');
      if (resultDiv) {
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-xs text-rose-900 dark:text-rose-200';
        resultDiv.innerHTML = `<span class="font-bold">Access Denied:</span> ${this.escapeHtml(err.message)}`;
      }
    }
  }

  async quickGateCheck(code, action) {
    try {
      await this.fetchAPI('/api/visitor-passes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass_code: code, action })
      });
      this.showToast(`Pass ${code} logged as ${action === 'check_in' ? 'Checked-In' : 'Checked-Out'}`, 'success');
      await this.refreshAllData();
      this.renderVisitorPasses();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // MODULE 4: DIASPORA LANDLORD MULTI-CURRENCY & INVESTMENT ROI HUB
  async openDiasporaRoiModal() {
    this.openModal('modal-diaspora-roi');
    const container = document.getElementById('diaspora-roi-content');
    if (!container) return;
    container.innerHTML = `<div class="text-center py-8 text-slate-400">Loading Diaspora ROI Telemetry...</div>`;

    try {
      const data = await this.fetchAPI('/api/reports/diaspora-roi');
      const summary = data.portfolio_summary || {};
      const totalKES = Number(summary.total_annual_rent_kes || 74800000);
      const monthlyKES = Math.round(totalKES / 12);
      const totalValuationKES = Number(summary.total_valuation_kes || 880000000);

      const monthlyUSD = Math.round(monthlyKES / 129.50);
      const annualUSD = Math.round(totalKES / 129.50);
      const monthlyGBP = Math.round(monthlyKES / 168.20);
      const annualGBP = Math.round(totalKES / 168.20);
      const monthlyEUR = Math.round(monthlyKES / 141.00);
      const annualEUR = Math.round(totalKES / 141.00);

      container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border">
            <span class="text-[10px] uppercase font-bold text-slate-400">Monthly Gross</span>
            <div class="font-extrabold text-sm text-slate-900 dark:text-white mt-1">KES ${monthlyKES.toLocaleString()}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border">
            <span class="text-[10px] uppercase font-bold text-slate-400">Annual Gross</span>
            <div class="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 mt-1">KES ${totalKES.toLocaleString()}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border">
            <span class="text-[10px] uppercase font-bold text-slate-400">Portfolio Cap Rate</span>
            <div class="font-extrabold text-sm text-blue-600 dark:text-blue-400 mt-1">${summary.average_cap_rate || '7.8%'}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border">
            <span class="text-[10px] uppercase font-bold text-slate-400">Net Yield ROI</span>
            <div class="font-extrabold text-sm text-purple-600 dark:text-purple-400 mt-1">${summary.average_net_yield || '8.5%'}</div>
          </div>
        </div>

        <div class="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden mt-4">
          <div class="bg-slate-100 dark:bg-zinc-800 px-4 py-2 font-bold text-xs text-slate-700 dark:text-zinc-200">
            Multi-Currency Remittance Disbursable Values
          </div>
          <table class="w-full text-left text-xs divide-y divide-slate-100 dark:divide-zinc-800">
            <thead class="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 text-[11px]">
              <tr>
                <th class="py-2.5 px-3">Currency</th>
                <th class="py-2.5 px-3">FX Rate (KES)</th>
                <th class="py-2.5 px-3">Monthly Remittance</th>
                <th class="py-2.5 px-3 font-semibold text-right">Annualized Disbursable</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
              <tr>
                <td class="py-2.5 px-3 font-bold text-emerald-600">KES - Kenya Shilling</td>
                <td class="py-2.5 px-3 font-mono">1.00</td>
                <td class="py-2.5 px-3 font-mono font-bold">KES ${monthlyKES.toLocaleString()}</td>
                <td class="py-2.5 px-3 font-mono font-bold text-right">KES ${totalKES.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3 font-bold text-blue-600">USD - US Dollar</td>
                <td class="py-2.5 px-3 font-mono">129.50</td>
                <td class="py-2.5 px-3 font-mono font-bold">$${monthlyUSD.toLocaleString()}</td>
                <td class="py-2.5 px-3 font-mono font-bold text-right">$${annualUSD.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3 font-bold text-purple-600">GBP - British Pound</td>
                <td class="py-2.5 px-3 font-mono">168.20</td>
                <td class="py-2.5 px-3 font-mono font-bold">£${monthlyGBP.toLocaleString()}</td>
                <td class="py-2.5 px-3 font-mono font-bold text-right">£${annualGBP.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3 font-bold text-amber-600">EUR - Euro</td>
                <td class="py-2.5 px-3 font-mono">141.00</td>
                <td class="py-2.5 px-3 font-mono font-bold">€${monthlyEUR.toLocaleString()}</td>
                <td class="py-2.5 px-3 font-mono font-bold text-right">€${annualEUR.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="text-rose-500 py-4 text-center">Failed to load Diaspora ROI data: ${this.escapeHtml(err.message)}</div>`;
    }
  }

  // MODULE 5: SHARED ESTATE AMENITIES & CLUBHOUSE BOOKINGS
  renderAmenities() {
    const grid = document.getElementById('amenities-showcase-grid');
    const tbody = document.getElementById('amenity-bookings-table-body');
    const amenities = this.state.amenities || [];
    const bookings = this.state.amenityBookings || [];

    if (grid) {
      if (!amenities.length) {
        grid.innerHTML = `<div class="col-span-4 text-center py-8 text-slate-400">No amenities registered for this portfolio.</div>`;
      } else {
        grid.innerHTML = amenities.map(a => `
          <div class="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/90 dark:border-zinc-800 p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <i data-lucide="${this.escapeHtml(a.icon || 'palmtree')}" class="w-5 h-5"></i>
                </div>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                  Max ${a.capacity_persons} Pax
                </span>
              </div>
              <h3 class="font-bold text-sm text-slate-900 dark:text-white">${this.escapeHtml(a.name)}</h3>
              <p class="text-xs text-slate-500 mt-1">${this.escapeHtml(a.description || '')}</p>
            </div>
            <div class="pt-4 mt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span class="text-[10px] uppercase text-slate-400 block font-semibold">Rate</span>
                <span class="font-bold font-mono text-xs text-slate-900 dark:text-white">${this.formatMoney(a.hourly_rate)}/hr</span>
              </div>
              <button onclick="app.openNewAmenityBookingModal(${a.id})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center space-x-1">
                <i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i>
                <span>Reserve</span>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    if (tbody) {
      if (!bookings.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">No reservations scheduled.</td></tr>`;
      } else {
        tbody.innerHTML = bookings.map(b => `
          <tr class="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition">
            <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${this.escapeHtml(b.booking_ref)}</td>
            <td class="py-3 px-4 font-bold text-slate-800 dark:text-zinc-200">${this.escapeHtml(b.amenity_name || 'Amenity')}</td>
            <td class="py-3 px-4 text-slate-700 dark:text-zinc-300">${this.escapeHtml(b.resident_name || 'Resident')} (Unit ${this.escapeHtml(b.unit_number || 'A101')})</td>
            <td class="py-3 px-4 text-[11px] text-slate-600 dark:text-zinc-400">
              <div>${this.escapeHtml(b.booking_date)}</div>
              <div class="text-slate-400">${this.escapeHtml(b.start_time)} (${b.duration_hours} hrs)</div>
            </td>
            <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${this.formatMoney(b.total_fee)}</td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px]">Confirmed</span>
            </td>
          </tr>
        `).join('');
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  openNewAmenityBookingModal(amenityId) {
    const sel = document.getElementById('book-amenity-id');
    if (sel) {
      sel.innerHTML = (this.state.amenities || []).map(a => 
        `<option value="${a.id}" ${a.id == amenityId ? 'selected' : ''}>${this.escapeHtml(a.name)} (KES ${Number(a.hourly_rate).toLocaleString()}/hr)</option>`
      ).join('');
    }
    const today = new Date().toISOString().substring(0, 10);
    const dateInput = document.getElementById('book-amenity-date');
    if (dateInput) dateInput.value = today;
    this.updateAmenityFee();
    this.openModal('modal-new-amenity-booking');
  }

  updateAmenityFee() {
    const amenityId = document.getElementById('book-amenity-id')?.value;
    const hours = Number(document.getElementById('book-amenity-hours')?.value) || 2;
    const amenity = (this.state.amenities || []).find(a => a.id == amenityId) || (this.state.amenities || [])[0];
    const rate = amenity ? Number(amenity.hourly_rate) : 1500;
    const total = rate * hours;
    const feeEl = document.getElementById('book-amenity-total-fee');
    if (feeEl) feeEl.textContent = this.formatMoney(total);
  }

  async submitAmenityBooking(e) {
    if (e) e.preventDefault();
    const amenityId = document.getElementById('book-amenity-id')?.value;
    const bookingDate = document.getElementById('book-amenity-date')?.value;
    const startTime = document.getElementById('book-amenity-time')?.value;
    const durationHours = Number(document.getElementById('book-amenity-hours')?.value) || 2;

    try {
      const res = await this.fetchAPI('/api/amenity-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amenity_id: Number(amenityId),
          tenant_id: 1,
          booking_date: bookingDate,
          start_time: startTime,
          duration_hours: durationHours
        })
      });
      this.closeModal('modal-new-amenity-booking');
      this.showToast(`Amenity Reserved! Ref: ${res.booking.booking_ref}`, 'success');
      await this.refreshAllData();
      this.renderAmenities();
    } catch (err) {
      this.showToast(err.message || 'Failed to book amenity', 'error');
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colorClasses = type === 'success' 
      ? 'bg-emerald-900 text-white border-emerald-700' 
      : (type === 'error' ? 'bg-rose-900 text-white border-rose-700' : 'bg-slate-900 text-white border-slate-700');

    toast.className = `toast show p-3.5 rounded-xl border shadow-xl flex items-center space-x-2 text-xs font-medium max-w-sm ${colorClasses}`;
    toast.innerHTML = `
      <span class="w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : (type === 'error' ? 'bg-rose-400' : 'bg-blue-400')}"></span>
      <span class="flex-1">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }
}

// Global instance
let app;
function initApp() {
  if (!window.app) {
    app = new BomaSphereApp();
    window.app = app;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
