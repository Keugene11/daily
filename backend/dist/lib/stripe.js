"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIERS = exports.stripe = void 0;
exports.getTierForPrice = getTierForPrice;
const stripe_1 = __importDefault(require("stripe"));
exports.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '');
exports.TIERS = {
    free: {
        planLimit: 3,
        period: 'month',
        features: new Set(['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy']),
    },
    pro: {
        planLimit: Infinity,
        period: 'month',
        features: new Set(['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy']),
    },
};
// Map Stripe Price IDs to tier names — both monthly and yearly map to 'pro'
function getTierForPrice(priceId) {
    const monthlyId = process.env.STRIPE_MONTHLY_PRICE_ID;
    const yearlyId = process.env.STRIPE_YEARLY_PRICE_ID;
    if (monthlyId && priceId === monthlyId)
        return 'pro';
    if (yearlyId && priceId === yearlyId)
        return 'pro';
    // Unknown price ID — log a warning but do NOT default to pro.
    // Only explicitly configured price IDs should grant pro access.
    if (priceId) {
        console.warn(`[Stripe] Unknown price ID "${priceId}" — returning free. Check STRIPE_MONTHLY_PRICE_ID / STRIPE_YEARLY_PRICE_ID env vars.`);
    }
    return 'free';
}
