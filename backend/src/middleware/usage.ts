import { Response, NextFunction } from 'express';
import { SubscriptionRequest } from './subscription';
import { supabaseAdmin } from '../lib/supabase-admin';
import { TIERS } from '../lib/stripe';

type CounterField = 'plan';

export function checkUsage(counter: CounterField) {
  return async (req: SubscriptionRequest, res: Response, next: NextFunction) => {
    const tier = req.tier || 'free';
    const tierConfig = TIERS[tier];
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
      let periodStart: string;
      let periodLabel: string;
      if (tierConfig.period === 'day') {
        periodStart = today;
        periodLabel = 'today';
      } else if (tierConfig.period === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay()); // Sunday = start of week
        periodStart = d.toISOString().split('T')[0];
        periodLabel = 'this week';
      } else {
        periodStart = `${today.slice(0, 7)}-01`;
        periodLabel = 'this month';
      }

      if (tierConfig.period === 'day') {
        // Daily: single row lookup
        const { data } = await supabaseAdmin
          .from('usage')
          .select('plan_count')
          .eq('user_id', req.userId)
          .eq('date', today)
          .single();

        const used = (data as any)?.[dbColumn] ?? 0;

        if (used >= limit) {
          return res.status(403).json({
            error: 'limit_reached',
            message: `You've used your ${limit} free plan${limit > 1 ? 's' : ''} ${periodLabel}`,
            tier,
            limit,
            used,
          });
        }

        await supabaseAdmin
          .from('usage')
          .upsert(
            { user_id: req.userId, date: today, [dbColumn]: used + 1 },
            { onConflict: 'user_id,date' }
          );
      } else {
        // Weekly or monthly: sum rows in the period
        const { data: rows } = await supabaseAdmin
          .from('usage')
          .select('plan_count')
          .eq('user_id', req.userId)
          .gte('date', periodStart);

        const used = (rows || []).reduce((sum: number, row: any) => sum + (row[dbColumn] ?? 0), 0);

        if (used >= limit) {
          return res.status(403).json({
            error: 'limit_reached',
            message: `You've used your ${limit} free plan${limit > 1 ? 's' : ''} ${periodLabel}`,
            tier,
            limit,
            used,
          });
        }

        const { data: todayRow } = await supabaseAdmin
          .from('usage')
          .select('plan_count')
          .eq('user_id', req.userId)
          .eq('date', today)
          .single();

        const todayCount = (todayRow as any)?.[dbColumn] ?? 0;

        await supabaseAdmin
          .from('usage')
          .upsert(
            { user_id: req.userId, date: today, [dbColumn]: todayCount + 1 },
            { onConflict: 'user_id,date' }
          );
      }

      next();
    } catch (err) {
      console.error('[Usage] Error checking usage:', err);
      return res.status(503).json({
        error: 'Usage check temporarily unavailable. Please try again.',
      });
    }
  };
}
