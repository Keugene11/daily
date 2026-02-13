import React from 'react';

export interface GalleryPlan {
  id: string;
  city: string;
  title: string;
  author: string;
  interests: string[];
  preview: string;
  likes: number;
  timeAgo: string;
}

const SAMPLE_PLANS: GalleryPlan[] = [
  {
    id: 'g1', city: 'Tokyo', title: 'Anime & Ramen Crawl', author: 'sakura_dreamer',
    interests: ['food', 'culture', 'nightlife'],
    preview: 'Started with tsukemen at Fuunji in Shinjuku, hit Akihabara for retro games, ended with midnight ramen in Golden Gai...',
    likes: 342, timeAgo: '2h ago'
  },
  {
    id: 'g2', city: 'New York', title: 'Brooklyn Art & Pizza Day', author: 'nyclocal_',
    interests: ['food', 'culture', 'outdoors'],
    preview: 'Morning at the Brooklyn Museum, walked across the bridge at golden hour, $1 slices at 2 Bros, jazz at Smalls...',
    likes: 218, timeAgo: '5h ago'
  },
  {
    id: 'g3', city: 'Paris', title: 'Left Bank Literary Walk', author: 'je_flaneur',
    interests: ['culture', 'food', 'relaxation'],
    preview: 'Shakespeare & Company at opening, croissants at Café de Flore, Musée d\'Orsay, wine along the Seine at sunset...',
    likes: 456, timeAgo: '8h ago'
  },
  {
    id: 'g4', city: 'Mexico City', title: 'Taco & Mezcal Mission', author: 'cdmx_vibes',
    interests: ['food', 'nightlife', 'culture'],
    preview: 'Al pastor at El Vilsito (the VW Bug taco stand), Frida Kahlo museum, mezcalería in Roma Norte, lucha libre...',
    likes: 189, timeAgo: '12h ago'
  },
  {
    id: 'g5', city: 'Seoul', title: 'K-Beauty & Street Food', author: 'hallyu_fan',
    interests: ['food', 'shopping', 'culture'],
    preview: 'Myeongdong sheet mask shopping, bindaetteok at Gwangjang Market, hanbok photoshoot at Gyeongbokgung, BBQ in Gangnam...',
    likes: 291, timeAgo: '1d ago'
  },
  {
    id: 'g6', city: 'Nashville', title: 'Honky-Tonk & Hot Chicken', author: 'music_city_mama',
    interests: ['music', 'food', 'nightlife'],
    preview: 'Prince\'s Hot Chicken for breakfast (yes, breakfast), vinyl shopping at Grimey\'s, Broadway bar crawl, Bluebird Cafe...',
    likes: 167, timeAgo: '1d ago'
  },
];

interface Props {
  onSteal: (city: string, interests: string[]) => void;
}

export const PlanGallery: React.FC<Props> = ({ onSteal }) => {
  return (
    <div className="mt-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Steal a Plan</h2>
          <p className="text-xs text-on-surface/35 mt-1">Popular plans from the community. Click to make it yours.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SAMPLE_PLANS.map(plan => (
          <div
            key={plan.id}
            onClick={() => onSteal(plan.city, plan.interests)}
            className="border border-on-surface/10 rounded-xl p-5 hover:border-on-surface/25 hover:bg-on-surface/[0.02] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-medium text-sm group-hover:text-accent transition-colors">{plan.title}</h3>
                <p className="text-[11px] text-on-surface/30">by @{plan.author} &middot; {plan.timeAgo}</p>
              </div>
              <span className="text-xs text-on-surface/25 font-medium">{plan.city}</span>
            </div>

            <div className="flex flex-wrap gap-1 mb-2.5">
              {plan.interests.map(i => (
                <span key={i} className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded-full border border-on-surface/8 text-on-surface/30">
                  {i}
                </span>
              ))}
            </div>

            <p className="text-xs text-on-surface/40 line-clamp-2 mb-3">{plan.preview}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-on-surface/25">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
                <span className="text-[10px]">{plan.likes}</span>
              </div>
              <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                Steal this plan &rarr;
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
