import React, { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  recentCities?: string[];
}

export const CityInput: React.FC<Props> = ({ value, onChange, disabled, recentCities = [] }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter recent cities: dedupe (case-insensitive), exclude current value, limit to 5
  const filtered = recentCities
    .filter(c => c.toLowerCase() !== value.toLowerCase() && c.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 5);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor="city" className="block text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-3">
        Location
      </label>
      <input
        id="city"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        disabled={disabled}
        autoComplete="off"
        placeholder="City, country, or state"
        className="w-full bg-transparent border-b border-on-surface/20 pb-3 text-lg text-on-surface placeholder-on-surface/20 focus:outline-none focus:border-on-surface/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      />
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-surface border border-on-surface/10 rounded-md shadow-md overflow-hidden">
          {filtered.map((city) => (
            <button
              key={city}
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] text-on-surface/60 hover:bg-on-surface/[0.05] transition-colors cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(city);
                setShowDropdown(false);
              }}
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
