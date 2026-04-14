'use client';
import { useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ── LabLogic Flask Logo ────────────────────────────────────────────────────────
function FlaskLogo({ size = 36, color = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rim / cap */}
      <rect x="28" y="2" width="24" height="8" rx="3" stroke={color} strokeWidth="4" fill="none"/>
      {/* Flask body — neck + triangular body + rounded bottom */}
      <path d="M32 10 L32 30 L8 78 Q4 86 14 86 L66 86 Q76 86 72 78 L48 30 L48 10"
        stroke={color} strokeWidth="4" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Liquid wave line */}
      <path d="M14 72 Q28 66 40 72 Q52 78 66 72"
        stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      {/* Bubbles */}
      <circle cx="38" cy="44" r="3" stroke={color} strokeWidth="2.5" fill="none"/>
      <circle cx="46" cy="54" r="4.5" stroke={color} strokeWidth="2.5" fill="none"/>
      <circle cx="36" cy="60" r="2.5" stroke={color} strokeWidth="2" fill="none"/>
    </svg>
  );
}

// ── Nav Icons ─────────────────────────────────────────────────────────────────
const ICONS = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  feargreed: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  ),
  journal: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/>
    </svg>
  ),
  charts: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  portfolio: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  scanner: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/>
    </svg>
  ),
  alerts: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  whale: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 16s1-1 4-1 4.5 2 7 2 4-1 4-1"/>
      <path d="M2 16c0-4 2-7 6-8.5C10 6 11 4 11 2c1 1 2 3 2 5 2-1 4-1 5 0 2 1.5 3 4 3 6.5"/>
      <path d="M22 16c0 2-1 3-3 4H5c-2-1-3-2-3-4"/>
    </svg>
  ),
  markets: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  funding: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
};

const NAV = [
  {
    title: null,
    items: [
      { icon: ICONS.dashboard, label: 'Dashboard',     href: '/',           soon: false },
    ],
  },
  {
    title: 'Markets',
    items: [
      { icon: ICONS.markets,   label: 'Markets',       href: '/markets',    soon: false },
      { icon: ICONS.feargreed, label: 'Fear & Greed',  href: '/fear-greed', soon: false },
      { icon: ICONS.whale,     label: 'Whale Watch',   href: '/whale-watch', soon: false },
      { icon: ICONS.funding,   label: 'Funding Rates', href: '/funding',     soon: false },
    ],
  },
  {
    title: 'Trading',
    items: [
      { icon: ICONS.journal,   label: 'Trade Journal',  href: '/journal', soon: false },
    ],
  },
];

function ChevronLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export default function RightSidebar() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const router   = useRouter();
  const pathname = usePathname();

  const handleMouseEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  const navigate = (href) => {
    if (!href) return;
    setOpen(false);
    router.push(href);
  };

  // Hide entirely on the login/landing page
  if (pathname === '/login') return null;

  return (
<>
      {open && <div className="sb-overlay" onClick={() => setOpen(false)} />}

      <div
        className={`sb-panel${open ? ' sb-open' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button className="sb-tab" aria-label="Toggle LabLogic sidebar">
          <FlaskLogo size={18} />
          <span className="sb-tab-arrow">{open ? <ChevronLeft /> : <ChevronRight />}</span>
        </button>

        <div className="sb-inner">
          <div className="sb-brand">
            <div className="sb-brand-logo"><FlaskLogo size={32} /></div>
            <div>
              <div className="sb-brand-name">LabLogic</div>
              <div className="sb-brand-sub">Trading Suite</div>
            </div>
          </div>

          <div className="sb-divider" />

          <nav className="sb-nav">
            {NAV.map((section, si) => (
              <div key={si} className="sb-section">
                {section.title && <div className="sb-section-title">{section.title}</div>}
                {section.items.map((item, ii) => {
                  const isActive = item.href && pathname === item.href;
                  return (
                    <button
                      key={ii}
                      className={`sb-item${isActive ? ' sb-item-active' : ''}${item.soon ? ' sb-item-soon' : ''}`}
                      disabled={item.soon}
                      onClick={() => navigate(item.href)}
                    >
                      <span className="sb-item-icon">{item.icon}</span>
                      <span className="sb-item-label">{item.label}</span>
                      {item.soon && <span className="sb-soon-badge">Soon</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Settings — pinned above footer, opens modal */}
          <button
            className="sb-item"
            onClick={() => { setOpen(false); window.dispatchEvent(new Event('ll_open_settings')); }}
            style={{ margin: '8px 0 4px' }}
          >
            <span className="sb-item-icon">{ICONS.settings}</span>
            <span className="sb-item-label">Settings</span>
          </button>

          <div className="sb-footer">
            <div className="sb-footer-dot" />
            <span>LabLogic v1.0 &nbsp;·&nbsp; Beta</span>
          </div>
        </div>
      </div>
    </>
  );
}
