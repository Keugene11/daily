import React from 'react';

interface Props {
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

const INTEREST_OPTIONS = [
  { id: 'outdoors', label: 'Outdoors' },
  { id: 'food', label: 'Food & Dining' },
  { id: 'culture', label: 'Arts & Culture' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'music', label: 'Music' },
  { id: 'sports', label: 'Sports' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'relaxation', label: 'Wellness' },
  { id: 'tech', label: 'Tech & Startups' },
  { id: 'coding', label: 'Coding' }
];

export const InterestsSelector: React.FC<Props> = ({ selected, onChange, disabled }) => {
  const toggleInterest = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(i => i !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-3">
        Interests
      </label>
      <div className="flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map(option => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              onClick={() => !disabled && toggleInterest(option.id)}
              disabled={disabled}
              className={`px-4 py-1.5 rounded-full text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                isSelected
                  ? 'bg-accent text-on-accent'
                  : 'border border-on-surface/20 text-on-surface/60 hover:border-on-surface/40 hover:text-on-surface/80'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
