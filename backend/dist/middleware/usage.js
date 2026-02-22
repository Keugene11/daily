"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUsage = checkUsage;
const supabase_admin_1 = require("../lib/supabase-admin");
const stripe_1 = require("../lib/stripe");
function checkUsage(counter) {
    return async (req, res, next) => {
        const tier = req.tier || 'free';
        const tierConfig = stripe_1.TIERS[tier];
        const limit = tierConfig.planLimit;
        // Unlimited — skip check
        if (limit === Infinity) {
            return next();
        }
        if (!req.userId) {
            return res.status(403).json({
                error: 'limit_reached',
                message: 'Sign in to use this feature',
                tier,
                limit,
                used: 0,
            });
        }
        const dbColumn = 'plan_count';
        try {
            const today = new Date().toISOString().split('T')[0];
            // Determine the start date for the usage period
            let periodStart;
            let periodLabel;
            if (tierConfig.period === 'day') {
                periodStart = today;
                periodLabel = 'today';
            }
            else if (tierConfig.period === 'week') {
                const d = new Date();
                d.setDate(d.getDate() - d.getDay()); // Sunday = start of week
                periodStart = d.toISOString().split('T')[0];
                periodLabel = 'this week';
            }
            else {
                periodStart = `${today.slice(0, 7)}-01`;
                periodLabel = 'this month';
            }
            if (tierConfig.period === 'day') {
                // Daily: single row lookup
                const { data } = await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .select('plan_count')
                    .eq('user_id', req.userId)
                    .eq('date', today)
                    .single();
                const used = data?.[dbColumn] ?? 0;
                if (used >= limit) {
                    return res.status(403).json({
                        error: 'limit_reached',
                        message: `You've used your ${limit} free plan${limit > 1 ? 's' : ''} ${periodLabel}`,
                        tier,
                        limit,
                        used,
                    });
                }
                await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .upsert({ user_id: req.userId, date: today, [dbColumn]: used + 1 }, { onConflict: 'user_id,date' });
            }
            else {
                // Weekly or monthly: sum rows in the period
                const { data: rows } = await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .select('plan_count')
                    .eq('user_id', req.userId)
                    .gte('date', periodStart);
                const used = (rows || []).reduce((sum, row) => sum + (row[dbColumn] ?? 0), 0);
                if (used >= limit) {
                    return res.status(403).json({
                        error: 'limit_reached',
                        message: `You've used your ${limit} free plan${limit > 1 ? 's' : ''} ${periodLabel}`,
                        tier,
                        limit,
                        used,
                    });
                }
                const { data: todayRow } = await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .select('plan_count')
                    .eq('user_id', req.userId)
                    .eq('date', today)
                    .single();
                const todayCount = todayRow?.[dbColumn] ?? 0;
                await supabase_admin_1.supabaseAdmin
                    .from('usage')
                    .upsert({ user_id: req.userId, date: today, [dbColumn]: todayCount + 1 }, { onConflict: 'user_id,date' });
            }
            next();
        }
        catch (err) {
            console.error('[Usage] Error checking usage:', err);
            return res.status(503).json({
                error: 'Usage check temporarily unavailable. Please try again.',
            });
        }
    };
}
