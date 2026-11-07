// Admin Dashboard - Configurable powers and pricing
// Poora UI database se aata hai - hardcoded value nahi

class AdminDashboard {
  constructor() {
    this.state = {
      isLoading: true,
      features: [],
      selectedPlan: 'free',
      userRole: null,
    };
    this.init();
  }

  async init() {
    await adminConfig.loadConfig();
    this.render();
    this.bindEvents();
  }

  render() {
    const { state } = this;
    const body = document.body;
    
    if (state.isLoading) {
      body.innerHTML = `<div class="loading">Loading admin configuration...</div>`;
      return;
    }

    // Build UI based on dynamic config
    const features = adminConfig.getAllFeaturesForDashboard();
    
    let html = `
      <div class="admin-dashboard">
        <header class="admin-header">
          <h1>Admin Panel</h1>
          <div class="user-info">
            <span>Role: ${state.userRole || 'User'}</span>
            <span>Plan: ${state.subscriptionPlan || 'Free'}</span>
          </div>
          <button class="btn-logout">Logout</button>
        </header>
        
        <div class="admin-container">
          <aside class="admin-sidebar">
            <h3>Feature Control</h3>
            <ul class="feature-list">
    `;

    // Render features dynamically
    features.forEach((feature, index) => {
      const isFeature = !feature.isPlan;
      const isFree = feature.isFree || isPlan;
      
      html += `
        <li class="feature-item ${isFeature ? 'enabled' : 'disabled'}" data-feature="${feature.name}">
          <div class="feature-info">
            <span class="feature-name">${feature.name}</span>
            <span class="feature-description">${feature.description}</span>
          </div>
          <div class="feature-control">
            ${isFeature ? `
              <span class="feature-status enabled">Enabled</span>
            ` : `
              <span class="feature-status disabled">Disabled</span>
              ${!isFree ? `<span class="feature-price">₹${feature.price.monthly}/month</span>` : ''}
            `}
          </div>
        </li>
      `;
    });

    html += `
            </ul>
          </aside>
          
          <main class="admin-main">
            <div class="plan-selector">
              <h3>Select Subscription Plan</h3>
              <div class="plan-options">
                ${Object.keys(adminConfig.pricingPlans).map(planName => `
                  <div class="plan-option ${state.selectedPlan === planName ? 'selected' : ''}" 
                       data-plan="${planName}">
                    <span>${adminConfig.pricingPlans[planName].name}</span>
                    <span>₹${adminConfig.pricingPlans[planName].price}/month</span>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div class="admin-summary">
              <h3>Summary</h3>
              <p>Total Features: ${features.length}</p>
              <p>Enabled: ${features.filter(f => f.enabled).length}</p>
              <p>Monthly Cost: ₹${adminConfig.getPlanMonthlyCost(state.selectedPlan)}</p>
            </div>
          </main>
        </div>
      </div>
    `;

    body.innerHTML = html;
    this.bindFeatureEvents();
  }

  getPlanMonthlyCost(planName) {
    const plan = adminConfig.pricingPlans[planName];
    return plan ? plan.price : 0;
  }

  bindEvents() {
    // Plan selection
    document.querySelectorAll('.plan-option').forEach(option => {
      option.addEventListener('click', () => {
        const planName = option.getAttribute('data-plan');
        this.selectPlan(planName);
      });
    });

    // Feature toggles
    document.querySelectorAll('.feature-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const featureName = item.getAttribute('data-feature');
        this.toggleFeature(featureName);
      });
    });
  }

  selectPlan(planName) {
    this.state.selectedPlan = planName;
    this.render();
  }

  toggleFeature(featureName) {
    adminConfig.toggleFeature(featureName, !adminConfig.isFeatureEnabled(featureName))
      .then(result => {
        if (result.success) {
          // Reload to show updated state
          adminConfig.loadConfig();
          this.render();
        }
      })
      .catch(err => console.error('Failed to toggle feature:', err));
  }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  window.adminDashboard = new AdminDashboard();
});