// Admin Configuration UI - Dynamic feature management
// Saara configuration database se aati hai - koi hardcoded value nahi

// Admin configuration state
const adminConfig = {
  // Load from backend API
  async loadConfig() {
    try {
      const response = await fetch('/api/v1/admin/config', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        this.features = data.data.features;
        this.pricingPlans = data.data.pricingPlans;
        this.limits = data.data.limits;
        this.userRole = data.data.userRole;
        this.subscriptionPlan = data.data.subscriptionPlan;
      }
    } catch (error) {
      console.error('Failed to load admin config:', error);
    }
  },

  // Feature state
  features: {},
  pricingPlans: {},
  limits: {},
  userRole: null,
  subscriptionPlan: 'free',

  // Check if feature is accessible
  isFeatureEnabled(featureName) {
    const feature = this.features[featureName];
    if (!feature) return false;
    
    // Admins/super_admins get all enabled features
    if (this.userRole === 'admin' || this.userRole === 'super_admin') {
      return feature.enabled;
    }
    
    // Candidates check their plan
    return false; // Would check subscription
  },

  // Get feature pricing for UI
  getFeaturePricing(featureName) {
    const feature = this.features[featureName];
    if (!feature) return null;
    
    return {
      monthly: feature.price.monthly,
      weekly: feature.price.weekly,
      isFree: feature.price.monthly === 0,
      description: feature.description,
      enabled: feature.enabled,
    };
  },

  // Get all features with pricing for dashboard
  getAllFeaturesForDashboard() {
    const features = [];
    
    for (const [key, feature] of Object.entries(this.features)) {
      features.push({
        name: key,
        enabled: feature.enabled,
        price: {
          monthly: feature.price.monthly,
          weekly: feature.price.weekly,
        },
        description: feature.description,
        isFree: feature.price.monthly === 0,
      });
    }
    
    // Add pricing plans
    for (const [planName, plan] of Object.entries(this.pricingPlans)) {
      features.push({
        name: `plan_${planName}`,
        isPlan: true,
        price: plan.price,
        description: plan.description,
        features: plan.features || [],
      });
    }
    
    return features;
  },

  // Toggle feature enabled/disabled
  async toggleFeature(featureName, enabled) {
    try {
      const response = await fetch('/api/v1/admin/config/features', {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ featureName, enabled })
      });
      const data = await response.json();
      if (data.success) {
        // Reload config
        await this.loadConfig();
        return { success: true };
      }
      return { error: data.error || 'Failed to toggle feature' };
    } catch (error) {
      return { error: error.message };
    }
  },

  // Update pricing plan
  async updatePricingPlan(planName) {
    try {
      const response = await fetch('/api/v1/admin/config/plan', {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ planName })
      });
      const data = await response.json();
      if (data.success) {
        await this.loadConfig();
        return { success: true };
      }
      return { error: data.error || 'Failed to update plan' };
    } catch (error) {
      return { error: error.message };
    }
  },
};

// Initialize on load
adminConfig.loadConfig();

export default adminConfig;