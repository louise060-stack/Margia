'use client';

/**
 * Margia onboarding — PRD Section 4, in the Mulberry language.
 *
 * Hard rules honoured: calendar-connect BEFORE any question; no loading screens
 * (the plan assembles instead); no celebratory copy; the deferral answer travels
 * VERBATIM into the plan; four questions max; mobile-first, thumb-zone actions.
 * The reveal calls the real engine (POST /api/plan) with her answers.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { WeeklyPlan } from '@margia/engine';
import { Week, ChoreographyNote, HealthNudge } from '../_components/plan';

type Step = 'arrival' | 'connect' | 'reading' | 'q1' | 'q2' | 'q3' | 'q4' | 'assembling' | 'reveal';
type Availability = 'MORNING' | 'MIDDAY' | 'EVENING' | 'UNSURE';
type Household = 'SHARED' | 'MOSTLY_ME' | 'JUST_ME';

// stand-in for her real Google events until OAuth is wired
const SAMPLE_EVENTS = [
  { label: 'Work', day: 'Mon' },
  { label: 'School pickup', day: 'Tue' },
  { label: 'Soccer practice (Ben)', day: 'Wed' },
  { label: 'Dinner prep', day: 'Thu' },
  { label: 'Bath + bedtime', day: 'Fri' },
];

const AVAIL_LABEL: Record<Availability, string> = {
  MORNING: 'Morning · before 9am',
  MIDDAY: 'Midday · 9am–2pm',
  EVENING: 'Evening · after 7pm',
  UNSURE: 'Honestly, not sure yet',
};

export default function Onboarding() {
  const [step, setStep] = useState<Step>('arrival');
  const [deferral, setDeferral] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [kids, setKids] = useState<string[]>([]);
  const [age, setAge] = useState('');
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-state', 'planning');
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
        kidsAges: kids,
        age: Number(age) || 38,
      }),
    })
      .then((r) => r.json())
      .then((p: WeeklyPlan) => {
        // let the assembly moment breathe (min ~2.4s) — it's emotional, not just functional
        const wait = Math.max(0, 2400 - (Date.now() - started));
        setTimeout(() => { if (alive) { setPlan(p); setStep('reveal'); } }, wait);
      });
    return () => { alive = false; };
  }, [step, deferral, availability, household, kids, age]);

  const dotIndex = { q1: 0, q2: 1, q3: 2, q4: 3 } as const;

  return (
    <main className="ob-shell">
      {step === 'arrival' && <Arrival onNext={() => setStep('connect')} />}

      {step === 'connect' && <Connect onNext={() => setStep('reading')} onSkip={() => setStep('q1')} />}

      {step === 'reading' && <Reading onDone={() => setStep('q1')} />}

      {(step === 'q1' || step === 'q2' || step === 'q3' || step === 'q4') && (
        <QuestionLayout
          dot={dotIndex[step]}
          assembling={<Assembling deferral={deferral} availability={availability} household={household} kids={kids} />}
        >
          {step === 'q1' && (
            <Q1 value={deferral} onChange={setDeferral} onNext={() => setStep('q2')} />
          )}
          {step === 'q2' && (
            <Q2 value={availability} onPick={(v) => { setAvailability(v); setStep('q3'); }} />
          )}
          {step === 'q3' && (
            <Q3 value={household} onPick={(v) => { setHousehold(v); setStep('q4'); }} />
          )}
          {step === 'q4' && (
            <Q4
              kids={kids}
              onToggleKid={(k) => setKids((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))}
              age={age}
              onAge={setAge}
              canContinue={kids.length > 0 && Number(age) >= 18}
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
function Connect({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <section className="ob-card ob-connect">
      <h2 className="ob-h2">First, your calendar.</h2>
      <p className="ob-explain">We build your week from your actual schedule — not a template.</p>
      <p className="ob-trust">We read your calendar to build your plan. We never move or delete your events without asking.</p>
      <div className="ob-bottom">
        <button className="ob-cta" onClick={onNext}>
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
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    SAMPLE_EVENTS.forEach((_, i) => timers.push(setTimeout(() => setShown(i + 1), 350 * (i + 1))));
    timers.push(setTimeout(onDone, 350 * SAMPLE_EVENTS.length + 1400));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);
  return (
    <section className="ob-card ob-reading">
      <h2 className="ob-h2 reading">Reading your week…</h2>
      <div className="ob-events">
        {SAMPLE_EVENTS.slice(0, shown).map((e, i) => (
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
function QuestionLayout({ dot, assembling, children }: { dot: number; assembling: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ob-qwrap">
      <div className="ob-qmain">
        <div className="ob-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`ob-dot ${i === dot ? 'on' : ''} ${i < dot ? 'done' : ''}`} />
          ))}
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

function Q4({
  kids, onToggleKid, age, onAge, canContinue, onNext,
}: {
  kids: string[]; onToggleKid: (k: string) => void; age: string; onAge: (v: string) => void; canContinue: boolean; onNext: () => void;
}) {
  const chips = ['Under 2', '2–5', '6–11', '12–17'];
  return (
    <div className="ob-question">
      <h2 className="ob-q">How old are your kids?</h2>
      <div className="ob-chips">
        {chips.map((c) => (
          <button key={c} className={`ob-chip ${kids.includes(c) ? 'sel' : ''}`} onClick={() => onToggleKid(c)}>{c}</button>
        ))}
      </div>
      <div className="ob-subq">
        <label className="ob-sublabel">And how old are you?</label>
        <input className="ob-age" inputMode="numeric" value={age} onChange={(e) => onAge(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="38" />
      </div>
      <div className="ob-bottom">
        <button className="ob-cta" disabled={!canContinue} onClick={onNext}>Build my week</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------ the assembling preview */
function Assembling({ deferral, availability, household, kids }: {
  deferral: string; availability: Availability | null; household: Household | null; kids: string[];
}) {
  const items = useMemo(() => {
    const out: { label: string; sub: string; kind: 'prot' | 'ghost' }[] = [];
    if (deferral.trim()) out.push({ label: deferral.trim(), sub: 'held for you', kind: 'prot' });
    out.push({ label: 'Solo time', sub: 'held for you', kind: 'prot' });
    if (availability) out.push({ label: 'Your window', sub: AVAIL_LABEL[availability].toLowerCase(), kind: 'ghost' });
    if (kids.length) out.push({ label: 'Family logistics', sub: `${kids.join(', ').toLowerCase()} — arranged around you`, kind: 'ghost' });
    void household;
    return out;
  }, [deferral, availability, household, kids]);

  return (
    <div className="ob-assembling">
      <div className="ob-assembling-head">Your week, so far</div>
      {items.length === 0 && <div className="ob-assembling-empty">Watch it take shape as you answer.</div>}
      {items.map((it, i) => (
        <div key={i} className={`ob-slot ${it.kind}`}>
          <div className="ob-slot-lab">{it.label}</div>
          <div className="ob-slot-sub">{it.sub}</div>
        </div>
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
