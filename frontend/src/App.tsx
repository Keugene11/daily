import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { CityInput } from './components/CityInput';
import { ToolCallIndicator } from './components/ToolCallIndicator';
import { ItineraryDisplay } from './components/ItineraryDisplay';
import { WeatherCard } from './components/WeatherCard';

import { CherryBlossoms } from './components/CherryBlossoms';
import { PlanHistory, SavedPlan } from './components/PlanHistory';
import { ProfilePage } from './components/ProfilePage';
import { VoiceInput } from './components/VoiceInput';
import { PlanMap } from './components/PlanMap';
import { OutfitSuggestion } from './components/OutfitSuggestion';
import { usePlanStream } from './hooks/usePlanStream';
import { useMediaEnrichment } from './hooks/useMediaEnrichment';
import { useAuth } from './hooks/useAuth';
import { usePlans } from './hooks/usePlans';
import { useSubscription } from './hooks/useSubscription';
import { PricingModal } from './components/PricingModal';
import './styles/index.css';

const BUDGET_OPTIONS = [
  { id: 'any', label: 'Any' },
  { id: 'free', label: 'Free' },
  { id: 'low', label: '$' },
  { id: 'medium', label: '$$' },
  { id: 'high', label: '$$$' },
];

function App() {
  const { session, user, loading: authLoading, signInWithGoogle, signOut, getAccessToken } = useAuth();
  const subscription = useSubscription(getAccessToken);
  const navigate = useNavigate();
  const location = useLocation();
  const [showPricing, setShowPricing] = useState(false);
  const [city, setCity] = useState('');
  const [budget, setBudget] = useState('any');
  const { state, startStream, reset } = usePlanStream();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false;
  });

  const isHome = location.pathname === '/';
  const { plans: savedPlans, savePlan, deletePlan } = usePlans(user);
  const planSavedRef = useRef(false);

  // Feature inputs
  const [mood, setMood] = useState('');
  const [rightNow, setRightNow] = useState(false);
  const [tripDays, setTripDays] = useState(1);


  // Use the backend-resolved city for map/media (handles typos and landmark names)
  const mapCity = state.resolvedCity || city;

  // Media enrichment — progressively fetches images + YouTube videos as places appear in the stream
  const { data: mediaData } = useMediaEnrichment(state.content, mapCity, tripDays > 1 ? tripDays * 5 : 12, getAccessToken);

  // Theme toggle
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Preferences are saved for OAuth redirect flow only — don't restore on normal page load

  // Resume pending plan after OAuth redirect
  useEffect(() => {
    if (!session || authLoading) return;
    const raw = sessionStorage.getItem('daily_pending_plan');
    if (!raw) return;
    sessionStorage.removeItem('daily_pending_plan');
    try {
      const pending = JSON.parse(raw);
      if (!pending.city?.trim()) return;
      // Restore form state
      setCity(pending.city);
      setBudget(pending.budget || 'any');
      if (pending.mood) setMood(pending.mood);
      if (pending.rightNow) setRightNow(true);
      setTripDays(pending.tripDays || 1);
      // Build extras from the saved params
      const extras: Record<string, any> = {};
      if (pending.mood?.trim()) extras.mood = pending.mood.trim();
      extras.currentHour = new Date().getHours();
      extras.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (pending.rightNow) extras.rightNow = true;
      if (pending.tripDays > 1) extras.days = pending.tripDays;
      // Auto-start the plan
      localStorage.setItem('daily_prefs', JSON.stringify({ city: pending.city, budget: pending.budget || 'any' }));
      startStream(pending.city, pending.budget || 'any', extras, getAccessToken);
    } catch { /* ignore malformed data */ }
  }, [session, authLoading]);

  // Save preferences when plan starts
  const savePrefs = useCallback(() => {
    localStorage.setItem('daily_prefs', JSON.stringify({ city, budget }));
  }, [city, budget]);

  // Auto-save plan to history when generation completes + refresh subscription usage
  useEffect(() => {
    if (!state.isStreaming && state.content && city && !planSavedRef.current) {
      planSavedRef.current = true;
      const newPlan: SavedPlan = {
        id: Date.now().toString(),
        city,
        budget,
        content: state.content,
        date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        timestamp: Date.now(),
        days: tripDays > 1 ? tripDays : undefined,
      };
      savePlan(newPlan);
      // Refresh subscription so usage count reflects the plan we just generated
      subscription.refresh();
    }
    if (state.isStreaming) {
      planSavedRef.current = false;
    }
  }, [state.isStreaming, state.content, city, budget, savePlan]);

  const handleDeletePlan = (id: string) => {
    deletePlan(id);
  };

  const handleSelectPlan = (plan: SavedPlan) => {
    if (subscription.isLimitReached('plan')) {
      setShowPricing(true);
      return;
    }
    setCity(plan.city);
    setBudget(plan.budget);
    setTripDays(plan.days || 1);
    navigate('/');
    const extras = buildExtras();
    if (plan.days && plan.days > 1) {
      extras.days = plan.days;
    } else {
      delete extras.days;
    }
    startStream(plan.city, plan.budget, extras, getAccessToken);
  };

  // Build extras object for all new features
  const buildExtras = () => {
    const extras: Record<string, any> = {};
    if (mood.trim()) extras.mood = mood.trim();
    extras.currentHour = new Date().getHours();
    extras.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (rightNow) extras.rightNow = true;
    if (tripDays > 1) extras.days = tripDays;
    return extras;
  };


  const handlePlanClick = () => {
    if (!city.trim()) return;
    if (!session) {
      // Save pending plan so we can resume after OAuth redirect
      sessionStorage.setItem('daily_pending_plan', JSON.stringify({
        city, budget, mood, rightNow: false, tripDays,
      }));
      signInWithGoogle();
      return;
    }
    if (subscription.isLimitReached('plan')) {
      setShowPricing(true);
      return;
    }
    savePrefs();
    startStream(city, budget, buildExtras(), getAccessToken);
  };

  const handleReset = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
    reset();
    setCity('');
    setBudget('any');
    setMood('');
    setRightNow(false);
    setTripDays(1);
    navigate('/');
  };

  const handleReplan = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
    if (subscription.isLimitReached('plan')) {
      setShowPricing(true);
      return;
    }
    if (city.trim()) {
      startStream(city, budget, buildExtras(), getAccessToken);
    }
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!state.content) return;

    const text = state.content
      .replace(/##\s+/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    speechSynthesis.speak(utterance);
  };

  const handleShare = async () => {
    if (!state.content) return;

    const shareText = `My perfect day in ${city}:\n\n${state.content}\n\n— Generated by daily (dedaluslabs.ai)`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `My day in ${city}`, text: shareText });
        return;
      } catch { /* fallback to clipboard */ }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareMsg('Copied!');
      setTimeout(() => setShareMsg(''), 2000);
    } catch {
      setShareMsg('Failed to copy');
      setTimeout(() => setShareMsg(''), 2000);
    }
  };

  // Extract tool results for standalone cards
  const weatherData = state.toolResults['get_weather']?.data || null;


  const showResults = state.content || state.error || Object.keys(state.toolResults).length > 0 || state.thinking.length > 0;

  // Auth loading — show spinner while session is being restored
  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-on-surface/20 border-t-on-surface/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface transition-colors duration-300">
      {city.toLowerCase().includes('tokyo') && showResults && <CherryBlossoms />}
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-on-surface/10">
        <button onClick={handleReset} className="text-lg font-semibold tracking-tight hover:opacity-70 transition-opacity cursor-pointer">daily</button>
        <div className="flex items-center gap-6 text-sm text-on-surface/50">
          <button onClick={handleReset} className="hover:text-on-surface transition-colors">home</button>
          {session && (
            <button onClick={() => { navigate('/history'); reset(); }} className="hover:text-on-surface transition-colors">history</button>
          )}
          <button onClick={() => setShowPricing(true)} className="hover:text-on-surface transition-colors">
            plans
          </button>
          {session ? (
            <button onClick={() => { navigate('/profile'); reset(); }} className="hover:text-on-surface transition-colors">profile</button>
          ) : (
            <button onClick={signInWithGoogle} className="hover:text-on-surface transition-colors">sign in</button>
          )}

          <button
            onClick={() => setDark(!dark)}
            className="p-2 rounded-full border border-on-surface/15 hover:bg-on-surface/5 transition-colors"
            aria-label="Toggle theme"
          >
            {dark ? (
              <svg className="h-4 w-4 text-on-surface/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-on-surface/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <Routes>
      <Route path="/history" element={
        <PlanHistory
          plans={savedPlans}
          onSelect={handleSelectPlan}
          onDelete={handleDeletePlan}
          onClose={() => navigate('/')}
        />
      } />

      <Route path="/profile" element={
        <ProfilePage
          user={user}
          planCount={savedPlans.length}
          tier={subscription.tier}
          loading={subscription.loading}
          onClose={() => navigate('/')}
          onSignOut={signOut}
          onManage={subscription.openPortal}
          onUpgrade={() => setShowPricing(true)}
          onRefresh={subscription.refresh}
          onDeleteAccount={subscription.deleteAccount}
        />
      } />

      <Route path="*" element={<>
      {/* Hero / Input */}
      {isHome && !showResults && (
        <div className="flex flex-col items-center justify-center px-6 pt-32 pb-20">
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-center leading-[1.1] mb-6">
            A new way to plan<br />your perfect day.
          </h1>
          <p className="text-lg text-on-surface/40 text-center max-w-xl mb-16">
            AI-powered daily planning. Real-time tool calling. Personalized itineraries.
          </p>

          <div className="w-full max-w-lg space-y-6">
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <CityInput
                  value={city}
                  onChange={setCity}
                  disabled={state.isStreaming}
                />
              </div>
              <VoiceInput
                onResult={(text) => {
                  // If it sounds like a mood, set mood; otherwise set city
                  const moodWords = /feeling|tired|exhausted|wired|excited|sad|happy|terrible|awful|great|bored|adventurous|chill|stressed/i;
                  if (moodWords.test(text)) {
                    setMood(text);
                  } else {
                    setCity(text);
                  }
                }}
                disabled={state.isStreaming}
              />
            </div>

            {/* Budget filter */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-3">
                Budget
              </label>
              <div className="flex gap-2">
                {BUDGET_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setBudget(opt.id)}
                    disabled={state.isStreaming}
                    className={`px-4 py-1.5 rounded-full text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      budget === opt.id
                        ? 'bg-accent text-on-accent'
                        : 'border border-on-surface/20 text-on-surface/60 hover:border-on-surface/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trip Length */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-3">
                Trip Length
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      setTripDays(d);
                      if (d > 1) { setRightNow(false); }
                    }}
                    disabled={state.isStreaming}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      tripDays === d
                        ? 'bg-accent text-on-accent'
                        : 'border border-on-surface/20 text-on-surface/60 hover:border-on-surface/40'
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <span className="text-xs text-on-surface/30 ml-1">
                  {tripDays === 1 ? 'day' : 'days'}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            {subscription.isLimitReached('plan') ? (
              <div className="space-y-3">
                <button
                  onClick={() => setShowPricing(true)}
                  className="w-full py-3.5 bg-accent text-on-accent font-medium rounded-full text-sm hover:bg-accent/90 transition-all"
                >
                  Upgrade to Pro for Unlimited Plans
                </button>
                <p className="text-xs text-red-400 text-center">You've used all 3 free plans this month</p>
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <button
                    onClick={handlePlanClick}
                    disabled={state.isStreaming || !city.trim()}
                    className="flex-1 py-3.5 bg-accent text-on-accent font-medium rounded-full text-sm hover:bg-accent/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {state.isStreaming ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Planning...
                      </span>
                    ) : tripDays > 1 ? (
                      `Plan My ${tripDays}-Day Trip`
                    ) : (
                      'Plan My Day'
                    )}
                  </button>
                </div>

                {/* Right Now mode */}
                <button
                  onClick={() => {
                    if (!city.trim()) return;
                    if (!session) {
                      sessionStorage.setItem('daily_pending_plan', JSON.stringify({
                        city, budget, mood, rightNow: true, tripDays: 1,
                      }));
                      signInWithGoogle();
                      return;
                    }
                    if (subscription.isLimitReached('plan')) {
                      setShowPricing(true);
                      return;
                    }
                    setRightNow(true);
                    setTripDays(1);
                    savePrefs();
                    startStream(city, budget, { ...buildExtras(), rightNow: true }, getAccessToken);
                  }}
                  disabled={state.isStreaming || !city.trim() || tripDays > 1}
                  className="w-full py-3.5 border border-on-surface/20 text-on-surface/70 font-medium rounded-full text-sm hover:bg-on-surface/5 hover:text-on-surface transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  What's happening right now?
                </button>

                {/* Remaining plans counter */}
                {session && subscription.data && subscription.data.limits.plans > 0 && (
                  <p className="text-xs text-on-surface/30 text-center">
                    {subscription.data.limits.plans - subscription.data.usage.plans} of {subscription.data.limits.plans} free plans remaining this month
                  </p>
                )}
              </>
            )}
          </div>

        </div>
      )}

      {/* Results */}
      {isHome && showResults && (
        <div className="max-w-3xl mx-auto px-6 py-16">
          {/* Tool calls + thinking */}
          {(state.isStreaming || Object.keys(state.toolResults).length > 0 || state.thinking.length > 0) && (
            <div className="mb-12">
              <ToolCallIndicator
                activeToolCalls={state.activeToolCalls}
                toolResults={state.toolResults}
                thinking={state.thinking}
              />
            </div>
          )}

          {/* Weather card — appears immediately when weather tool completes */}
          {weatherData && (
            <WeatherCard data={weatherData} city={city} />
          )}

          {/* Outfit suggestion — weather-based clothing recommendation */}
          {weatherData && !state.isStreaming && (
            <OutfitSuggestion weatherData={weatherData} city={city} />
          )}

          {/* Error */}
          {state.error && state.error !== 'limit_reached' && (
            <div className="border border-red-500/30 rounded-lg p-6 mb-10 animate-fadeIn">
              <p className="text-red-500 text-sm font-medium mb-1">Something went wrong</p>
              <p className="text-on-surface/60 text-sm">{state.error}</p>
              <button
                onClick={handleReset}
                className="mt-4 px-5 py-2 text-sm border border-on-surface/20 rounded-full text-on-surface/80 hover:bg-on-surface/5 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Usage limit reached */}
          {state.error === 'limit_reached' && (
            <div className="border border-accent/30 rounded-lg p-6 mb-10 animate-fadeIn text-center">
              <p className="text-on-surface text-sm font-medium mb-1">You've used all 3 free plans this month</p>
              <p className="text-on-surface/50 text-sm mb-4">Upgrade to Pro for unlimited plans.</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowPricing(true)}
                  className="px-6 py-2.5 text-sm bg-accent text-on-accent rounded-full font-medium hover:bg-accent/90 transition-colors"
                >
                  View Plans
                </button>
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 text-sm border border-on-surface/20 rounded-full text-on-surface/60 hover:bg-on-surface/5 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          )}

          {/* Itinerary */}
          {state.content && !state.error && (
            <ItineraryDisplay
              content={state.content}
              city={city}
              days={tripDays}
              onSpeak={handleSpeak}
              onShare={handleShare}
              isSpeaking={isSpeaking}
              mediaData={mediaData}
            />
          )}

          {/* Map — interactive map with all plan locations */}
          {state.content && !state.isStreaming && !state.error && city && (
            <PlanMap content={state.content} city={mapCity} />
          )}

          {/* Share confirmation */}
          {shareMsg && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-accent text-on-accent rounded-full text-sm font-medium animate-fadeIn">
              {shareMsg}
            </div>
          )}

          {/* Actions */}
          {!state.isStreaming && (state.content || state.error) && (
            <div className="flex flex-col items-center gap-4 mt-16">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleReplan}
                  className="px-6 py-3 text-sm border border-on-surface/20 rounded-full text-on-surface/70 hover:text-on-surface hover:border-on-surface/40 transition-all"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 text-sm border border-on-surface/20 rounded-full text-on-surface/70 hover:text-on-surface hover:border-on-surface/40 transition-all"
                >
                  New plan &gt;
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      </>} />
      </Routes>

      {/* Pricing Modal */}
      {showPricing && (
        <PricingModal
          currentTier={subscription.tier}
          currentInterval={subscription.interval}
          onCheckout={subscription.createCheckout}
          onClose={() => setShowPricing(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-on-surface/10 mt-auto px-8 py-6 text-center">
        <p className="text-xs text-on-surface/30">AI-powered daily planning</p>
      </footer>
    </div>
  );
}

export default App;
