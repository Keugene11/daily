import React from 'react';

export interface SavedPlan {
  id: string;
  city: string;
  interests: string[];
  budget: string;
  content: string;
  date: string;
  timestamp: number;
  days?: number;
}

interface Props {
  plans: SavedPlan[];
  onSelect: (plan: SavedPlan) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const PlanHistory: React.FC<Props> = ({ plans, onSelect, onDelete, onClose }) => {
  if (plans.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="text-4xl mb-4">~</div>
        <h2 className="text-xl font-semibold mb-2">No plans yet</h2>
        <p className="text-on-surface/40 text-sm mb-8">Your generated plans will appear here as a timeline.</p>
        <button onClick={onClose} className="px-6 py-2.5 border border-on-surface/20 rounded-full text-sm text-on-surface/70 hover:text-on-surface transition-colors">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-2xl font-semibold">Your Plans</h2>
        <button onClick={onClose} className="text-sm text-on-surface/50 hover:text-on-surface transition-colors">Back</button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-on-surface/10" />

        {plans.map((plan) => {
          // Extract first line of each section for preview
          const preview = plan.content
            .split(/##\s+/)[1]?.split('\n').slice(1).join(' ').slice(0, 120) || plan.content.slice(0, 120);

          return (
            <div key={plan.id} className="relative pl-12 pb-10 group">
              {/* Timeline dot */}
              <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-accent border-2 border-surface" />

              <div
                className="border border-on-surface/10 rounded-xl p-5 hover:border-on-surface/25 transition-all cursor-pointer group-hover:bg-on-surface/[0.02]"
                onClick={() => onSelect(plan)}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-medium text-lg">
                      {plan.city}
                      {plan.days && plan.days > 1 && (
                        <span className="text-xs text-on-surface/35 font-normal ml-2">{plan.days}-day trip</span>
                      )}
                    </h3>
                    <p className="text-xs text-on-surface/35">{plan.date}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(plan.id); }}
                    className="p-1.5 rounded-full text-on-surface/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete plan"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {plan.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {plan.interests.map(i => (
                      <span key={i} className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border border-on-surface/10 text-on-surface/40">
                        {i}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-sm text-on-surface/50 line-clamp-2">{preview}...</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
