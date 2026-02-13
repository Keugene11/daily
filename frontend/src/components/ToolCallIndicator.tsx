import React from 'react';
import { ToolResult } from '../types';

interface Props {
  activeToolCalls: string[];
  toolResults: Record<string, ToolResult>;
  thinking: string[];
}

const TOOL_CONFIG: Record<string, { label: string }> = {
  get_weather: { label: 'Weather' },
  get_local_events: { label: 'Events' },
  get_trending_news: { label: 'News' },
  get_random_activity: { label: 'Activity' },
  get_restaurant_recommendations: { label: 'Restaurants' },
  get_playlist_suggestion: { label: 'Playlist' },
  get_transit_estimates: { label: 'Transit' },
  get_accommodations: { label: 'Stays' },
  get_tech_meetups: { label: 'Meetups' }
};

export const ToolCallIndicator: React.FC<Props> = React.memo(({ activeToolCalls, toolResults, thinking }) => {
  // Only show tools that have been called or are active
  const visibleTools = Object.keys(TOOL_CONFIG).filter(
    tool => activeToolCalls.includes(tool) || tool in toolResults
  );

  return (
    <div>
      {/* Thinking indicator */}
      {thinking.length > 0 && (
        <div className="mb-6 animate-fadeIn">
          <p className="text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-2">Agent thinking</p>
          {thinking.map((thought, i) => (
            <p key={i} className="text-sm text-on-surface/50 italic animate-fadeIn">
              {thought}
            </p>
          ))}
        </div>
      )}

      {visibleTools.length > 0 && (
        <>
          <p className="text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-4">Gathering data</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {visibleTools.map(tool => {
              const config = TOOL_CONFIG[tool] || { label: tool };
              const isActive = activeToolCalls.includes(tool);
              const hasResult = tool in toolResults;
              const result = toolResults[tool];
              const success = hasResult && result.success;
              const failed = hasResult && !result.success;

              return (
                <div
                  key={tool}
                  className={`border rounded-lg px-4 py-3 transition-all duration-300 animate-fadeIn ${
                    isActive
                      ? 'border-on-surface/25 bg-on-surface/5'
                      : success
                      ? 'border-on-surface/10 bg-on-surface/[0.02]'
                      : failed
                      ? 'border-red-500/20 bg-red-500/[0.03]'
                      : 'border-on-surface/5 opacity-30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-on-surface/70">{config.label}</span>
                    {isActive && (
                      <div className="h-1.5 w-1.5 rounded-full bg-on-surface animate-pulse-subtle" />
                    )}
                    {success && (
                      <svg className="h-3 w-3 text-on-surface/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {failed && (
                      <svg className="h-3 w-3 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  {isActive && (
                    <div className="h-[1px] bg-on-surface/10 mt-2 overflow-hidden rounded-full">
                      <div className="h-full bg-on-surface/30 rounded-full animate-pulse-subtle" style={{ width: '60%' }} />
                    </div>
                  )}
                  {failed && result.error && (
                    <p className="text-[10px] text-red-400/50 mt-1 truncate">{result.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

ToolCallIndicator.displayName = 'ToolCallIndicator';
