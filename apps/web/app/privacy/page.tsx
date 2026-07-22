import Link from 'next/link';

export const metadata = {
  title: 'Privacy — Margia',
  description: 'What Margia accesses, why, and what it never does.',
};

export default function Privacy() {
  return (
    <main className="shell" style={{ maxWidth: 720 }}>
      <div className="topbar">
        <div className="wordmark">Margia<span className="dot">.</span></div>
        <Link className="chip-btn" href="/">Back</Link>
      </div>

      <div className="greeting">
        <div className="eyebrow">Privacy</div>
        <h1>What we touch, and what we never do.</h1>
        <p>Margia is a tool for protecting your time. That only works if you trust it with your calendar, so here is exactly what happens — in plain language.</p>
      </div>

      <div className="voice" style={{ display: 'flex', flexDirection: 'column', gap: 18, color: 'var(--color-text)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
        <section>
          <h2 className="voice" style={{ fontSize: 22 }}>What we access</h2>
          <p>With your permission, Margia reads the events on your Google Calendar. That is the only Google permission we ask for: <b>read-only access to your calendar events</b>. We use it to see the shape of your week so we can build a plan around you.</p>
        </section>
        <section>
          <h2 className="voice" style={{ fontSize: 22 }}>What we never do</h2>
          <p>We never create, move, edit, or delete anything on your calendar. We cannot — we never asked for permission to. We do not sell your data, show you ads, or share your information with anyone.</p>
        </section>
        <section>
          <h2 className="voice" style={{ fontSize: 22 }}>What we store</h2>
          <p>During this early testing phase, Margia keeps your Google connection in an encrypted cookie in your own browser — not in a database. Your calendar events are read to build your plan and are not stored on our servers.</p>
        </section>
        <section>
          <h2 className="voice" style={{ fontSize: 22 }}>Disconnecting</h2>
          <p>You can disconnect at any time by signing out of Margia, or by removing Margia's access from your Google Account under Security → Third-party access. The moment you do, we can no longer see your calendar.</p>
        </section>
        <section>
          <h2 className="voice" style={{ fontSize: 22 }}>Contact</h2>
          <p>This is an early product built by a small team. Questions or concerns: <b>louise060@gmail.com</b>.</p>
        </section>
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>This policy will grow more formal before Margia opens to the public. Last updated July 2026.</p>
      </div>
    </main>
  );
}
