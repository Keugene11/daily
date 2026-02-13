import React, { useState } from 'react';

interface Props {
  weatherData: any;
  interests: string[];
  city: string;
}

interface OutfitItem {
  category: string;
  item: string;
  reason: string;
}

function generateOutfit(weather: any, interests: string[], city: string): { items: OutfitItem[]; vibe: string } {
  const items: OutfitItem[] = [];
  const temp = parseFloat(weather?.temperature) || 20;
  const condition = (weather?.condition || '').toLowerCase();
  const wind = (weather?.wind || '').toLowerCase();
  const uv = parseInt(weather?.uvIndex) || 0;

  // Temperature-based layers
  if (temp < 5) {
    items.push({ category: 'Layer', item: 'Heavy winter coat', reason: `It's ${temp}°C — bundle up` });
    items.push({ category: 'Base', item: 'Thermal base layer + sweater', reason: 'You need insulation' });
    items.push({ category: 'Accessories', item: 'Scarf, beanie, and gloves', reason: 'Protect your extremities' });
  } else if (temp < 12) {
    items.push({ category: 'Layer', item: 'Warm jacket or peacoat', reason: `${temp}°C — chilly but manageable` });
    items.push({ category: 'Base', item: 'Long-sleeve shirt or light sweater', reason: 'Layering is key' });
  } else if (temp < 20) {
    items.push({ category: 'Layer', item: 'Light jacket or cardigan', reason: `${temp}°C — bring a layer for later` });
    items.push({ category: 'Base', item: 'T-shirt or casual button-down', reason: 'Comfortable for walking' });
  } else if (temp < 28) {
    items.push({ category: 'Top', item: 'Breathable cotton tee or linen shirt', reason: `${temp}°C — keep it light` });
  } else {
    items.push({ category: 'Top', item: 'Tank top or lightweight linen', reason: `${temp}°C — it's hot out there` });
    items.push({ category: 'Accessories', item: 'Portable fan or cooling towel', reason: 'Beat the heat' });
  }

  // Rain gear
  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower')) {
    items.push({ category: 'Rain', item: 'Waterproof jacket + compact umbrella', reason: `Rain expected — ${condition}` });
    items.push({ category: 'Footwear', item: 'Waterproof boots or shoes', reason: 'Keep your feet dry' });
  }

  // Wind
  if (wind.includes('strong') || wind.includes('gust') || parseInt(wind) > 30) {
    items.push({ category: 'Layer', item: 'Windbreaker', reason: 'It\'s breezy out there' });
  }

  // UV protection
  if (uv >= 6) {
    items.push({ category: 'Sun', item: 'Sunglasses + SPF 50 sunscreen', reason: `UV index ${uv} — protect your skin` });
    items.push({ category: 'Accessories', item: 'Wide-brim hat or cap', reason: 'Shade is your friend' });
  } else if (uv >= 3) {
    items.push({ category: 'Sun', item: 'Sunglasses + SPF 30', reason: `UV index ${uv} — moderate sun` });
  }

  // Activity-based
  if (interests.includes('outdoors') || interests.includes('sports')) {
    if (!items.find(i => i.category === 'Footwear')) {
      items.push({ category: 'Footwear', item: 'Comfortable walking shoes or sneakers', reason: 'You\'ll be on your feet' });
    }
  }

  if (interests.includes('nightlife') || interests.includes('food')) {
    items.push({ category: 'Evening', item: 'Smart-casual option for dinner', reason: 'Some spots have dress codes' });
  }

  if (interests.includes('culture')) {
    items.push({ category: 'Bag', item: 'Crossbody bag or small backpack', reason: 'Hands-free for museums and galleries' });
  }

  // Default footwear if not added
  if (!items.find(i => i.category === 'Footwear')) {
    items.push({ category: 'Footwear', item: temp > 25 ? 'Breathable sneakers or sandals' : 'Comfortable sneakers', reason: 'All-day comfort' });
  }

  // Vibe summary
  const vibes = [];
  if (temp > 25) vibes.push('summer');
  else if (temp > 15) vibes.push('spring');
  else if (temp > 5) vibes.push('autumn');
  else vibes.push('winter');

  if (condition.includes('rain')) vibes.push('rainy');
  if (condition.includes('sun') || condition.includes('clear')) vibes.push('sunny');
  if (interests.includes('nightlife')) vibes.push('going-out');
  if (interests.includes('outdoors')) vibes.push('active');

  const vibe = `${vibes[0]} ${vibes.length > 1 ? vibes[1] : 'casual'} in ${city}`;

  return { items, vibe };
}

export const OutfitSuggestion: React.FC<Props> = ({ weatherData, interests, city }) => {
  const [show, setShow] = useState(false);

  if (!weatherData) return null;

  const { items, vibe } = generateOutfit(weatherData, interests, city);

  return (
    <div className="mb-8">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 text-xs text-on-surface/35 hover:text-on-surface/60 transition-colors mb-3"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        {show ? 'Hide outfit suggestion' : 'What should I wear?'}
      </button>

      {show && (
        <div className="border border-on-surface/10 rounded-xl p-5 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium">Today's Outfit</h3>
              <p className="text-[10px] text-on-surface/30 capitalize">{vibe}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-16 text-[9px] uppercase tracking-wider text-on-surface/25 pt-0.5">{item.category}</span>
                <div className="flex-1">
                  <p className="text-sm text-on-surface/70">{item.item}</p>
                  <p className="text-[10px] text-on-surface/30">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
