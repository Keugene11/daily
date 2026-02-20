"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_1 = require("../lib/stripe");
const supabase_admin_1 = require("../lib/supabase-admin");
const router = (0, express_1.Router)();
/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events. Must receive raw body for signature verification.
 */
router.post('/', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !webhookSecret) {
        return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }
    let event;
    try {
        event = stripe_1.stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
    catch (err) {
        console.error('[Webhook] Signature verification failed:', err);
        return res.status(400).json({ error: 'Invalid signature' });
    }
    console.log(`[Webhook] ${event.type}`);
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const userId = session.metadata?.supabase_user_id;
                console.log(`[Webhook] checkout.session.completed — userId=${userId}, subscription=${session.subscription}, customer=${session.customer}`);
                if (!userId) {
                    console.warn('[Webhook] No supabase_user_id in session metadata, skipping');
                    break;
                }
                if (session.subscription) {
                    const sub = await stripe_1.stripe.subscriptions.retrieve(session.subscription);
                    const priceId = sub.items.data[0]?.price?.id || '';
                    const tier = (0, stripe_1.getTierForPrice)(priceId);
                    const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
                    console.log(`[Webhook] priceId=${priceId}, resolvedTier=${tier}, periodEnd=${periodEnd}`);
                    const { error: upsertError } = await supabase_admin_1.supabaseAdmin
                        .from('subscriptions')
                        .upsert({
                        user_id: userId,
                        stripe_customer_id: session.customer,
                        plan_type: tier,
                        status: 'active',
                        current_period_end: periodEnd,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id' });
                    if (upsertError) {
                        console.error(`[Webhook] Supabase upsert failed:`, upsertError);
                    }
                    else {
                        console.log(`[Webhook] User ${userId} subscribed to ${tier}`);
                    }
                }
                else if (session.mode === 'payment') {
                    // One-time payment (e.g. yearly plan as single charge)
                    console.log(`[Webhook] One-time payment for user ${userId}`);
                    // Set as pro with 1-year expiry
                    const oneYearFromNow = new Date();
                    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
                    const { error: upsertError } = await supabase_admin_1.supabaseAdmin
                        .from('subscriptions')
                        .upsert({
                        user_id: userId,
                        stripe_customer_id: session.customer,
                        plan_type: 'pro',
                        status: 'active',
                        current_period_end: oneYearFromNow.toISOString(),
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id' });
                    if (upsertError) {
                        console.error(`[Webhook] Supabase upsert failed:`, upsertError);
                    }
                    else {
                        console.log(`[Webhook] User ${userId} activated pro (one-time payment, expires ${oneYearFromNow.toISOString()})`);
                    }
                }
                else {
                    console.warn('[Webhook] Unhandled session mode:', session.mode);
                }
                break;
            }
            case 'customer.subscription.updated': {
                const sub = event.data.object;
                const customerId = sub.customer;
                const priceId = sub.items.data[0]?.price?.id || '';
                const tier = (0, stripe_1.getTierForPrice)(priceId);
                const status = sub.cancel_at_period_end ? 'canceled' : sub.status === 'active' ? 'active' : 'past_due';
                await supabase_admin_1.supabaseAdmin
                    .from('subscriptions')
                    .update({
                    plan_type: tier,
                    status,
                    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                })
                    .eq('stripe_customer_id', customerId);
                console.log(`[Webhook] Subscription updated: ${customerId} → ${tier} (${status})`);
                break;
            }
            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const customerId = sub.customer;
                await supabase_admin_1.supabaseAdmin
                    .from('subscriptions')
                    .update({
                    plan_type: 'free',
                    status: 'active',
                    current_period_end: null,
                    updated_at: new Date().toISOString(),
                })
                    .eq('stripe_customer_id', customerId);
                console.log(`[Webhook] Subscription canceled: ${customerId} → free`);
                break;
            }
        }
    }
    catch (err) {
        console.error('[Webhook] Error processing event:', err);
    }
    res.json({ received: true });
});
exports.default = router;
