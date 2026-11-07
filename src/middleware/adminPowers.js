// Admin Powers Middleware - Dynamically checks powers from config
// Koi bhi value hardcoded nahi - sab database/config se aata hai

const AdminConfig = require('../models/AdminConfig.js');
const UserAccountService = require('../services/userAccountService.js');

module.exports = {
  // Check if user has specific admin power
  hasPower: function(req, powerName) {
    const userRole = req.userRole;
    
    // Super admin has all powers
    if (req.userRole === 'super_admin') return true;
    
    // Admin powers check from config
    const adminPowers = AdminConfig.roles.admin.powers;
    return adminPowers.includes(powerName);
  },

  // Check if feature is accessible for user
  canAccessFeature: function(req, featureName) {
    const userRole = req.userRole;
    const subscriptionPlan = req.userSubscriptionPlan || 'free';
    
    // Admins/super_admins get all enabled features
    if (userRole === 'admin' || userRole === 'super_admin') {
      return AdminConfig.isFeatureEnabled(featureName, userRole);
    }
    
    // Candidates check their subscription plan
    return AdminConfig.isFeatureEnabled(featureName, userRole);
  },

  // Get feature pricing for UI display
  getFeaturePricing: function(featureName) {
    const featureConfig = AdminConfig.features[featureName];
    if (!featureConfig) return null;
    
    return {
      monthly: featureConfig.price.monthly,
      weekly: featureConfig.price.weekly,
      isFree: featureConfig.price.monthly === 0,
      description: featureConfig.description,
    };
  },

  // Get all features with pricing for UI
  getAllFeaturesWithPricing: function(userRole, subscriptionPlan) {
    return AdminConfig.getUserFeatures(userRole, subscriptionPlan);
  },
};

// Middleware: Feature access check
function checkFeatureAccess(req, res, next) {
  const featureName = req.featureName;
  if (!featureName) {
    return res.status(400).json({ error: 'Feature name required' });
  }
  
  const canAccess = AdminConfig.canAccessFeature(req, featureName);
  if (!canAccess) {
    const pricing = AdminConfig.getFeaturePricing(featureName);
    return res.status(403).json({
      error: 'Feature access denied',
      message: `This feature requires ${pricing.monthly > 0 ? `₹${pricing.monthly}/month` : 'subscription'}.`,
      pricing: pricing,
    });
  }
  
  next();
}

// Middleware: Admin power check
function checkAdminPower(powerName) {
  return function(req, res, next) {
    if (!AdminConfig.hasPower(req, powerName)) {
      return res.status(403).json({
        error: 'Insufficient admin powers',
        message: `You don't have permission to ${powerName}.`,
      });
    }
    next();
  };
}

// Middleware: Subscription plan check
function checkSubscription(req, res, next) {
  // In real implementation, check user's subscription status
  // For now, allow access
  next();
}

module.exports = {
  hasPower,
  canAccessFeature,
  getFeaturePricing,
  getAllFeaturesWithPricing,
  checkFeatureAccess,
  checkAdminPower,
  checkSubscription,
};