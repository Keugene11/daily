import React, { useState } from 'react';

interface Props {
  activity: string;
  city: string;
  timeOfDay: string;
}

const CAPTION_TEMPLATES = [
  { vibe: 'aesthetic', gen: (_act: string, city: string, time: string) => `${time === 'morning' ? 'sunrise state of mind' : time === 'evening' ? 'golden hour hits different here' : 'this is what living looks like'} ~ ${city.toLowerCase()}` },
  { vibe: 'enthusiastic', gen: (_act: string, city: string) => `the kind of day you never want to end. ${city} really said "you're welcome"` },
  { vibe: 'minimal', gen: (_act: string, city: string) => `${city.toLowerCase()}. that's it. that's the post.` },
  { vibe: 'storytelling', gen: (act: string, _city: string, time: string) => `chapter ${time === 'morning' ? 'one' : time === 'evening' ? 'three' : 'two'}: ${act.split('.')[0].toLowerCase().replace(/^(go |visit |head |stop |start |grab |try |check )/, '')}` },
];

function generateHashtags(city: string, activity: string): string[] {
  const base = [`#${city.replace(/\s+/g, '')}`, '#travelgram', '#wanderlust', '#dailyplanner'];
  const actLower = activity.toLowerCase();

  if (actLower.includes('food') || actLower.includes('eat') || actLower.includes('restaurant') || actLower.includes('brunch') || actLower.includes('coffee'))
    base.push('#foodie', '#foodgram', '#instafood', `#${city.replace(/\s+/g, '')}eats`);
  if (actLower.includes('museum') || actLower.includes('art') || actLower.includes('gallery'))
    base.push('#artlover', '#museumday', '#culturevulture');
  if (actLower.includes('sunset') || actLower.includes('sunrise') || actLower.includes('golden'))
    base.push('#goldenhour', '#sunsetlover', '#magichour');
  if (actLower.includes('park') || actLower.includes('hike') || actLower.includes('outdoor') || actLower.includes('beach'))
    base.push('#naturelover', '#outdooradventures', '#exploremore');
  if (actLower.includes('bar') || actLower.includes('cocktail') || actLower.includes('drink') || actLower.includes('nightlife'))
    base.push('#nightout', '#cocktailhour', '#cheers');
  if (actLower.includes('market') || actLower.includes('shop'))
    base.push('#marketvibes', '#localfinds');

  base.push('#dailyapp', '#plannedbydaily');
  return [...new Set(base)].slice(0, 12);
}

export const InstagramCaption: React.FC<Props> = ({ activity, city, timeOfDay }) => {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vibeIdx, setVibeIdx] = useState(0);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-1 text-[10px] text-on-surface/25 hover:text-pink-400 transition-colors mt-1"
        title="Generate Instagram caption"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
        Caption
      </button>
    );
  }

  const template = CAPTION_TEMPLATES[vibeIdx % CAPTION_TEMPLATES.length];
  const caption = template.gen(activity, city, timeOfDay);
  const hashtags = generateHashtags(city, activity);
  const fullText = `${caption}\n\n${hashtags.join(' ')}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShuffle = () => {
    setVibeIdx((vibeIdx + 1) % CAPTION_TEMPLATES.length);
  };

  return (
    <div className="mt-2 border border-pink-500/20 rounded-lg p-3 bg-pink-500/[0.03] animate-fadeIn">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-pink-400 font-medium">Instagram Caption</span>
        <button onClick={() => setShow(false)} className="text-on-surface/30 hover:text-on-surface/60 text-xs">close</button>
      </div>

      <p className="text-sm text-on-surface/70 italic mb-2">{caption}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {hashtags.map(tag => (
          <span key={tag} className="text-[10px] text-pink-400/60">{tag}</span>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={handleCopy} className="px-3 py-1 text-[10px] rounded-full bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 transition-colors">
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button onClick={handleShuffle} className="px-3 py-1 text-[10px] rounded-full border border-pink-500/20 text-pink-400/60 hover:text-pink-400 transition-colors">
          Shuffle vibe
        </button>
      </div>
    </div>
  );
};
