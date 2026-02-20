import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { SavedPlan } from '../components/PlanHistory';

interface PlanRow {
  id: string;
  user_id: string;
  city: string;
  budget: string;
  content: string;
  date: string;
  timestamp: number;
  days: number | null;
  created_at: string;
}

const LOCAL_STORAGE_KEY = 'daily_plans';
const MIGRATION_KEY = 'daily_plans_migrated';
const MAX_PLANS = 50;

function getLocalPlans(): SavedPlan[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setLocalPlans(plans: SavedPlan[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(plans));
}

export function usePlans(user: User | null) {
  const [plans, setPlans] = useState<SavedPlan[]>(getLocalPlans);
  const [loading, setLoading] = useState(false);
  const migrationDone = useRef(false);

  // Load plans from Supabase when user is authenticated
  useEffect(() => {
    if (!supabase || !user) return;

    let cancelled = false;

    async function loadAndMigrate() {
      setLoading(true);

      try {
        // Step 1: Migrate localStorage plans on first login
        const migrationKey = `${MIGRATION_KEY}_${user!.id}`;
        const alreadyMigrated = localStorage.getItem(migrationKey) === 'true';
        const localPlans = getLocalPlans();

        if (!alreadyMigrated && localPlans.length > 0 && !migrationDone.current) {
          migrationDone.current = true;
          const inserts = localPlans.map(plan => ({
            id: plan.id,
            user_id: user!.id,
            city: plan.city,
            budget: plan.budget,
            content: plan.content,
            date: plan.date,
            timestamp: plan.timestamp,
            days: plan.days ?? null,
          }));
          await supabase!.from('plans').upsert(inserts, { onConflict: 'id', ignoreDuplicates: true });
          localStorage.setItem(migrationKey, 'true');
        }

        // Step 2: Fetch all plans from Supabase (source of truth)
        const { data, error } = await supabase!
          .from('plans')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(MAX_PLANS);

        if (error) {
          console.error('Failed to load plans:', error.message);
          if (!cancelled) setPlans(localPlans);
        } else if (!cancelled) {
          const remotePlans: SavedPlan[] = ((data || []) as PlanRow[]).map(row => ({
            id: row.id,
            city: row.city,
            budget: row.budget,
            content: row.content,
            date: row.date,
            timestamp: row.timestamp,
            days: row.days ?? undefined,
          }));
          setPlans(remotePlans);
          setLocalPlans(remotePlans);
        }
      } catch (err) {
        console.error('Plan load error:', err);
        if (!cancelled) setPlans(getLocalPlans());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAndMigrate();
    return () => { cancelled = true; };
  }, [user?.id]);

  const savePlan = useCallback(async (plan: SavedPlan) => {
    // Optimistic update
    setPlans(prev => {
      const updated = [plan, ...prev].slice(0, MAX_PLANS);
      setLocalPlans(updated);
      return updated;
    });

    if (supabase && user) {
      try {
        const { error } = await supabase.from('plans').insert({
          id: plan.id,
          user_id: user.id,
          city: plan.city,
          budget: plan.budget,
          content: plan.content,
          date: plan.date,
          timestamp: plan.timestamp,
          days: plan.days ?? null,
        });
        if (error) console.error('Failed to save plan:', error.message);
      } catch (err) {
        console.error('Plan save error:', err);
      }
    }
  }, [user?.id]);

  const deletePlan = useCallback(async (id: string) => {
    // Optimistic delete
    setPlans(prev => {
      const updated = prev.filter(p => p.id !== id);
      setLocalPlans(updated);
      return updated;
    });

    if (supabase && user) {
      try {
        const { error } = await supabase.from('plans').delete().eq('id', id);
        if (error) console.error('Failed to delete plan:', error.message);
      } catch (err) {
        console.error('Plan delete error:', err);
      }
    }
  }, [user?.id]);

  return { plans, loading, savePlan, deletePlan };
}
