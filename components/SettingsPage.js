'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings, DEFAULTS } from '@/lib/settings';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:       '#07070f',
  card:     '#0d0d1a',
  border:   '#1a1a2e',
  purple:   '#7c3aed',
  purpleL:  '#a855f7',
  muted:    '#50507a',
  text:     '#e8e8ff',
  textSub:  '#8888aa',
  green:    '#22c55e',
  red:      '#ef4444',
};

// ── Reusable primitives ────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? T.purple : '#1a1a2e',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: value ? '#fff' : T.muted,
        transition: 'left 0.2s, background 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: '#12122a', border: `1px solid ${T.border}`, borderRadius: 8,
        color: T.text, fontSize: 13, padding: '6px 28px 6px 10px',
        cursor: 'pointer', outline: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2350507a'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Row({ label, desc, children, stack }) {
  return (
    <div style={{
      display: 'flex', flexDirection: stack ? 'column' : 'row',
      alignItems: stack ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      padding: '14px 0', borderBottom: `1px solid ${T.border}`,
      gap: stack ? 10 : 0,
    }}>
      <div style={{ flex: 1, paddingRight: stack ? 0 : 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: T.purpleL, opacity: 0.8 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, padding: '0 18px' }}>
        {children}
      </div>
    </div>
  );
}

