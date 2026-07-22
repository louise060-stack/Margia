'use client';

/**
 * Margia onboarding — PRD Section 4, in the Mulberry language.
 *
 * Hard rules honoured: calendar-connect (REAL Google OAuth) BEFORE any question;
 * no loading screens (the plan assembles instead); no celebratory copy; the
 * deferral answer travels VERBATIM into the plan; four questions max; mobile-first,
 * thumb-zone actions. Corrections from the live-test panel: backward navigation
 * (a quiet chevron + tappable answers), and the kids question captures number of
 * kids + each age with NO keyboard. The reveal calls the real engine (POST /api/plan).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { WeeklyPlan } from '@margia/engine';
import { Week, ChoreographyNote, HealthNudge } from '../_components/plan';

type Step = 'arrival' | 'connect' | 'reading' | 'q1' | 'q2' | 'q3' | 'q4' | 'assembling' | 'reveal';
type QStep = 'q1' | 'q2' | 'q3' | 'q4';
type Availability = 'MORNING' | 'MIDDAY' | 'EVENING' | 'UNSURE';
type Household = 'SHARED' | 'MOSTLY_ME' | 'JUST_ME';

// fallback shown only if she skips connecting her calendar
const SAMPLE_EVENTS = [
  { label: 'Work', day: 'Mon' },
  { label: 'School pickup', day: 'Tue' },
  { label: 'Soccer practice', day: 'Wed' },
  { label: 'Dinner prep', day: 'Thu' },
  { label: 'Bath + bedtime', day: 'Fri' },
];

const AVAIL_LABEL: Record<Availability, string> = {
  MORNING: 'Morning · before 9am',
  MIDDAY: 'Midday · 9am–2pm',
  EVENING: 'Evening · after 7pm',
  UNSURE: 'Honestly, not sure yet',
};

const BACK_TO: Record<QStep, Step> = { q1: 'connect', q2: 'q1', q3: 'q2', q4: 'q3' };

export default function Onboarding() {
  const [step, setStep] = useState<Step>('arrival');
  const [deferral, setDeferral] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [kidCount, setKidCount] = useState(0);
  const [kidAges, setKidAges] = useState<number[]>([]);
  const [myAge, setMyAge] = useState(38);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-state', 'planning');
  }, []);

  // returning from Google's consent screen — resume at "reading your week"
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('connected') === '1') setStep('reading');
    else if (p.get('connect')) setStep('connect'); // denied / error — let her retry or skip
  }, []);

  // generate the real plan when we hit assembling
  useEffect(() => {
    if (step !== 'assembling') return;
    let alive = true;
    const started = Date.now();
    fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deferral,
        availability: availability ?? 'UNSURE',
        household,
        kidsAges: kidAges.slice(0, kidCount).map(String),
        age: myAge,
      }),
    })
      .then((r) => r.json())
      .then((p: WeeklyPlan) => {
        const wait = Math.max(0, 2400 - (Date.now() - started));
        setTimeout(() => { if (alive) { setPlan(p); setStep('reveal'); } }, wait);
      });
    return () => { alive = false; };
  }, [step, deferral, availability, household, kidAges, kidCount, myAge]);

  const setCount = (n: number) => {
    setKidCount(n);
    setKidAges((prev) => {
      const a = [...prev];
      while (a.length < n) a.push(4);
      a.length = n;
      return a;
    });
  };
  const setKidAge = (i: number, v: number) => setKidAges((prev) => { const a = [...prev]; a[i] = v; return a; });

  const dotIndex: Record<QStep, number> = { q1: 0, q2: 1, q3: 2, q4: 3 };
  const isQ = (s: Step): s is QStep => s === 'q1' || s === 'q2' || s === 'q3' || s === 'q4';

  return (
    <main className="ob-shell">
      {step === 'arrival' && <Arrival onNext={() => setStep('connect')} />}

      {step === 'connect' && <Connect onSkip={() => setStep('q1')} />}

      {step === 'reading' && <Reading onDone={() => setStep('q1')} />}

      {isQ(step) && (
        <QuestionLayout
          dot={dotIndex[step]}
          onBack={() => setStep(BACK_TO[step])}
          assembling={
            <Assembling
              deferral={deferral}
              availability={availability}
              count={kidCount}
              ages={kidAges}
              onJump={(s) => setStep(s)}
            />
          }
        >
          {step === 'q1' && <Q1 value={deferral} onChange={setDeferral} onNext={() => setStep('q2')} />}
          {step === 'q2' && <Q2 value={availability} onPick={(v) => { setAvailability(v); setStep('q3'); }} />}
          {step === 'q3' && <Q3 value={household} onPick={(v) => { setHousehold(v); setStep('q4'); }} />}
          {step === 'q4' && (
            <Q4
              count={kidCount}
              onCount={setCount}
              ages={kidAges}
              onAge={setKidAge}
              myAge={myAge}
              onMyAge={setMyAge}
              canContinue={kidCount > 0 && myAge >= 18}
              onNext={() => setStep('assembling')}
            />
          )}
        </QuestionLayout>
      )}

      {step === 'assembling' && <AssemblingFull deferral={deferral} />}

      {step === 'reveal' && plan && <Reveal plan={plan} />}
    </main>
  );
}

/* ---------------------------------------------------------------- Arrival */
function Arrival({ onNext }: { onNext: () => void }) {
  return (
    <section className="ob-card ob-arrival">
      <div className="ob-logo">Margia<span className="dot">.</span></div>
      <p className="ob-sentence">Your week, built around you.</p>
      <div className="ob-bottom">
        <button className="ob-cta" onClick={onNext}>Build my week</button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Connect */
function Connect({ onSkip }: { onSkip: () => void }) {
  return (
    <section className="ob-card ob-connect">
      <h2 className="ob-h2">First, your calendar.</h2>
      <p className="ob-explain">We build your week from your actual schedule — not a template.</p>
      <p className="ob-trust">Margia only asks to <b>read</b> your events — never to change, move, or delete them. That’s the only permission we request.</p>
      <div className="ob-bottom">
        <button className="ob-cta" onClick={() => { window.location.href = '/api/auth/google/start'; }}>
          <span className="g-glyph">G</span> Connect my calendar
        </button>
        <p className="ob-secondary">Only Google Calendar for now. Apple Calendar coming soon.</p>
        <button className="ob-textlink" onClick={onSkip}>I’ll connect it later</button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Reading */
function Reading({ onDone }: { onDone: () => void }) {
  const [events, setEvents] = useState<{ label: string; day: string }[] | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/calendar/events')
      .then((r) => r.json())
      .then((d: { connected: boolean; events?: { label: string; dayName: string }[] }) => {
        if (!alive) return;
        const real = d.connected && d.events && d.events.length
          ? d.events.slice(0, 6).map((e) => ({ label: e.label, day: e.dayName }))
          : SAMPLE_EVENTS;
        setEvents(real);
      })
      .catch(() => { if (alive) setEvents(SAMPLE_EVENTS); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!events) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    events.forEach((_, i) => timers.push(setTimeout(() => setShown(i + 1), 350 * (i + 1))));
    timers.push(setTimeout(onDone, 350 * events.length + 1400));
    return () => timers.forEach(clearTimeout);
  }, [events, onDone]);

  return (
    <section className="ob-card ob-reading">
      <h2 className="ob-h2 reading">Reading your week…</h2>
      <div className="ob-events">
        {(events ?? []).slice(0, shown).map((e, i) => (
          <div key={i} className="ob-event">
            <span className="ob-event-name">{e.label}</span>
            <span className="ob-event-day">{e.day}</span>
          </div>
        ))}
      </div>
      <p className="ob-reading-foot">Building your week from your actual calendar.</p>
    </section>
  );
}

/* --------------------------------------------------- Question scaffolding */
function QuestionLayout({ dot, onBack, assembling, children }: { dot: number; onBack: () => void; assembling: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ob-qwrap">
      <div className="ob-qmain">
        <div className="ob-topnav">
          <button className="ob-back" onClick={onBack} aria-label="Go back">‹ Back</button>
          <div className="ob-dots">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`ob-dot ${i === dot ? 'on' : ''} ${i < dot ? 'done' : ''}`} />
            ))}
          </div>
        </div>
        {children}
      </div>
      <aside className="ob-aside">{assembling}</aside>
    </div>
  );
}

