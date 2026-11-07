// Admin Configuration Model - Dynamically configurable
// Koi bhi value hardcoded nahi - saara data database store hoga

const AdminConfig = {
  // Admin role definitions with configurable powers
  roles: {
    admin: {
      name: 'Admin',
      powers: [], // Will be dynamically assigned from config
      limitations: {
        maxUsersPerAction: 100,
        sessionTimeout: 24, // hours
      },
    },
    super_admin: {
      name: 'Super Admin',
      powers: [], // All powers
      limitations: {
        maxUsersPerAction: 1000,
        sessionTimeout: 48, // hours
      },
    },
  },

  // Feature configuration - dynamically changeable
  features: {
    // Feature flags - on/off with pricing
    features: {
      'smart-auto-apply': {
        enabled: true,
        price: {
          monthly: 0,  // Free for now, configurable
          weekly: 0,   // Free for now, configurable
        },
        description: 'Smart Auto-Apply (4-5 seconds)',
      },
      'cover-letter-generation': {
        enabled: true,
        price: {
          monthly: 100, // ₹100/month
          weekly: 30,   // ₹30/week
        },
        description: 'AI Cover Letter Generation',
      },
      'match-score-analysis': {
        enabled: true,
        price: {
          monthly: 0,
          weekly: 0,
        },
        description: 'AI Match Score (0-100%)',
      },
      'profile-completeness': {
        enabled: true,
        price: {
          monthly: 0,
          weekly: 0,
        },
        description: 'Profile Completeness Score',
      },
      'smart-filtering': {
        enabled: true,
        price: {
          monthly: 0,
          weekly: 0,
        },
        description: 'Smart Job Filtering (70%+ threshold)',
      },
      'application-tracker': {
        enabled: true,
        price: {
          monthly: 0,
          weekly: 0,
        },
        description: 'Application Tracker',
      },
      'follow-up-reminders': {
        enabled: true,
        price: {
          monthly: 0,
          weekly: 0,
        },
        description: 'Follow-up Reminders',
      },
      'interview-prep': {
        enabled: true,
        price: {
          monthly: 0,
          weekly: 0,
        },
        description: 'Interview Preparation Questions',
      },
    },

    // Pricing plans configuration
    pricingPlans: {
      free: {
        name: 'Free',
        price: 0,
        features: [], // Empty = get all free features
        description: 'Free tier - basic features',
      },
      starter: {
        name: 'Starter',
        price: 300, // ₹300/month
        features: ['cover-letter-generation', 'interview-prep'],
        description: 'Starter tier - enhanced features',
      },
      professional: {
        name: 'Professional',
        price: 500, // ₹500/month
        features: ['cover-letter-generation', 'match-score-analysis', 'profile-completeness'],
        description: 'Professional tier - full feature set',
      },
      enterprise: {
        name: 'Enterprise',
        price: 1000, // ₹1000/month
        features: ['all features'],
        description: 'Enterprise tier - complete feature set',
      },
    },

    // Configurable limits
    limits: {
      maxApplicationsPerMonth: 500,
      maxJobsToTrack: 100,
      maxActiveSessions: 5,
      maxApiCallsPerHour: 1000,
    },

    // Get config by feature name
    getFeatureConfig: function(featureName) {
      return this.features[featureName] || null;
    },

    // Get pricing plan
    getPricingPlan: function(planName) {
      return this.pricingPlans[planName] || this.pricingPlans.free;
    },

    // Check if feature is enabled for a user role
    isFeatureEnabled: function(featureName, userRole) {
      const feature = this.features[featureName];
      if (!feature) return false;
      // Admins and super_admins get all enabled features
      if (userRole === 'admin' || userRole === 'super_admin') {
        return feature.enabled;
      }
      // Candidates check pricing
      return false; // Would need billing check in real implementation
    },

    // Get user's accessible features with pricing
    getUserFeatures: function(userRole, subscriptionPlan = 'free') {
      const plan = this.pricingPlans[subscriptionPlan] || this.pricingPlans.free;
      const accessibleFeatures = {};

      // Admins/super_admins get all enabled features
      if (userRole === 'admin' || userRole === 'super_admin') {
        for (const [featureName, feature] of Object.entries(this.features)) {
          if (feature.enabled) {
            accessibleFeatures[featureName] = {
              enabled: true,
              price: feature.price,
              description: feature.description,
              isFree: feature.price.monthly === 0,
            };
          }
        }
      } else {
        // Candidates - check plan features
        for (const [featureName, feature] of Object.entries(this.features)) {
          // Feature is accessible if:
          // 1. It's enabled, AND
          // 2. It's included in user's plan (or free)
          if (feature.enabled && plan.features.includes(featureName)) {
            accessibleFeatures[featureName] = {
              enabled: true,
              price: feature.price,
              description: feature.description,
              isFree: feature.price.monthly === 0,
            };
          }
        }
      }

      return accessibleFeatures;
    },
  },
};

module.exports = AdminConfig;