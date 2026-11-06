import { getDatabase } from '../../config/mongodb.js';
import type { PlanConfig, SubscriptionTier, MeteredService } from './types.js';

export const DEFAULT_PLANS: Record<SubscriptionTier, PlanConfig> = {
  free: {
    tier: 'free',
    name: 'Free Starter',
    description: 'Essential automated job application capabilities for active job seekers.',
    price: {
      amount: 0,
      currency: 'INR',
      interval: 'month',
    },
    features: [
      '5 AI-tailored resumes per month',
      '5 customized cover letters per month',
      '20 screening question answers',
      '50 automated job matches per month',
      '1 Progeni Atlas technical mock interview',
      'Chrome extension autofill support',
      'Standard community support',
    ],
    quotas: {
      resumeGenerations: 5,
      coverLetters: 5,
      screeningAnswers: 20,
      jobMatches: 50,
      interviewSimulations: 1,
      totalAiCredits: 50,
    },
  },
  pro: {
    tier: 'pro',
    name: 'Pro Career Accelerator',
    description: 'Advanced AI automation and higher limits for dedicated career switchers.',
    popular: true,
    price: {
      amount: 999, // ₹999 / month (~$12)
      currency: 'INR',
      interval: 'month',
    },
    features: [
      '50 AI-tailored resumes per month',
      '50 customized cover letters per month',
      '200 screening question answers',
      '500 automated job matches per month',
      '10 Progeni Atlas technical simulations',
      'Automated follow-up reminders',
      'ATS compatibility diagnostics',
      'Priority email support',
    ],
    quotas: {
      resumeGenerations: 50,
      coverLetters: 50,
      screeningAnswers: 200,
      jobMatches: 500,
      interviewSimulations: 10,
      totalAiCredits: 500,
    },
  },
  premium: {
    tier: 'premium',
    name: 'Premium Elite Suite',
    description: 'Maximum AI horsepower, unlimited matching, and deep technical simulation prep.',
    price: {
      amount: 2499, // ₹2,499 / month (~$29)
      currency: 'INR',
      interval: 'month',
    },
    features: [
      'Unlimited / 500 AI-tailored resumes per month',
      'Unlimited / 500 cover letters per month',
      '1,000 screening question answers',
      'Unlimited automated job discovery & matching',
      '50 Progeni Atlas technical simulations with live code runner',
      'Exclusive high-velocity application dispatcher',
      'Dedicated recruiter dossier exports',
      '1-on-1 priority support & Slack access',
    ],
    quotas: {
      resumeGenerations: 500,
      coverLetters: 500,
      screeningAnswers: 1000,
      jobMatches: 5000,
      interviewSimulations: 50,
      totalAiCredits: 2500,
    },
  },
};

export const SERVICE_CREDIT_COSTS: Record<MeteredService, number> = {
  resume_generation: 5,
  cover_letter: 3,
  screening_answer: 1,
  job_match: 1,
  interview_simulation: 10,
  custom_ai: 2,
};

export class PlanConfigService {
  /**
   * Fetches active configurable plans, supporting dynamic admin database overrides.
   * Ensures prices and quotas are not hardcoded.
   */
  static async getPlans(): Promise<Record<SubscriptionTier, PlanConfig>> {
    try {
      const db = await getDatabase();
      const settings = await db.collection<any>('billing_plan_settings').findOne({ active: true });
      if (settings?.plans) {
        return {
          free: { ...DEFAULT_PLANS.free, ...settings.plans.free },
          pro: { ...DEFAULT_PLANS.pro, ...settings.plans.pro },
          premium: { ...DEFAULT_PLANS.premium, ...settings.plans.premium },
        };
      }
    } catch {
      // Return defaults on test/in-memory or disconnected states
    }

    // Dynamic environment variable overrides
    const proPriceEnv = process.env.PLAN_PRO_PRICE_INR;
    const premiumPriceEnv = process.env.PLAN_PREMIUM_PRICE_INR;

    const plans = JSON.parse(JSON.stringify(DEFAULT_PLANS)) as Record<SubscriptionTier, PlanConfig>;
    if (proPriceEnv && !isNaN(Number(proPriceEnv))) {
      plans.pro.price.amount = Number(proPriceEnv);
    }
    if (premiumPriceEnv && !isNaN(Number(premiumPriceEnv))) {
      plans.premium.price.amount = Number(premiumPriceEnv);
    }

    return plans;
  }

  static async getPlan(tier: SubscriptionTier): Promise<PlanConfig> {
    const plans = await this.getPlans();
    return plans[tier] || plans.free;
  }

  static getCreditCost(service: MeteredService): number {
    return SERVICE_CREDIT_COSTS[service] ?? 1;
  }
}