function ThresholdPicker({ value, onChange }) {
  const options = [
    { v: 1_000_000,   label: '$1M+' },
    { v: 5_000_000,   label: '$5M+' },
    { v: 10_000_000,  label: '$10M+' },
    { v: 25_000_000,  label: '$25M+' },
    { v: 50_000_000,  label: '$50M+' },
    { v: 100_000_000, label: '$100M+' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {options.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: `1px solid ${value === o.v ? T.purple : T.border}`,
            background: value === o.v ? `${T.purple}22` : 'transparent',
            color: value === o.v ? T.purpleL : T.muted,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

function SignalChips({ settings, set }) {
  const signals = [
    { key: 'whaleSig_inflow',   label: 'Inflow',    color: '#ef4444' },
    { key: 'whaleSig_outflow',  label: 'Outflow',   color: '#22c55e' },
    { key: 'whaleSig_exchange', label: 'Exchange',  color: '#f97316' },
    { key: 'whaleSig_transfer', label: 'Transfer',  color: '#a855f7' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {signals.map(s => {
        const on = settings[s.key];
        return (
          <button
            key={s.key}
            onClick={() => set(s.key, !on)}
            style={{
              padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1px solid ${on ? s.color + '60' : T.border}`,
              background: on ? s.color + '18' : 'transparent',
              color: on ? s.color : T.muted,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{s.label}</button>
        );
      })}
    </div>
  );
}

// ── Sidebar nav ────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'dashboard',     label: 'Dashboard',     icon: '⚡' },
  { id: 'whalewatch',    label: 'Whale Watch',   icon: '🐋' },
  { id: 'journal',       label: 'Journal',       icon: '📓' },
  { id: 'appearance',    label: 'Appearance',    icon: '🎨' },
  { id: 'account',       label: 'Account',       icon: '👤' },
];

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICON = {
  bell: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  dashboard: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  whale: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 16s1-1 4-1 4.5 2 7 2 4-1 4-1"/><path d="M2 16c0-4 2-7 6-8.5C10 6 11 4 11 2c1 1 2 3 2 5 2-1 4-1 5 0 2 1.5 3 4 3 6.5"/><path d="M22 16c0 2-1 3-3 4H5c-2-1-3-2-3-4"/></svg>,
  journal: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  palette: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
  user: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

const SECTION_ICONS = {
  notifications: ICON.bell,
  dashboard:     ICON.dashboard,
  whalewatch:    ICON.whale,
  journal:       ICON.journal,
  appearance:    ICON.palette,
  account:       ICON.user,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const [settings, set] = useSettings();
  const [active, setActive] = useState('notifications');
  const [saved, setSaved] = useState(false);

  // Flash "Saved" on any change
  useEffect(() => {
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
  }, [settings]);

  const handleReset = () => {
    if (!confirm('Reset all settings to defaults?')) return;
    Object.keys(DEFAULTS).forEach(k => set(k, DEFAULTS[k]));
  };

  const handleSignOut = () => {
    localStorage.removeItem('ll_auth');
    router.replace('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${T.border}`, padding: '18px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>Settings</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Preferences sync automatically</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontSize: 12, color: T.green, fontWeight: 600, opacity: saved ? 1 : 0,
            transition: 'opacity 0.3s',
          }}>✓ Saved</div>
          <button
            onClick={() => router.back()}
            style={{
              background: '#12122a', border: `1px solid ${T.border}`, borderRadius: 8,
              color: T.textSub, fontSize: 13, padding: '7px 14px', cursor: 'pointer',
            }}
          >← Back</button>
        </div>
      </div>

      <div style={{ display: 'flex', maxWidth: 900, margin: '0 auto', padding: '28px 24px', gap: 28 }}>

        {/* Sidebar */}
        <div style={{ width: 180, flexShrink: 0 }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '9px 12px', borderRadius: 9,
                background: active === s.id ? `${T.purple}22` : 'transparent',
                border: active === s.id ? `1px solid ${T.purple}44` : '1px solid transparent',
                color: active === s.id ? T.purpleL : T.muted,
                fontSize: 13, fontWeight: active === s.id ? 600 : 400,
                cursor: 'pointer', marginBottom: 3, textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ opacity: active === s.id ? 1 : 0.6 }}>{SECTION_ICONS[s.id]}</span>
              {s.label}
            </button>
          ))}

          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 12, paddingTop: 12 }}>
            <button
              onClick={handleReset}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 9,
                background: 'transparent', border: '1px solid transparent',
                color: T.muted, fontSize: 12, cursor: 'pointer', textAlign: 'left',
              }}
            >Reset to defaults</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>

          {/* ── Notifications ──────────────────────────────────────────────── */}
          {active === 'notifications' && (
            <>
              <Section title="Whale Alerts" icon={ICON.bell}>
                <Row
                  label="Alert sound"
                  desc="Play an audio cue when a whale transaction fires"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => {
                        try {
                          const ctx = new (window.AudioContext || window.webkitAudioContext)();
                          const master = ctx.createGain(); master.gain.value = 0.35;
                          const comp = ctx.createDynamicsCompressor();
                          comp.threshold.value = -4; comp.knee.value = 8; comp.ratio.value = 3;
                          comp.attack.value = 0.001; comp.release.value = 0.2;
                          master.connect(comp); comp.connect(ctx.destination);
                          const now = ctx.currentTime;
                          function impact(t, vol) {
                            const size = Math.floor(ctx.sampleRate * 0.035);
                            const buf = ctx.createBuffer(1, size, ctx.sampleRate);
                            const d = buf.getChannelData(0);
                            for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
                            const src = ctx.createBufferSource(); src.buffer = buf;
                            const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 4000;
                            const g = ctx.createGain();
                            g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
                            src.connect(hpf); hpf.connect(g); g.connect(master);
                            src.start(t); src.stop(t + 0.035);
                          }
                          function tone(freq, t, vol, decay) {
                            const o1 = ctx.createOscillator(), g1 = ctx.createGain();
                            o1.type = 'sine'; o1.frequency.value = freq;
                            g1.gain.setValueAtTime(0, t); g1.gain.linearRampToValueAtTime(vol, t + 0.007);
                            g1.gain.exponentialRampToValueAtTime(0.0001, t + decay);
                            o1.connect(g1); g1.connect(master); o1.start(t); o1.stop(t + decay + 0.05);
                            const o2 = ctx.createOscillator(), g2 = ctx.createGain();
                            o2.type = 'sine'; o2.frequency.value = freq * 2;
                            g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(vol * 0.09, t + 0.005);
                            g2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.22);
                            o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(t + decay * 0.22 + 0.05);
                          }
                          impact(now, 0.07); tone(1047, now, 0.40, 0.70);
                          impact(now + 0.13, 0.05); tone(784, now + 0.13, 0.30, 0.90);
                          setTimeout(() => ctx.close(), 2000);
                        } catch(_) {}
                      }}
                      style={{
                        fontSize: 11, color: T.muted, background: '#12122a',
                        border: `1px solid ${T.border}`, borderRadius: 7,
                        padding: '5px 10px', cursor: 'pointer',
                      }}
                    >▶ Preview</button>
                    <Toggle value={settings.whaleSound} onChange={v => set('whaleSound', v)} />
                  </div>
                </Row>
                <Row
                  label="Alert threshold"
                  desc="Only notify for transactions above this size"
                  stack
                >
                  <ThresholdPicker value={settings.whaleThreshold} onChange={v => set('whaleThreshold', v)} />
                </Row>
                <Row
                  label="Signal types"
                  desc="Which transaction types trigger an alert"
                  stack
                >
                  <SignalChips settings={settings} set={set} />
                </Row>
              </Section>
            </>
          )}

          {/* ── Dashboard ──────────────────────────────────────────────────── */}
          {active === 'dashboard' && (
            <>
              <Section title="Dashboard" icon={ICON.dashboard}>
                <Row
                  label="Default landing page"
                  desc="Where you land after logging in"
                >
                  <Select
                    value={settings.defaultPage}
                    onChange={v => set('defaultPage', v)}
                    options={[
                      { value: '/',           label: 'Dashboard' },
                      { value: '/markets',    label: 'Markets' },
                      { value: '/whale-watch', label: 'Whale Watch' },
                      { value: '/journal',    label: 'Trade Journal' },
                      { value: '/fear-greed', label: 'Fear & Greed' },
                    ]}
                  />
                </Row>
                <Row
                  label="Default chart timeframe"
                  desc="Starting timeframe on the BTC price chart"
                >
                  <Select
                    value={settings.defaultTimeframe}
                    onChange={v => set('defaultTimeframe', v)}
                    options={[
                      { value: '1D', label: '1 Day' },
                      { value: '1W', label: '1 Week' },
                      { value: '1M', label: '1 Month' },
                    ]}
                  />
                </Row>
                <Row
                  label="Default pair"
                  desc="Primary trading pair shown on dashboard"
                >
                  <Select
                    value={settings.defaultPair}
                    onChange={v => set('defaultPair', v)}
                    options={[
                      { value: 'BTC/USD',  label: 'BTC / USD' },
                      { value: 'ETH/USD',  label: 'ETH / USD' },
                      { value: 'BTC/USDT', label: 'BTC / USDT' },
                    ]}
                  />
                </Row>
              </Section>
            </>
          )}

          {/* ── Whale Watch ────────────────────────────────────────────────── */}
          {active === 'whalewatch' && (
            <>
              <Section title="Whale Watch" icon={ICON.whale}>
                <Row
                  label="Default blockchain"
                  desc="Filter applied when the page loads"
                >
                  <Select
                    value={settings.defaultChain}
                    onChange={v => set('defaultChain', v)}
                    options={[
                      { value: 'all', label: 'All chains' },
                      { value: 'bitcoin', label: 'Bitcoin' },
                      { value: 'ethereum', label: 'Ethereum' },
                      { value: 'tron', label: 'Tron' },
                      { value: 'solana', label: 'Solana' },
                    ]}
                  />
                </Row>
                <Row
                  label="Minimum tx size shown"
                  desc="Hide transactions below this threshold in the feed"
                >
                  <Select
                    value={String(settings.minTxDisplay)}
                    onChange={v => set('minTxDisplay', Number(v))}
                    options={[
                      { value: '500000',    label: '$500K+' },
                      { value: '1000000',   label: '$1M+' },
                      { value: '5000000',   label: '$5M+' },
                      { value: '10000000',  label: '$10M+' },
                      { value: '50000000',  label: '$50M+' },
                    ]}
                  />
                </Row>
              </Section>
            </>
          )}

          {/* ── Journal ────────────────────────────────────────────────────── */}
          {active === 'journal' && (
            <>
              <Section title="Trade Journal" icon={ICON.journal}>
                <Row
                  label="Default trade side"
                  desc="Pre-selected direction when adding a new trade"
                >
                  <Select
                    value={settings.defaultSide}
                    onChange={v => set('defaultSide', v)}
                    options={[
                      { value: 'long',    label: 'Long' },
                      { value: 'short',   label: 'Short' },
                      { value: 'neutral', label: 'Neutral' },
                    ]}
                  />
                </Row>
              </Section>
            </>
          )}

          {/* ── Appearance ─────────────────────────────────────────────────── */}
          {active === 'appearance' && (
            <>
              <Section title="Appearance" icon={ICON.palette}>
                <Row
                  label="Layout density"
                  desc="How compact the dashboard cards feel"
                >
                  <Select
                    value={settings.density}
                    onChange={v => set('density', v)}
                    options={[
                      { value: 'comfortable', label: 'Comfortable' },
                      { value: 'compact',     label: 'Compact' },
                    ]}
                  />
                </Row>
                <Row
                  label="Color theme"
                  desc="More themes coming soon"
                >
                  <div style={{
                    fontSize: 12, color: T.muted, background: '#12122a',
                    border: `1px solid ${T.border}`, borderRadius: 8,
                    padding: '6px 12px',
                  }}>Dark (default)</div>
                </Row>
              </Section>
            </>
          )}

          {/* ── Account ────────────────────────────────────────────────────── */}
          {active === 'account' && (
            <>
              <Section title="Account" icon={ICON.user}>
                <Row label="Plan" desc="Your current subscription">
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: T.purpleL,
                    background: `${T.purple}18`, border: `1px solid ${T.purple}40`,
                    borderRadius: 8, padding: '5px 12px',
                  }}>LabLogic Pro</div>
                </Row>
                <Row label="Billing" desc="Manage your subscription and invoices">
                  <button style={{
                    fontSize: 12, color: T.textSub,
                    background: '#12122a', border: `1px solid ${T.border}`,
                    borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  }}>Manage →</button>
                </Row>
              </Section>

              <Section title="Session" icon={ICON.user}>
                <Row label="Sign out" desc="End your current session">
                  <button
                    onClick={handleSignOut}
                    style={{
                      fontSize: 12, color: T.red,
                      background: `${T.red}10`, border: `1px solid ${T.red}30`,
                      borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                    }}
                  >Sign out</button>
                </Row>
              </Section>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
