'use client';

/**
 * Shared plan-rendering components. Used by both the standalone plan view and
 * the onboarding reveal. Pure presentation — renders what the engine returns.
 *
 * Responsive by design (Sofia's rule — one component set, two containers):
 *  - MOBILE (<768px): a vertical day-stacked AGENDA + a sticky week-shape ribbon.
 *    She scrolls DOWN through her week (the one gesture a thumb owns) — no side-scroll.
 *  - DESKTOP (>=768px): the 7-column time grid.
 * Both render the SAME chips from the SAME tokens.
 */

import { useMemo } from 'react';
import type { WeeklyPlan, ProtectedSlot, FlexibleEvent, TimeBlock } from '@margia/engine';

export const DAY_START = 6 * 60;
export const DAY_END = 21.5 * 60;
export const PX_PER_MIN = 0.64;
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_INITIAL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The 7 calendar dates of the plan's week, from its weekStartISO (Mon..Sun). */
export function weekDates(weekStartISO: string) {
  const [y, m, d] = weekStartISO.split('-').map(Number);
  const base = Date.UTC(y || 2026, (m || 1) - 1, d || 1);
  return Array.from({ length: 7 }, (_, i) => {
    const t = new Date(base + i * 86400000);
    return { mon: MONTHS[t.getUTCMonth()], day: t.getUTCDate() };
  });
}

export function y(min: number) {
  return (min - DAY_START) * PX_PER_MIN;
}
export function fmt(min: number) {
  const hh = Math.floor(min / 60);
  const m = min % 60;
  const ap = hh < 12 ? 'am' : 'pm';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}
function blockStyle(b: TimeBlock): React.CSSProperties {
  return { top: y(b.start), height: Math.max(26, (b.end - b.start) * PX_PER_MIN - 4) };
}

const KIND_LABEL: Record<string, string> = {
  MOVEMENT: 'movement',
  THERAPY: 'therapy',
  CHECKUP: 'check-up',
  SCREENING: 'screening',
  SOLO: 'solo',
  SLEEP: 'sleep',
  DEFERRAL: 'yours',
};

export function ChoreographyNote({ plan }: { plan: WeeklyPlan }) {
  if (!plan.surfacedMove) return null;
  const emphasized = plan.surfacedMove.reason.replace(/(run under [^,]+)/i, '<em>$1</em>');
  return (
    <section className="choreo" aria-label="This week’s one move">
      <div className="kicker"><span className="wink">✦</span> one move, so you don’t have to</div>
      <p className="reason" dangerouslySetInnerHTML={{ __html: emphasized }} />
      <div className="metrics">
        <div className="metric">
          <div className="n num">{plan.marginMinutes} min</div>
          <div className="l">of evening cleared this week</div>
        </div>
        <div className="metric">
          <div className="n num">{plan.protected.filter((s) => s.placement).length}</div>
          <div className="l">of your things placed first</div>
        </div>
      </div>
    </section>
  );
}

/** Which weekdays (0..6) hold a placed protected slot — drives the ribbon dots. */
function protectedDays(plan: WeeklyPlan): Set<number> {
  const s = new Set<number>();
  for (const p of plan.protected) if (p.placement) s.add(p.placement.day);
  return s;
}

/** Map of anchorId -> labels of backgrounds choreographed under it. */
function coRunMap(plan: WeeklyPlan): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of plan.flexible) {
    if (e.is_background_process && e.co_running_with.length) {
      for (const anchorId of e.co_running_with) m.set(anchorId, [...(m.get(anchorId) ?? []), e.label]);
    }
  }
  return m;
}

