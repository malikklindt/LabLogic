'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings, DEFAULTS, applyTheme } from '@/lib/settings';

const T = {
  bg:      'var(--card)',
  card:    'var(--card2)',
  border:  'var(--border)',
  purple:  'var(--purple-deep)',
  purpleL: 'var(--purple)',
  muted:   'var(--muted3)',
  text:    'var(--text2)',
  textSub: 'var(--muted)',
  green:   'var(--green)',
  red:     'var(--red)',
};

// ── Primitives ────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? T.purple : 'var(--border)',
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
        background: 'var(--card3)', border: `1px solid ${T.border}`, borderRadius: 8,
        color: T.text, fontSize: 13, padding: '6px 28px 6px 10px',
        cursor: 'pointer', outline: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2350507a'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Row({ label, desc, children, stack }) {
  return (
    <div style={{
      display: 'flex', flexDirection: stack ? 'column' : 'row',
      alignItems: stack ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      padding: '13px 0', borderBottom: `1px solid ${T.border}`,
      gap: stack ? 8 : 0,
    }}>
      <div style={{ minWidth: 0, flex: 1, paddingRight: stack ? 0 : 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, maxWidth: '100%' }}>{children}</div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ color: T.purpleL, opacity: 0.8 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: '0 16px' }}>
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
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: '100%' }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          padding: '5px 11px', borderRadius: 7, fontSize: 11, fontWeight: 600,
          border: `1px solid ${value === o.v ? T.purple : T.border}`,
          background: value === o.v ? `${T.purple}22` : 'transparent',
          color: value === o.v ? T.purpleL : T.muted,
          cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function SignalChips({ settings, set }) {
  const signals = [
    { key: 'whaleSig_inflow',   label: 'Inflow',   color: '#ef4444' },
    { key: 'whaleSig_outflow',  label: 'Outflow',  color: '#22c55e' },
    { key: 'whaleSig_exchange', label: 'Exchange', color: '#f97316' },
    { key: 'whaleSig_transfer', label: 'Transfer', color: '#a855f7' },
  ];
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {signals.map(s => {
        const on = settings[s.key];
        return (
          <button key={s.key} onClick={() => set(s.key, !on)} style={{
            padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            border: `1px solid ${on ? s.color + '60' : T.border}`,
            background: on ? s.color + '18' : 'transparent',
            color: on ? s.color : T.muted,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>{s.label}</button>
        );
      })}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICON = {
  bell:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  dash:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  whale:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 16s1-1 4-1 4.5 2 7 2 4-1 4-1"/><path d="M2 16c0-4 2-7 6-8.5C10 6 11 4 11 2c1 1 2 3 2 5 2-1 4-1 5 0 2 1.5 3 4 3 6.5"/><path d="M22 16c0 2-1 3-3 4H5c-2-1-3-2-3-4"/></svg>,
  journal: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  palette: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
  user:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

const SECTIONS = [
  { id: 'notifications', label: 'Notifications', icon: ICON.bell },
  { id: 'dashboard',     label: 'Dashboard',     icon: ICON.dash },
  { id: 'whalewatch',    label: 'Whale Watch',   icon: ICON.whale },
  { id: 'journal',       label: 'Journal',       icon: ICON.journal },
  { id: 'appearance',    label: 'Appearance',    icon: ICON.palette },
  { id: 'account',       label: 'Account',       icon: ICON.user },
];

// ── Modal ────────────────────────────────────────────────────────────────────
export default function SettingsModal() {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [closing, setClosing] = useState(false);
  const [active, setActive]   = useState('notifications');
  const [settings, set]       = useSettings();
  const [saved, setSaved]     = useState(false);

  // Listen for open event from anywhere
  useEffect(() => {
    const handler = () => { setClosing(false); setOpen(true); };
    window.addEventListener('ll_open_settings', handler);
    return () => window.removeEventListener('ll_open_settings', handler);
  }, []);

  // Flash saved indicator on any change
  useEffect(() => {
    if (!open) return;
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
  }, [settings]);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 200);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  const handleSignOut = () => {
    localStorage.removeItem('ll_auth');
    close();
    router.replace('/login');
  };

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes smOverlayIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes smOverlayOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes smCardIn     { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes smCardOut    { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.96) translateY(12px); } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 8000,
          background: 'rgba(4, 4, 12, 0.75)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: `${closing ? 'smOverlayOut' : 'smOverlayIn'} 200ms ease both`,
        }}
      />

      {/* Card */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 8001,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          className="sm-card"
          onClick={e => e.stopPropagation()}
          style={{
            width: '90vw', maxWidth: 820,
            maxHeight: '82vh',
            background: 'var(--bg2)',
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.08)',
            display: 'flex', flexDirection: 'column',
            pointerEvents: 'all',
            animation: `${closing ? 'smCardOut' : 'smCardIn'} 220ms cubic-bezier(0.22,1,0.36,1) both`,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 22px 16px',
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, letterSpacing: -0.4 }}>Settings</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>Preferences save automatically</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontSize: 11, color: T.green, fontWeight: 600,
                opacity: saved ? 1 : 0, transition: 'opacity 0.3s',
              }}>✓ Saved</span>
              <button
                onClick={close}
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'var(--card-hover)', border: `1px solid ${T.border}`,
                  color: T.muted, fontSize: 18, lineHeight: 1,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* Sidebar */}
            <div style={{
              width: 168, flexShrink: 0,
              borderRight: `1px solid ${T.border}`,
              padding: '14px 10px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div>
                {SECTIONS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      background: active === s.id ? `${T.purple}22` : 'transparent',
                      border: active === s.id ? `1px solid ${T.purple}44` : '1px solid transparent',
                      color: active === s.id ? T.purpleL : T.muted,
                      fontSize: 12, fontWeight: active === s.id ? 600 : 400,
                      cursor: 'pointer', marginBottom: 2, textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ opacity: active === s.id ? 1 : 0.6 }}>{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { if (confirm('Reset all settings to defaults?')) Object.keys(DEFAULTS).forEach(k => set(k, DEFAULTS[k])); }}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 8,
                  background: 'transparent', border: '1px solid transparent',
                  color: T.muted, fontSize: 11, cursor: 'pointer', textAlign: 'left',
                }}
              >Reset to defaults</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

              {active === 'notifications' && (
                <Section title="Whale Alerts" icon={ICON.bell}>
                  <Row label="Alert sound" desc="Play an audio cue when a whale transaction fires" stack>
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
                          fontSize: 11, color: T.muted, background: 'var(--card3)',
                          border: `1px solid ${T.border}`, borderRadius: 7,
                          padding: '4px 9px', cursor: 'pointer',
                        }}
                      >▶ Preview</button>
                      <Toggle value={settings.whaleSound} onChange={v => set('whaleSound', v)} />
                    </div>
                  </Row>
                  <Row label="Alert threshold" desc="Only notify for transactions above this size" stack>
                    <ThresholdPicker value={settings.whaleThreshold} onChange={v => set('whaleThreshold', v)} />
                  </Row>
                  <Row label="Signal types" desc="Which transaction types trigger an alert" stack>
                    <SignalChips settings={settings} set={set} />
                  </Row>
                </Section>
              )}

              {active === 'dashboard' && (
                <Section title="Dashboard" icon={ICON.dash}>
                  <Row label="Default landing page" desc="Where you land after logging in">
                    <Select value={settings.defaultPage} onChange={v => set('defaultPage', v)} options={[
                      { value: '/',            label: 'Dashboard' },
                      { value: '/markets',     label: 'Markets' },
                      { value: '/whale-watch', label: 'Whale Watch' },
                      { value: '/journal',     label: 'Trade Journal' },
                      { value: '/fear-greed',  label: 'Fear & Greed' },
                    ]} />
                  </Row>
                  <Row label="Default chart timeframe" desc="Starting timeframe on the BTC price chart">
                    <Select value={settings.defaultTimeframe} onChange={v => set('defaultTimeframe', v)} options={[
                      { value: '1D', label: '1 Day' },
                      { value: '1W', label: '1 Week' },
                      { value: '1M', label: '1 Month' },
                    ]} />
                  </Row>
                  <Row label="Default pair" desc="Primary trading pair shown on dashboard">
                    <Select value={settings.defaultPair} onChange={v => set('defaultPair', v)} options={[
                      { value: 'BTC/USD',  label: 'BTC / USD' },
                      { value: 'ETH/USD',  label: 'ETH / USD' },
                      { value: 'BTC/USDT', label: 'BTC / USDT' },
                    ]} />
                  </Row>
                </Section>
              )}

              {active === 'whalewatch' && (
                <Section title="Whale Watch" icon={ICON.whale}>
                  <Row label="Default blockchain" desc="Filter applied when the page loads">
                    <Select value={settings.defaultChain} onChange={v => set('defaultChain', v)} options={[
                      { value: 'all',      label: 'All chains' },
                      { value: 'bitcoin',  label: 'Bitcoin' },
                      { value: 'ethereum', label: 'Ethereum' },
                      { value: 'tron',     label: 'Tron' },
                      { value: 'solana',   label: 'Solana' },
                    ]} />
                  </Row>
                  <Row label="Minimum tx size shown" desc="Hide transactions below this threshold in the feed">
                    <Select value={String(settings.minTxDisplay)} onChange={v => set('minTxDisplay', Number(v))} options={[
                      { value: '500000',   label: '$500K+' },
                      { value: '1000000',  label: '$1M+' },
                      { value: '5000000',  label: '$5M+' },
                      { value: '10000000', label: '$10M+' },
                      { value: '50000000', label: '$50M+' },
                    ]} />
                  </Row>
                </Section>
              )}

              {active === 'journal' && (
                <Section title="Trade Journal" icon={ICON.journal}>
                  <Row label="Default trade side" desc="Pre-selected direction when adding a new trade">
                    <Select value={settings.defaultSide} onChange={v => set('defaultSide', v)} options={[
                      { value: 'long',    label: 'Long' },
                      { value: 'short',   label: 'Short' },
                      { value: 'neutral', label: 'Neutral' },
                    ]} />
                  </Row>
                </Section>
              )}

              {active === 'appearance' && (
                <Section title="Appearance" icon={ICON.palette}>
                  <Row label="Layout density" desc="How compact the dashboard cards feel">
                    <Select value={settings.density} onChange={v => set('density', v)} options={[
                      { value: 'comfortable', label: 'Comfortable' },
                      { value: 'compact',     label: 'Compact' },
                    ]} />
                  </Row>
                  <Row label="Color theme" desc="Switch between dark and light mode">
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['dark', 'light'].map(t => (
                        <button key={t} onClick={() => { set('theme', t); applyTheme(t); }} style={{
                          fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                          padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
                          fontFamily: 'Inter', transition: 'all 0.15s',
                          background: settings.theme === t ? `${T.purple}25` : '#12122a',
                          border: `1px solid ${settings.theme === t ? T.purple + '60' : T.border}`,
                          color: settings.theme === t ? T.purpleL : T.muted,
                        }}>{t === 'dark' ? '🌙 Dark' : '☀️ Light'}</button>
                      ))}
                    </div>
                  </Row>
                </Section>
              )}

              {active === 'account' && (
                <>
                  <Section title="Account" icon={ICON.user}>
                    <Row label="Plan" desc="Your current subscription">
                      <div style={{
                        fontSize: 12, fontWeight: 700, color: T.purpleL,
                        background: `${T.purple}18`, border: `1px solid ${T.purple}40`,
                        borderRadius: 8, padding: '4px 12px',
                      }}>LabLogic Pro</div>
                    </Row>
                    <Row label="Billing" desc="Manage your subscription and invoices">
                      <button style={{
                        fontSize: 12, color: T.textSub, background: 'var(--card3)',
                        border: `1px solid ${T.border}`, borderRadius: 8,
                        padding: '5px 12px', cursor: 'pointer',
                      }}>Manage →</button>
                    </Row>
                  </Section>
                  <Section title="Session" icon={ICON.user}>
                    <Row label="Sign out" desc="End your current session">
                      <button onClick={handleSignOut} style={{
                        fontSize: 12, color: T.red, background: `${T.red}10`,
                        border: `1px solid ${T.red}30`, borderRadius: 8,
                        padding: '5px 12px', cursor: 'pointer',
                      }}>Sign out</button>
                    </Row>
                  </Section>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
