'use client';

/**
 * Shared plan-rendering components. Used by both the standalone plan view and
 * the onboarding reveal. Pure presentation — renders what the engine returns.
 */

import { useMemo } from 'react';
import type { WeeklyPlan, ProtectedSlot, FlexibleEvent, TimeBlock } from '@margia/engine';

export const DAY_START = 6 * 60;
export const DAY_END = 21.5 * 60;
export const PX_PER_MIN = 0.64;
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

export function Week({ plan, heroDay = 0 }: { plan: WeeklyPlan; heroDay?: number }) {
  const trackH = (DAY_END - DAY_START) * PX_PER_MIN;
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let hmin = DAY_START; hmin <= DAY_END; hmin += 60) out.push(hmin);
    return out;
  }, []);

  const coruns = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of plan.flexible) {
      if (e.is_background_process && e.co_running_with.length) {
        for (const anchorId of e.co_running_with) m.set(anchorId, [...(m.get(anchorId) ?? []), e.label]);
      }
    }
    return m;
  }, [plan]);

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
              <div className="ddate">{`Jul ${20 + d}`}</div>
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
    </section>
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
      <p className="section-label">One thing worth booking</p>
      <div className="nudge">
        <div className="mark">✚</div>
        <div className="body">
          <p className="copy">{nudge.copy}</p>
          <div className="cite">
            Based on <b>{nudge.guideline_source}</b>. You decide — I just keep it on the radar.
          </div>
          <div className="actions">
            <button className="btn primary">Book {nudge.offeredSlotLabel}</button>
            <button className="btn ghost">Not this week</button>
          </div>
        </div>
      </div>
    </section>
  );
}
