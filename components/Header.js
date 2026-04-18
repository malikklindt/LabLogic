'use client';
export default function Header() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const d = new Date();
  const ord = n => n===1?'st':n===2?'nd':n===3?'rd':'th';
  const openBrief = () => window.dispatchEvent(new Event('ll_open_briefing'));
  return (
    <div className="hdr" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div>
        <div className="hdr-name">Welcome, Trader</div>
        <div className="hdr-date">{days[d.getDay()]}, {months[d.getMonth()]} {d.getDate()}{ord(d.getDate())}, {d.getFullYear()}</div>
      </div>
      <button
        onClick={openBrief}
        className="hdr-brief-btn"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.08))',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: 10,
          color: 'var(--purple)',
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'Inter',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          transition: 'background 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <span>🌅</span>
        <span>Today's Brief</span>
      </button>
    </div>
  );
}
