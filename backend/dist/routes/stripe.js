"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_1 = require("../lib/stripe");
const supabase_admin_1 = require("../lib/supabase-admin");
const router = (0, express_1.Router)();
/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session and returns the URL
 */
router.post('/checkout', async (req, res) => {
    const { priceId } = req.body;
    console.log(`[Checkout] Start — priceId="${priceId}", userId=${req.userId}`);
    if (!priceId) {
        return res.status(400).json({ error: 'Missing priceId' });
    }
    if (!req.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        // Find or create Stripe customer
        let customerId;
        const { data: sub } = await supabase_admin_1.supabaseAdmin
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', req.userId)
            .single();
        if (sub?.stripe_customer_id) {
            customerId = sub.stripe_customer_id;
            console.log(`[Checkout] Existing customer: ${customerId}`);
        }
        else {
            const customer = await stripe_1.stripe.customers.create({
                ...(req.userEmail ? { email: req.userEmail } : {}),
                metadata: { supabase_user_id: req.userId },
            });
            customerId = customer.id;
            console.log(`[Checkout] Created customer: ${customerId}`);
            await supabase_admin_1.supabaseAdmin
                .from('subscriptions')
                .upsert({
                user_id: req.userId,
                stripe_customer_id: customerId,
                plan_type: 'free',
                status: 'active',
            }, { onConflict: 'user_id' });
        }
        // Fetch the price to determine if it's recurring or one-time
        const price = await stripe_1.stripe.prices.retrieve(priceId);
        const mode = price.type === 'recurring' ? 'subscription' : 'payment';
        console.log(`[Checkout] Price type="${price.type}", mode="${mode}"`);
        const session = await stripe_1.stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            mode,
            success_url: `${req.headers.origin || 'https://daily-three-xi.vercel.app'}?success=1`,
            cancel_url: `${req.headers.origin || 'https://daily-three-xi.vercel.app'}?canceled=1`,
            metadata: { supabase_user_id: req.userId },
        });
        console.log(`[Checkout] Session created: ${session.id}`);
        res.json({ url: session.url });
    }
    catch (err) {
        const msg = err?.message || 'Unknown error';
        const code = err?.code || err?.type || '';
        console.error(`[Checkout] FAILED — ${code}: ${msg}`, err);
        res.status(500).json({ error: `${msg}${code ? ` (${code})` : ''}` });
    }
});
/**
 * POST /api/portal
 * Creates a Stripe Customer Portal session
 */
router.post('/portal', async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const { data: sub } = await supabase_admin_1.supabaseAdmin
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', req.userId)
            .single();
        if (!sub?.stripe_customer_id) {
            return res.status(400).json({ error: 'No subscription found' });
        }
        const session = await stripe_1.stripe.billingPortal.sessions.create({
            customer: sub.stripe_customer_id,
            return_url: req.headers.origin || 'https://daily-three-xi.vercel.app',
        });
        res.json({ url: session.url });
    }
    catch (err) {
        console.error('[Stripe] Portal error:', err);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});
/**
 * GET /api/subscription
 * Returns current user's tier, usage, limits, and features
 */
router.get('/subscription', async (req, res) => {
    const tier = req.tier || 'free';
    const tierConfig = stripe_1.TIERS[tier];
    let usage = { plan_count: 0, explore_count: 0 };
    if (req.userId) {
        const today = new Date().toISOString().split('T')[0];
        if (tierConfig.period === 'day') {
            const { data } = await supabase_admin_1.supabaseAdmin
                .from('usage')
                .select('plan_count, explore_count')
                .eq('user_id', req.userId)
                .eq('date', today)
                .single();
            if (data)
                usage = data;
        }
        else {
            const monthStart = `${today.slice(0, 7)}-01`;
            const { data: rows } = await supabase_admin_1.supabaseAdmin
                .from('usage')
                .select('plan_count, explore_count')
                .eq('user_id', req.userId)
                .gte('date', monthStart);
            if (rows) {
                usage = {
                    plan_count: rows.reduce((s, r) => s + (r.plan_count ?? 0), 0),
                    explore_count: rows.reduce((s, r) => s + (r.explore_count ?? 0), 0),
                };
            }
        }
    }
    res.json({
        tier,
        period: tierConfig.period,
        limits: {
            plans: tierConfig.planLimit === Infinity ? -1 : tierConfig.planLimit,
            explores: tierConfig.exploreLimit === Infinity ? -1 : tierConfig.exploreLimit,
        },
        usage: {
            plans: usage.plan_count,
            explores: usage.explore_count,
        },
        features: Array.from(tierConfig.features),
    });
});
exports.default = router;
