"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSubscription = checkSubscription;
const supabase_admin_1 = require("../lib/supabase-admin");
const stripe_1 = require("../lib/stripe");
async function checkSubscription(req, _res, next) {
    if (!req.userId) {
        req.tier = 'free';
        req.features = stripe_1.TIERS.free.features;
        return next();
    }
    try {
        const { data, error: dbError } = await supabase_admin_1.supabaseAdmin
            .from('subscriptions')
            .select('plan_type, status, current_period_end, stripe_customer_id')
            .eq('user_id', req.userId)
            .single();
        console.log(`[Sub] userId=${req.userId}, dbRow=${JSON.stringify(data)}, dbError=${dbError?.message || 'none'}`);
        let tier = 'free';
        if (data && data.status === 'active') {
            const planType = data.plan_type;
            if (planType === 'pro' && data.current_period_end && new Date(data.current_period_end) > new Date()) {
                tier = 'pro';
                console.log(`[Sub] DB says pro, periodEnd=${data.current_period_end}`);
            }
            else {
                console.log(`[Sub] DB has plan_type=${data.plan_type}, status=${data.status}, periodEnd=${data.current_period_end}`);
            }
        }
        // Fallback: if DB says free but user has a Stripe customer, check Stripe directly
        if (tier === 'free' && data?.stripe_customer_id) {
            console.log(`[Sub] Tier is free but has customer ${data.stripe_customer_id}, checking Stripe...`);
            try {
                const subs = await stripe_1.stripe.subscriptions.list({
                    customer: data.stripe_customer_id,
                    status: 'active',
                    limit: 1,
                });
                console.log(`[Sub] Stripe returned ${subs.data.length} active subscriptions`);
                if (subs.data.length > 0) {
                    const activeSub = subs.data[0];
                    const priceId = activeSub.items.data[0]?.price?.id || '';
                    const syncedTier = (0, stripe_1.getTierForPrice)(priceId);
                    const periodEnd = new Date(activeSub.current_period_end * 1000).toISOString();
                    console.log(`[Sub] Stripe sync: priceId=${priceId}, tier=${syncedTier}, periodEnd=${periodEnd}`);
                    await supabase_admin_1.supabaseAdmin
                        .from('subscriptions')
                        .update({
                        plan_type: syncedTier,
                        status: 'active',
                        current_period_end: periodEnd,
                        updated_at: new Date().toISOString(),
                    })
                        .eq('user_id', req.userId);
                    tier = syncedTier;
                }
                else {
                    console.log(`[Sub] No active Stripe subscriptions found`);
                }
            }
            catch (syncErr) {
                console.warn('[Sub] Stripe sync failed:', syncErr?.message || syncErr);
            }
        }
        console.log(`[Sub] Final tier=${tier}`);
        req.tier = tier;
        req.features = stripe_1.TIERS[tier].features;
    }
    catch (err) {
        console.error('[Sub] Middleware error:', err?.message || err);
        req.tier = 'free';
        req.features = stripe_1.TIERS.free.features;
    }
    next();
}
