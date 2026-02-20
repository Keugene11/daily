import React from 'react';
import { User } from '@supabase/supabase-js';
import type { TierName } from '../hooks/useSubscription';

interface Props {
  user: User | null;
  planCount: number;
  tier: TierName;
  onClose: () => void;
  onSignOut: () => void;
  onManage: () => void;
  onUpgrade: () => void;
}

export const ProfilePage: React.FC<Props> = ({ user, planCount, tier, onClose, onSignOut, onManage, onUpgrade }) => {
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  const email = user?.email || 'Guest';
  const avatar = user?.user_metadata?.avatar_url || null;
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-2xl font-semibold">Profile</h2>
        <button onClick={onClose} className="text-sm text-on-surface/50 hover:text-on-surface transition-colors">Back</button>
      </div>

      <div className="flex flex-col items-center text-center mb-10">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="w-20 h-20 rounded-full mb-4"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-on-surface/10 flex items-center justify-center mb-4">
            <span className="text-2xl text-on-surface/40">
              {(name || email)[0]?.toUpperCase()}
            </span>
          </div>
        )}
        {name && <h3 className="text-lg font-medium mb-1">{name}</h3>}
        <p className="text-sm text-on-surface/50">{email}</p>
      </div>

      <div className="space-y-4 mb-10">
        <div className="flex items-center justify-between py-3 border-b border-on-surface/10">
          <span className="text-sm text-on-surface/50">Plan</span>
          <span className="text-sm flex items-center gap-2">
            {tier === 'pro' ? (
              <>
                <span className="text-accent font-medium">Pro</span>
                <button onClick={onManage} className="text-xs text-on-surface/40 hover:text-on-surface underline">Manage</button>
              </>
            ) : (
              <>
                <span>Free</span>
                <button onClick={onUpgrade} className="text-xs text-accent hover:underline">Upgrade</button>
              </>
            )}
          </span>
        </div>
        {createdAt && (
          <div className="flex items-center justify-between py-3 border-b border-on-surface/10">
            <span className="text-sm text-on-surface/50">Member since</span>
            <span className="text-sm">{createdAt}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-3 border-b border-on-surface/10">
          <span className="text-sm text-on-surface/50">Plans created</span>
          <span className="text-sm">{planCount}</span>
        </div>
        {user && (
          <div className="flex items-center justify-between py-3 border-b border-on-surface/10">
            <span className="text-sm text-on-surface/50">Sign-in method</span>
            <span className="text-sm">Google</span>
          </div>
        )}
      </div>

      {user && (
        <button
          onClick={onSignOut}
          className="w-full py-3 border border-red-500/30 text-red-400 rounded-full text-sm hover:bg-red-500/10 transition-colors"
        >
          Sign out
        </button>
      )}
    </div>
  );
};