export function Week({ plan, heroDay = 0 }: { plan: WeeklyPlan; heroDay?: number }) {
  const protDays = useMemo(() => protectedDays(plan), [plan]);
  const coruns = useMemo(() => coRunMap(plan), [plan]);

  return (
    <section className="weekwrap" aria-label="Your week">
      <div className="weekhead">
        <div className="title">The week that has you in it</div>
        <div className="legend">
          <span className="sw"><span className="swatch prot" /> Protected — held for you</span>
          <span className="sw"><span className="swatch flex" /> Flexible — moves around you</span>
          <span className="sw"><span className="swatch held" /> Held open — on purpose</span>
        </div>
      </div>

      <WeekRibbon plan={plan} protDays={protDays} heroDay={heroDay} />

      {/* MOBILE: vertical agenda */}
      <div className="week-mobile">
        <MobileAgenda plan={plan} coruns={coruns} heroDay={heroDay} />
      </div>

      {/* DESKTOP: time grid */}
      <div className="week-desktop">
        <DesktopGrid plan={plan} coruns={coruns} heroDay={heroDay} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- the week ribbon */
function WeekRibbon({ plan, protDays, heroDay }: { plan: WeeklyPlan; protDays: Set<number>; heroDay: number }) {
  const dates = weekDates(plan.weekStartISO);
  return (
    <div className="wribbon" role="list" aria-label="Your week at a glance">
      {DAY_INITIAL.map((ini, d) => (
       <a 
          key={d}
          role="listitem"
          href={`#day-${d}`}
          className={`wpill ${d === heroDay ? 'today' : ''}`}
          aria-label={`${DAY_NAMES_FULL[d]}${protDays.has(d) ? ' — you have protected time' : ''}`}
        >
          <span className="wpill-d">{ini}</span>
          <span className="wpill-n num">{dates[d].day}</span>
          {protDays.has(d) && <span className="wpill-dot" aria-hidden="true" />}
        </a>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- mobile agenda */
type AgendaItem =
  | { kind: 'prot'; start: number; slot: ProtectedSlot }
  | { kind: 'flex'; start: number; ev: FlexibleEvent; corun?: string[] }
  | { kind: 'held'; start: number; block: TimeBlock };

function MobileAgenda({ plan, coruns, heroDay }: { plan: WeeklyPlan; coruns: Map<string, string[]>; heroDay: number }) {
  const dates = weekDates(plan.weekStartISO);
  const byDay = useMemo(() => {
    const days: AgendaItem[][] = [[], [], [], [], [], [], []];
    for (const s of plan.protected) {
      if (s.placement) days[s.placement.day].push({ kind: 'prot', start: s.placement.start, slot: s });
    }
    for (const e of plan.flexible) {
      if (e.placement && !e.is_background_process && e.kind === 'IMPORTED') {
        days[e.placement.day].push({ kind: 'flex', start: e.placement.start, ev: e, corun: coruns.get(e.id) });
      }
    }
    if (plan.surfacedMove) {
      const fb = plan.surfacedMove.freedBlock;
      days[fb.day].push({ kind: 'held', start: fb.start, block: fb });
    }
    days.forEach((d) => d.sort((a, b) => a.start - b.start));
    return days;
  }, [plan, coruns]);

  return (
    <div className="agenda">
      {DAY_NAMES_FULL.map((dn, d) => {
        const items = byDay[d];
        const empty = items.length === 0;
        return (
          <section key={d} id={`day-${d}`} className={`aday ${d === heroDay ? 'today' : ''}`}>
            <header className="aday-head">
              <span className="aday-name">{dn}</span>
              <span className="aday-date num">{dates[d].mon} {dates[d].day}</span>
            </header>
            {empty ? (
              <p className="aday-empty">A clear day.</p>
            ) : (
              <div className="aday-items">
                {items.map((it, i) => {
                  if (it.kind === 'prot') return <MProt key={`p${i}`} slot={it.slot} />;
                  if (it.kind === 'held') return <MHeld key={`h${i}`} block={it.block} />;
                  return <MFlex key={`f${i}`} ev={it.ev} corun={it.corun} />;
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MProt({ slot }: { slot: ProtectedSlot }) {
  const b = slot.placement!;
  return (
    <div className="arow prot">
      <div className="arow-time num">{fmt(b.start)}</div>
      <div className="arow-body">
        <div className="arow-lab">{slot.label}</div>
        <div className="arow-sub">{fmt(b.start)}–{fmt(b.end)} · {KIND_LABEL[slot.type] ?? 'yours'}{slot.hasMargin ? ' · in your margin' : ''}</div>
      </div>
    </div>
  );
}

function MFlex({ ev, corun }: { ev: FlexibleEvent; corun?: string[] }) {
  const b = ev.placement!;
  return (
    <div className="arow flex">
      <div className="arow-time num">{fmt(b.start)}</div>
      <div className="arow-body">
        <div className="arow-lab">
          {ev.originColor && <span className="origin" style={{ background: ev.originColor }} />}
          {ev.label}
        </div>
        {corun && corun.length > 0 && (
          <div className="corun"><span className="spin">⟳</span> {corun.join(' + ').toLowerCase()} running under</div>
        )}
      </div>
    </div>
  );
}

function MHeld({ block }: { block: TimeBlock }) {
  return (
    <div className="arow held">
      <div className="arow-time num">{fmt(block.start)}</div>
      <div className="arow-body">
        <div className="arow-lab held-lab">held open · yours</div>
        <div className="arow-sub">{fmt(block.start)}–{fmt(block.end)} · on purpose</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- desktop grid */
function DesktopGrid({ plan, coruns, heroDay }: { plan: WeeklyPlan; coruns: Map<string, string[]>; heroDay: number }) {
  const dates = weekDates(plan.weekStartISO);
  const trackH = (DAY_END - DAY_START) * PX_PER_MIN;
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let hmin = DAY_START; hmin <= DAY_END; hmin += 60) out.push(hmin);
    return out;
  }, []);

  return (
    <div className="grid">
      <div className="axis" style={{ height: trackH + 34, paddingTop: 34 }}>
        {hours.map((hmin) => (
          <div key={hmin} className="hr" style={{ top: 34 + y(hmin) }}>{fmt(hmin)}</div>
        ))}
      </div>

      {DAY_NAMES.map((dn, d) => {
        const prot = plan.protected.filter((s) => s.placement && s.placement.day === d);
        const flex = plan.flexible.filter(
          (e) => e.placement && e.placement.day === d && !e.is_background_process && e.kind === 'IMPORTED',
        );
        const held = plan.surfacedMove && plan.surfacedMove.freedBlock.day === d ? plan.surfacedMove.freedBlock : null;
        return (
          <div key={dn} className="daycol">
            <div className={`dname ${d === heroDay ? 'today' : ''}`}>{dn}</div>
            <div className="ddate">{`${dates[d].mon} ${dates[d].day}`}</div>
            <div className="track" style={{ height: trackH }}>
              {hours.map((hmin) => (
                <div key={hmin} className="line" style={{ top: y(hmin) }} />
              ))}
              {held && (
                <div className="block held" style={blockStyle(held)}>
                  <div className="lab">held open · yours</div>
                </div>
              )}
              {flex.map((e) => (
                <FlexBlock key={e.id} ev={e} corun={coruns.get(e.id)} />
              ))}
              {prot.map((s) => (
                <ProtBlock key={s.id} slot={s} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProtBlock({ slot }: { slot: ProtectedSlot }) {
  const b = slot.placement!;
  return (
    <div className="block prot" style={blockStyle(b)} title={slot.label}>
      <div className="lab">{slot.label}</div>
      <div className="tm num">{fmt(b.start)}–{fmt(b.end)}</div>
      <div className="kind">{KIND_LABEL[slot.type] ?? ''}{slot.hasMargin ? ' · in your margin' : ''}</div>
    </div>
  );
}

function FlexBlock({ ev, corun }: { ev: FlexibleEvent; corun?: string[] }) {
  const b = ev.placement!;
  const short = (b.end - b.start) * PX_PER_MIN < 40;
  return (
    <div className="block flex" style={blockStyle(b)} title={ev.label}>
      {ev.originColor && <span className="origin" style={{ background: ev.originColor }} />}
      <div className="lab">{ev.label}</div>
      {!short && <div className="tm num">{fmt(b.start)}–{fmt(b.end)}</div>}
      {corun && corun.length > 0 && (
        <div className="corun"><span className="spin">⟳</span> {corun.join(' + ').toLowerCase()} running under</div>
      )}
    </div>
  );
}

export function HealthNudge({ nudge }: { nudge: NonNullable<WeeklyPlan['healthNudge']> }) {
  return (
    <section style={{ marginTop: 24 }} aria-label="A quiet health note">
      <p className="section-label">One thing worth keeping in view</p>
      <div className="nudge">
        <div className="mark">✚</div>
        <div className="body">
          <p className="copy">{nudge.copy}</p>
          <div className="cite">
            Based on <b>{nudge.guideline_source}</b>. Entirely your call — I’m just keeping it in view.
          </div>
          <div className="actions">
            <button className="btn primary">Find me time to call</button>
            <button className="btn ghost">Remind me later</button>
          </div>
        </div>
      </div>
    </section>
  );
}
