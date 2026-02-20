import { Response, NextFunction } from 'express';
import { SubscriptionRequest } from './subscription';
import { supabaseAdmin } from '../lib/supabase-admin';
import { TIERS } from '../lib/stripe';

type CounterField = 'plan' | 'explore';

export function checkUsage(counter: CounterField) {
  return async (req: SubscriptionRequest, res: Response, next: NextFunction) => {
    const tier = req.tier || 'free';
    const tierConfig = TIERS[tier];
    const limit = counter === 'plan' ? tierConfig.planLimit : tierConfig.exploreLimit;

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

    const dbColumn = counter === 'plan' ? 'plan_count' : 'explore_count';

    try {
      const today = new Date().toISOString().split('T')[0];

      if (tierConfig.period === 'day') {
        const { data } = await supabaseAdmin
          .from('usage')
          .select('plan_count, explore_count')
          .eq('user_id', req.userId)
          .eq('date', today)
          .single();

        const used = (data as any)?.[dbColumn] ?? 0;

        if (used >= limit) {
          return res.status(403).json({
            error: 'limit_reached',
            message: `You've used your ${limit} free ${counter === 'plan' ? 'plan' : 'search'}${limit > 1 ? 's' : ''} today`,
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
        const monthStart = `${today.slice(0, 7)}-01`;
        const { data: rows } = await supabaseAdmin
          .from('usage')
          .select('plan_count, explore_count')
          .eq('user_id', req.userId)
          .gte('date', monthStart);

        const used = (rows || []).reduce((sum: number, row: any) => sum + (row[dbColumn] ?? 0), 0);

        if (used >= limit) {
          return res.status(403).json({
            error: 'limit_reached',
            message: `You've used your ${limit} ${counter === 'plan' ? 'plan' : 'search'}${limit > 1 ? 's' : ''} this month`,
            tier,
            limit,
            used,
          });
        }

        const { data: todayRow } = await supabaseAdmin
          .from('usage')
          .select('plan_count, explore_count')
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
      next();
    }
  };
}