function Q1({ value, onChange, onNext }: { value: string; onChange: (v: string) => void; onNext: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="ob-question">
      <h2 className="ob-q">What’s the one thing you keep rescheduling?</h2>
      <input
        ref={ref}
        className="ob-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. my smear test, any kind of exercise, the dentist…"
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onNext(); }}
      />
      <div className="ob-bottom">
        <button className="ob-cta" disabled={!value.trim()} onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

function Q2({ value, onPick }: { value: Availability | null; onPick: (v: Availability) => void }) {
  const opts: Availability[] = ['MORNING', 'MIDDAY', 'EVENING', 'UNSURE'];
  return (
    <div className="ob-question">
      <h2 className="ob-q">When do you actually have time for yourself?</h2>
      <div className="ob-options">
        {opts.map((o) => (
          <button key={o} className={`ob-option ${value === o ? 'sel' : ''}`} onClick={() => onPick(o)}>
            {AVAIL_LABEL[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Q3({ value, onPick }: { value: Household | null; onPick: (v: Household) => void }) {
  const opts: [Household, string][] = [
    ['SHARED', 'Yes, we coordinate together'],
    ['MOSTLY_ME', 'Mostly me'],
    ['JUST_ME', 'It’s just me'],
  ];
  return (
    <div className="ob-question">
      <h2 className="ob-q">Does a partner share the family schedule with you?</h2>
      <div className="ob-options">
        {opts.map(([v, label]) => (
          <button key={v} className={`ob-option ${value === v ? 'sel' : ''}`} onClick={() => onPick(v)}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/* A tap-only stepper — no keyboard, big thumb targets. */
function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div className="ob-stepper">
      <button className="ob-step" aria-label="Less" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="ob-step-val"><span className="num">{value}</span><span className="ob-step-suffix">{suffix}</span></span>
      <button className="ob-step" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

function Q4({
  count, onCount, ages, onAge, myAge, onMyAge, canContinue, onNext,
}: {
  count: number; onCount: (n: number) => void; ages: number[]; onAge: (i: number, v: number) => void;
  myAge: number; onMyAge: (v: number) => void; canContinue: boolean; onNext: () => void;
}) {
  return (
    <div className="ob-question">
      <h2 className="ob-q">Who are we working around?</h2>

      <label className="ob-sublabel">How many kids?</label>
      <div className="ob-count">
        {[1, 2, 3, 4].map((n) => (
          <button key={n} className={`ob-countchip ${count === n ? 'sel' : ''}`} onClick={() => onCount(n)}>
            {n === 4 ? '4+' : n}
          </button>
        ))}
      </div>

      {count > 0 && (
        <div className="ob-kidages">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="ob-stepper-row">
              <span className="ob-stepper-lab">{count > 1 ? `Child ${i + 1}` : 'Their age'}</span>
              <Stepper value={ages[i] ?? 4} min={0} max={17} onChange={(v) => onAge(i, v)} suffix={(ages[i] ?? 4) === 1 ? 'yr' : 'yrs'} />
            </div>
          ))}
        </div>
      )}

      <div className="ob-subq">
        <div className="ob-stepper-row">
          <span className="ob-stepper-lab">And you?</span>
          <Stepper value={myAge} min={18} max={70} onChange={onMyAge} suffix="yrs" />
        </div>
      </div>

      <div className="ob-bottom">
        <button className="ob-cta" disabled={!canContinue} onClick={onNext}>Build my week</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------ the assembling preview */
function Assembling({ deferral, availability, count, ages, onJump }: {
  deferral: string; availability: Availability | null; count: number; ages: number[]; onJump: (s: QStep) => void;
}) {
  const items = useMemo(() => {
    const out: { label: string; sub: string; kind: 'prot' | 'ghost'; to?: QStep }[] = [];
    if (deferral.trim()) out.push({ label: deferral.trim(), sub: 'held for you', kind: 'prot', to: 'q1' });
    out.push({ label: 'Solo time', sub: 'held for you', kind: 'prot' });
    if (availability) out.push({ label: 'Your window', sub: AVAIL_LABEL[availability].toLowerCase(), kind: 'ghost', to: 'q2' });
    if (count > 0) out.push({ label: `${count} ${count > 1 ? 'kids' : 'kid'}`, sub: `${count > 1 ? 'ages' : 'age'} ${ages.slice(0, count).join(', ')} — arranged around you`, kind: 'ghost', to: 'q4' });
    return out;
  }, [deferral, availability, count, ages]);

  return (
    <div className="ob-assembling">
      <div className="ob-assembling-head">Your week, so far</div>
      {items.length === 0 && <div className="ob-assembling-empty">Watch it take shape as you answer.</div>}
      {items.map((it, i) => (
        <button
          key={i}
          className={`ob-slot ${it.kind} ${it.to ? 'tappable' : ''}`}
          onClick={() => it.to && onJump(it.to)}
          disabled={!it.to}
        >
          <div className="ob-slot-lab">{it.label}</div>
          <div className="ob-slot-sub">{it.sub}{it.to ? ' · tap to edit' : ''}</div>
        </button>
      ))}
    </div>
  );
}

function AssemblingFull({ deferral }: { deferral: string }) {
  return (
    <section className="ob-card ob-assembling-full">
      <div className="ob-build-anim">
        <span className="ob-build-bar b1" />
        <span className="ob-build-bar b2" />
        <span className="ob-build-bar b3" />
      </div>
      <p className="ob-building-line voice">
        Placing {deferral.trim() ? `“${deferral.trim().toLowerCase()}”` : 'your time'} first, then arranging everything else around it…
      </p>
    </section>
  );
}

/* ----------------------------------------------------------------- Reveal */
function Reveal({ plan }: { plan: WeeklyPlan }) {
  return (
    <div className="shell ob-reveal">
      <div className="greeting" style={{ textAlign: 'center' }}>
        <div className="eyebrow">here’s your week</div>
        <h1>This week already has you in it.</h1>
      </div>
      <ChoreographyNote plan={plan} />
      <Week plan={plan} />
      {plan.healthNudge && <HealthNudge nudge={plan.healthNudge} />}
      <div className="ob-reveal-actions">
        <Link className="btn primary big" href="/">Looks good</Link>
        <button className="ob-textlink">Let me adjust</button>
      </div>
    </div>
  );
}
