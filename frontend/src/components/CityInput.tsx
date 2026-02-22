import React from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const CityInput: React.FC<Props> = ({ value, onChange, disabled }) => {
  return (
    <div>
      <label htmlFor="city" className="block text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-3">
        Location
      </label>
      <input
        id="city"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        placeholder="City, country, or state"
        className="w-full bg-transparent border-b border-on-surface/20 pb-3 text-lg text-on-surface placeholder-on-surface/20 focus:outline-none focus:border-on-surface/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      />
    </div>
  );
};
