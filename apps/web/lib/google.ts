/**
 * Google Calendar — read-only integration.
 *
 * The only scope we ask for is calendar.events.readonly. We NEVER write to her
 * calendar (that promise is kept here, in the scope, not just in copy). This
 * module: builds the consent URL, exchanges the code for tokens, refreshes them,
 * fetches the current week's events, and maps them into the engine's shape.
 */
import { classify } from '@margia/engine';
import type { Weekday } from '@margia/engine';
import type { Session } from './session';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';

export function appUrl(): string {
  return (process.env.APP_URL || 'https://margia.vercel.app').replace(/\/$/, '');
}
export function redirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`;
}
function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID || '';
}
function clientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || '';
}
export function isConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

/** The Google consent URL. access_type=offline + prompt=consent → we get a refresh token. */
export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `${AUTH_ENDPOINT}?${p.toString()}`;
}

export async function exchangeCode(code: string): Promise<Session> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
  });
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`token exchange failed: ${r.status} ${await r.text()}`);
  const t = (await r.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expiry: Date.now() + (t.expires_in - 60) * 1000,
  };
}

async function refresh(session: Session): Promise<Session> {
  if (!session.refresh_token) return session;
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: session.refresh_token,
    grant_type: 'refresh_token',
  });
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`token refresh failed: ${r.status}`);
  const t = (await r.json()) as { access_token: string; expires_in: number };
  return { ...session, access_token: t.access_token, expiry: Date.now() + (t.expires_in - 60) * 1000 };
}

/** Return a valid access token, refreshing if expired. Reports whether it changed. */
export async function getAccessToken(session: Session): Promise<{ token: string; session: Session; refreshed: boolean }> {
  if (Date.now() < session.expiry) return { token: session.access_token, session, refreshed: false };
  const next = await refresh(session);
  return { token: next.access_token, session: next, refreshed: true };
}

// ---------------------------------------------------------------------------
// Week math (timezone-aware, no external libs)
// ---------------------------------------------------------------------------

const DEFAULT_TZ = process.env.APP_TZ || 'Asia/Jerusalem';
const WD: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function partsInTz(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(date)) p[part.type] = part.value;
  const hh = p.hour === '24' ? 0 : Number(p.hour);
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), hh, mi: Number(p.minute), wd: WD[p.weekday] ?? 0 };
}
function ymd(y: number, mo: number, d: number) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function addDays(y: number, mo: number, d: number, delta: number) {
  const t = new Date(Date.UTC(y, mo - 1, d));
  t.setUTCDate(t.getUTCDate() + delta);
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Monday (ISO date) of the current week, and the 7 date strings Mon..Sun, in tz. */
export function currentWeek(tz: string = DEFAULT_TZ) {
  const now = partsInTz(new Date(), tz);
  const mon = addDays(now.y, now.mo, now.d, -now.wd);
  const monISO = ymd(mon.y, mon.mo, mon.d);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = addDays(mon.y, mon.mo, mon.d, i);
    dates.push(ymd(dd.y, dd.mo, dd.d));
  }
  return { weekStartISO: monISO, dates, tz };
}

interface GEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
}

/** Fetch this week's timed events from her primary calendar. */
export async function fetchWeekEvents(token: string, tz: string = DEFAULT_TZ) {
  const { weekStartISO, dates } = currentWeek(tz);
  // Over-fetch a day on each side (tz offset); we filter precisely by tz-date below.
  const timeMin = new Date(Date.parse(weekStartISO + 'T00:00:00Z') - 86400000).toISOString();
  const timeMax = new Date(Date.parse(weekStartISO + 'T00:00:00Z') + 8 * 86400000).toISOString();
  const url =
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
    new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`calendar fetch failed: ${r.status}`);
  const data = (await r.json()) as { items?: GEvent[]; timeZone?: string };
  const calTz = data.timeZone || tz;
  const dateSet = new Map(dates.map((d, i) => [d, i] as const));

  const imported: Array<{ id: string; label: string; kind: 'IMPORTED'; duration_minutes: number; movable: false; fixed: { day: Weekday; start: number; end: number } }> = [];
  const preview: Array<{ label: string; dayName: string; start: number }> = [];
  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (const ev of data.items || []) {
    if (ev.status === 'cancelled') continue;
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue; // skip all-day
    const s = partsInTz(new Date(ev.start.dateTime), calTz);
    const e = partsInTz(new Date(ev.end.dateTime), calTz);
    const dayIdx = dateSet.get(ymd(s.y, s.mo, s.d));
    if (dayIdx === undefined) continue; // not in this tz-week
    let startMin = s.hh * 60 + s.mi;
    let endMin = e.hh * 60 + e.mi;
    if (ymd(e.y, e.mo, e.d) !== ymd(s.y, s.mo, s.d) || endMin <= startMin) endMin = Math.min(1439, startMin + 60);
    const label = (ev.summary || 'Busy').trim();
    imported.push({
      id: `gcal-${dayIdx}-${startMin}-${imported.length}`,
      label,
      kind: 'IMPORTED',
      duration_minutes: endMin - startMin,
      movable: false,
      fixed: { day: dayIdx as Weekday, start: startMin, end: endMin },
    });
    preview.push({ label, dayName: DAY_SHORT[dayIdx], start: startMin });
  }

  // Let the engine's classifier seed attention_cost / channels from each label.
  const flexible = imported.map((e) => classify(e));
  preview.sort((a, b) => a.start - b.start);
  return { weekStartISO, flexible, preview };
}
