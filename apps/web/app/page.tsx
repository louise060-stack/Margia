'use client';

/**
 * The standalone plan view (the returning-user home). Fetches the sample plan
 * from the engine service and renders it. On first visit a real user would land
 * in /onboarding; this page is where she returns.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { WeeklyPlan } from '@margia/engine';
import { Week, ChoreographyNote, HealthNudge } from './_components/plan';

export default function Page() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [state, setState] = useState<'planning' | 'depleted'>('planning');

  useEffect(() => {
    fetch('/api/plan').then((r) => r.json()).then(setPlan).catch(() => setPlan(null));
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-state', state);
  }, [theme, state]);

  if (!plan) {
    return <main className="shell"><p className="voice" style={{ fontSize: 20, opacity: 0.7 }}>Building your week…</p></main>;
  }

  return (
    <main className="shell">
      <div className="topbar">
        <div className="wordmark">Margia<span className="dot">.</span></div>
        <div className="controls">
          <Link className="chip-btn" href="/onboarding">See onboarding</Link>
          <button className="chip-btn" aria-pressed={state === 'planning'} onClick={() => setState('planning')}>Sunday</button>
          <button className="chip-btn" aria-pressed={state === 'depleted'} onClick={() => { setState('depleted'); setTheme('dark'); }}>9pm</button>
          <button className="chip-btn" aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☾ Dark' : '☀ Light'}</button>
        </div>
      </div>

      {state === 'planning' ? (
        <div className="greeting">
          <div className="eyebrow">Sunday evening · next week</div>
          <h1>Your week, built around you.</h1>
          <p>I placed your things first — your run, therapy, the hour that’s yours — then let the carpools and logistics arrange themselves around them.</p>
        </div>
      ) : (
        <div className="greeting">
          <div className="eyebrow">Monday · 9:14pm</div>
          <h1>That’s the day. It’s handled.</h1>
          <p>Your run happened. Tomorrow’s already built. Nothing’s waiting on you tonight.</p>
        </div>
      )}

      {state === 'planning' && <ChoreographyNote plan={plan} />}
      <Week plan={plan} />
      {state === 'planning' && plan.healthNudge && <HealthNudge nudge={plan.healthNudge} />}

      <p className="footnote"><span className="voice">Your time went in first.</span> Everything else arranged itself around it.</p>
    </main>
  );
}
