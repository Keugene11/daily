import React, { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import type { TierName } from '../hooks/useSubscription';

interface Props {
  user: User | null;
  planCount: number;
  tier: TierName;
  loading: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onManage: () => void;
  onUpgrade: () => void;
  onRefresh: () => Promise<void>;
  onDeleteAccount: () => Promise<boolean>;
}

export const ProfilePage: React.FC<Props> = ({ user, planCount, tier, loading, onClose, onSignOut, onManage, onUpgrade, onRefresh, onDeleteAccount }) => {
  const [syncing, setSyncing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Auto-refresh subscription on mount
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const handleRefresh = async () => {
    setSyncing(true);
    await onRefresh();
    setSyncing(false);
  };
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
            {(loading || syncing) ? (
              <span className="flex items-center gap-2 text-on-surface/40">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </span>
            ) : tier === 'pro' ? (
              <>
                <span className="text-accent font-medium">Pro</span>
                <button onClick={onManage} className="text-xs text-on-surface/40 hover:text-on-surface underline">Manage</button>
              </>
            ) : (
              <>
                <span>Free</span>
                <button onClick={onUpgrade} className="text-xs text-accent hover:underline">Upgrade</button>
                <button onClick={handleRefresh} className="text-xs text-on-surface/30 hover:text-on-surface underline">Refresh</button>
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
        <div className="space-y-3">
          <button
            onClick={onSignOut}
            className="w-full py-3 border border-red-500/30 text-red-400 rounded-full text-sm hover:bg-red-500/10 transition-colors"
          >
            Sign out
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 text-on-surface/30 text-xs hover:text-red-400 transition-colors"
            >
              Delete account
            </button>
          ) : (
            <div className="border border-red-500/20 rounded-xl p-4 space-y-3 animate-fadeIn">
              <p className="text-sm text-on-surface/60">
                This will permanently delete your account, cancel any subscriptions, and remove all your data. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setDeleting(true);
                    const success = await onDeleteAccount();
                    if (success) {
                      onSignOut();
                      setTimeout(() => { window.location.href = '/'; }, 500);
                    } else {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-full text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      Deleting...
                    </>
                  ) : 'Yes, delete my account'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2.5 border border-on-surface/20 rounded-full text-sm text-on-surface/60 hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
