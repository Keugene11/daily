import React from 'react';

interface Props {
  message: string;
  onUpgrade: () => void;
}

export const UpgradePrompt: React.FC<Props> = ({ message, onUpgrade }) => {
  return (
    <div className="border border-accent/30 rounded-lg p-4 mb-6 animate-fadeIn">
      <p className="text-sm text-on-surface/60 mb-2">{message}</p>
      <button
        onClick={onUpgrade}
        className="text-sm font-medium text-accent hover:underline"
      >
        View plans &rarr;
      </button>
    </div>
  );
};
