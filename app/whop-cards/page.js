'use client';

// ── FlaskLogo SVG ──────────────────────────────────────────────────────────────
function FlaskLogo({ size = 48, color = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="28" y="2" width="24" height="8" rx="3" stroke={color} strokeWidth="4" fill="none"/>
      <path d="M32 10 L32 30 L8 78 Q4 86 14 86 L66 86 Q76 86 72 78 L48 30 L48 10"
        stroke={color} strokeWidth="4" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M14 72 Q28 66 40 72 Q52 78 66 72"
        stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <circle cx="38" cy="44" r="3" stroke={color} strokeWidth="2.5" fill="none"/>
      <circle cx="46" cy="54" r="4.5" stroke={color} strokeWidth="2.5" fill="none"/>
      <circle cx="36" cy="60" r="2.5" stroke={color} strokeWidth="2" fill="none"/>
    </svg>
  );
}

// ── Card 1: LabLogic Platform ──────────────────────────────────────────────────
function Card1() {
  const features = [
    { icon: '📊', label: 'Live Market Dashboard',   sub: 'BTC, ETH, SOL & top altcoins' },
    { icon: '🐳', label: 'Whale Watch',              sub: 'Real-time large transactions' },
    { icon: '📅', label: 'Economic Calendar',        sub: 'High-impact macro events' },
    { icon: '😰', label: 'Fear & Greed Index',       sub: 'AI-powered sentiment score' },
    { icon: '💰', label: 'Funding Rates',            sub: 'Binance · Bybit · OKX live' },
    { icon: '📓', label: 'Trade Journal',            sub: 'AI-coached performance review' },
  ];

  return (
    <div id="card-1" style={{
      width: 1200, height: 1200,
      background: 'linear-gradient(145deg, #07070f 0%, #0d0920 50%, #07070f 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      position: 'relative', overflow: 'hidden',
      padding: '80px',
      boxSizing: 'border-box',
    }}>
      {/* Background glow */}
      <div style={{ position:'absolute', top:'-200px', left:'50%', transform:'translateX(-50%)', width:'900px', height:'900px', borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-100px', right:'-100px', width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)', pointerEvents:'none' }} />

      {/* Top badge */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'48px', background:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.35)', borderRadius:'100px', padding:'10px 24px' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#7c3aed', boxShadow:'0 0 8px #7c3aed' }} />
        <span style={{ color:'#a855f7', fontSize:'15px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>CoinForge Lab · Included</span>
      </div>

      {/* Logo + Title */}
      <div style={{ display:'flex', alignItems:'center', gap:'20px', marginBottom:'20px' }}>
        <div style={{ background:'rgba(124,58,237,0.2)', borderRadius:'20px', padding:'14px', border:'1px solid rgba(124,58,237,0.3)' }}>
          <FlaskLogo size={52} color="white" />
        </div>
        <div>
          <div style={{ fontSize:'72px', fontWeight:800, color:'white', letterSpacing:'-2px', lineHeight:1 }}>LabLogic</div>
          <div style={{ fontSize:'22px', color:'#7c3aed', fontWeight:600, letterSpacing:'0.05em', marginTop:'6px' }}>Trading Suite</div>
        </div>
      </div>

      {/* Tagline */}
      <div style={{ fontSize:'26px', color:'rgba(255,255,255,0.55)', fontWeight:400, marginBottom:'72px', textAlign:'center', maxWidth:'700px', lineHeight:1.4 }}>
        Institutional-grade market intelligence,<br/>built for serious crypto traders
      </div>

      {/* Feature grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'20px', width:'100%' }}>
        {features.map((f, i) => (
          <div key={i} style={{
            background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:'16px',
            padding:'28px 24px',
            display:'flex', flexDirection:'column', gap:'10px',
            backdropFilter:'blur(10px)',
          }}>
            <div style={{ fontSize:'32px' }}>{f.icon}</div>
            <div style={{ fontSize:'18px', fontWeight:700, color:'white' }}>{f.label}</div>
            <div style={{ fontSize:'14px', color:'rgba(255,255,255,0.45)' }}>{f.sub}</div>
          </div>
        ))}
      </div>

      {/* Bottom tag */}
      <div style={{ marginTop:'56px', fontSize:'16px', color:'rgba(255,255,255,0.3)', letterSpacing:'0.04em' }}>
        coinforgelab.com  ·  Member Access Only
      </div>
    </div>
  );
}

// ── Card 2: Trade Ideas ────────────────────────────────────────────────────────
function Card2() {
  const ideas = [
    { pair:'BTC/USDT', dir:'LONG',  entry:'68,200', target:'74,500', stop:'66,400', r:'3.2R', conf:'High' },
    { pair:'ETH/USDT', dir:'LONG',  entry:'2,340',  target:'2,720',  stop:'2,210', r:'2.9R', conf:'High' },
    { pair:'SOL/USDT', dir:'SHORT', entry:'85.40',  target:'74.00',  stop:'89.00', r:'3.1R', conf:'Med'  },
  ];

  return (
    <div id="card-2" style={{
      width: 1200, height: 1200,
      background: 'linear-gradient(145deg, #070712 0%, #0a0a1f 50%, #070712 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      position: 'relative', overflow: 'hidden',
      padding: '80px',
      boxSizing: 'border-box',
    }}>
      <div style={{ position:'absolute', top:'100px', right:'100px', width:'600px', height:'600px', borderRadius:'50%', background:'radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'0', left:'0', width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents:'none' }} />

      {/* Badge */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'48px', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'100px', padding:'10px 24px' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 8px #22c55e' }} />
        <span style={{ color:'#22c55e', fontSize:'15px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>CoinForge Lab · Trade Ideas</span>
      </div>

      <div style={{ fontSize:'68px', fontWeight:800, color:'white', letterSpacing:'-2px', lineHeight:1, marginBottom:'16px', textAlign:'center' }}>
        Trade Ideas
      </div>
      <div style={{ fontSize:'24px', color:'rgba(255,255,255,0.45)', marginBottom:'72px', textAlign:'center' }}>
        Curated setups, delivered daily — entry, target, stop &amp; R:R
      </div>

      {/* Trade cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:'20px', width:'100%' }}>
        {ideas.map((t, i) => (
          <div key={i} style={{
            background:'rgba(255,255,255,0.04)',
            border:`1px solid ${t.dir==='LONG' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            borderLeft:`4px solid ${t.dir==='LONG' ? '#22c55e' : '#ef4444'}`,
            borderRadius:'16px',
            padding:'28px 32px',
            display:'flex', alignItems:'center', gap:'0',
          }}>
            <div style={{ flex:'0 0 200px' }}>
              <div style={{ fontSize:'22px', fontWeight:800, color:'white' }}>{t.pair}</div>
              <div style={{ marginTop:'6px', display:'inline-block', background: t.dir==='LONG' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: t.dir==='LONG' ? '#22c55e' : '#ef4444', fontSize:'13px', fontWeight:700, padding:'4px 12px', borderRadius:'6px', letterSpacing:'0.06em' }}>
                {t.dir}
              </div>
            </div>
            <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0' }}>
              {[['ENTRY', t.entry, '#e8e8ff'], ['TARGET', t.target, '#22c55e'], ['STOP', t.stop, '#ef4444']].map(([lbl, val, col]) => (
                <div key={lbl} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.35)', letterSpacing:'0.08em', marginBottom:'6px' }}>{lbl}</div>
                  <div style={{ fontSize:'22px', fontWeight:700, color: col }}>${val}</div>
                </div>
              ))}
            </div>
            <div style={{ flex:'0 0 140px', textAlign:'right' }}>
              <div style={{ fontSize:'28px', fontWeight:800, color:'#a855f7' }}>{t.r}</div>
              <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.35)', marginTop:'4px' }}>Confidence: {t.conf}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ marginTop:'56px', display:'flex', gap:'48px', justifyContent:'center' }}>
        {[['5–7', 'Ideas / Week'], ['68%', 'Historical Win Rate'], ['2.4R', 'Avg Risk:Reward']].map(([val, lbl]) => (
          <div key={lbl} style={{ textAlign:'center' }}>
            <div style={{ fontSize:'40px', fontWeight:800, color:'white', letterSpacing:'-1px' }}>{val}</div>
            <div style={{ fontSize:'15px', color:'rgba(255,255,255,0.35)', marginTop:'6px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:'48px', fontSize:'16px', color:'rgba(255,255,255,0.25)', letterSpacing:'0.04em' }}>
        coinforgelab.com  ·  Member Access Only
      </div>
    </div>
  );
}

// ── Card 3: Macro Reports ──────────────────────────────────────────────────────
function Card3() {
  const sections = [
    { icon:'🏦', title:'Central Bank Watch',    body:'Fed, ECB, BOJ policy analysis and rate decision previews with forward guidance breakdowns.' },
    { icon:'📈', title:'Macro Data Breakdown',  body:'CPI, NFP, GDP — what each print means for crypto market structure and risk appetite.' },
    { icon:'🌍', title:'Geopolitical Edge',     body:'Dollar strength, global liquidity cycles, and macro regime shifts that drive crypto.' },
    { icon:'⚡', title:'Weekly Alpha Brief',    body:'One concise report every week. What happened, what it means, and how to position.' },
  ];

  return (
    <div id="card-3" style={{
      width: 1200, height: 1200,
      background: 'linear-gradient(145deg, #06070f 0%, #0b0818 50%, #06070f 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      position: 'relative', overflow: 'hidden',
      padding: '80px',
      boxSizing: 'border-box',
    }}>
      <div style={{ position:'absolute', top:'0', left:'50%', transform:'translateX(-50%)', width:'800px', height:'800px', borderRadius:'50%', background:'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 65%)', pointerEvents:'none' }} />

      {/* Badge */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'48px', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:'100px', padding:'10px 24px' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#fbbf24', boxShadow:'0 0 8px #fbbf24' }} />
        <span style={{ color:'#fbbf24', fontSize:'15px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>CoinForge Lab · Macro Reports</span>
      </div>

      <div style={{ fontSize:'68px', fontWeight:800, color:'white', letterSpacing:'-2px', lineHeight:1, marginBottom:'16px', textAlign:'center' }}>
        Macro Reports
      </div>
      <div style={{ fontSize:'24px', color:'rgba(255,255,255,0.45)', marginBottom:'72px', textAlign:'center', maxWidth:'700px', lineHeight:1.5 }}>
        Deep-dive macro analysis written for crypto traders — <br/>no economics degree required
      </div>

      {/* 2×2 grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px', width:'100%' }}>
        {sections.map((s, i) => (
          <div key={i} style={{
            background:'rgba(255,255,255,0.03)',
            border:'1px solid rgba(251,191,36,0.12)',
            borderRadius:'20px',
            padding:'36px',
            display:'flex', flexDirection:'column', gap:'16px',
          }}>
            <div style={{ fontSize:'36px' }}>{s.icon}</div>
            <div style={{ fontSize:'22px', fontWeight:700, color:'white' }}>{s.title}</div>
            <div style={{ fontSize:'16px', color:'rgba(255,255,255,0.45)', lineHeight:1.6 }}>{s.body}</div>
          </div>
        ))}
      </div>

      {/* Frequency note */}
      <div style={{ marginTop:'56px', display:'flex', gap:'48px', justifyContent:'center' }}>
        {[['Weekly', 'Deep-Dive Report'], ['Event-Based', 'Flash Reports'], ['Full Archive', 'Back-Catalogue Access']].map(([val, lbl]) => (
          <div key={lbl} style={{ textAlign:'center', padding:'0 32px', borderRight: lbl==='Full Archive · Back-Catalogue Access' ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize:'28px', fontWeight:800, color:'#fbbf24' }}>{val}</div>
            <div style={{ fontSize:'14px', color:'rgba(255,255,255,0.35)', marginTop:'6px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:'48px', fontSize:'16px', color:'rgba(255,255,255,0.25)', letterSpacing:'0.04em' }}>
        coinforgelab.com  ·  Member Access Only
      </div>
    </div>
  );
}

// ── Card 4: Macro Accelerator Course ──────────────────────────────────────────
function Card4() {
  const modules = [
    { num:'01', title:'The Macro Framework',       body:'How central bank policy drives liquidity cycles and why crypto follows.' },
    { num:'02', title:'Reading Economic Data',      body:'CPI, PCE, NFP, GDP — what each release means for risk assets.' },
    { num:'03', title:'Dollar & Liquidity Cycles',  body:'DXY, M2, global liquidity — the invisible force behind every bull run.' },
    { num:'04', title:'Identifying Market Regimes', body:'Risk-on vs risk-off. Knowing which environment you\'re in changes everything.' },
    { num:'05', title:'Trading the Macro Calendar', body:'How to use economic events as trade catalysts and risk-management tools.' },
    { num:'06', title:'Building a Macro Edge',       body:'Combining top-down macro with on-chart technical analysis for high-R setups.' },
  ];

  return (
    <div id="card-4" style={{
      width: 1200, height: 1200,
      background: 'linear-gradient(145deg, #06070f 0%, #090716 50%, #06070f 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      position: 'relative', overflow: 'hidden',
      padding: '80px',
      boxSizing: 'border-box',
    }}>
      <div style={{ position:'absolute', top:'-100px', right:'-100px', width:'700px', height:'700px', borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-100px', left:'-50px', width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 65%)', pointerEvents:'none' }} />

      {/* Badge */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'48px', background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.35)', borderRadius:'100px', padding:'10px 24px' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#6366f1', boxShadow:'0 0 8px #6366f1' }} />
        <span style={{ color:'#818cf8', fontSize:'15px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>CoinForge Lab · Course</span>
      </div>

      <div style={{ fontSize:'60px', fontWeight:800, color:'white', letterSpacing:'-2px', lineHeight:1.1, marginBottom:'16px', textAlign:'center' }}>
        Macro Accelerator
      </div>
      <div style={{ fontSize:'24px', color:'rgba(255,255,255,0.45)', marginBottom:'64px', textAlign:'center', maxWidth:'680px', lineHeight:1.5 }}>
        Go from "what is CPI?" to trading macro like a hedge fund analyst
      </div>

      {/* Modules */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', width:'100%' }}>
        {modules.map((m, i) => (
          <div key={i} style={{
            background:'rgba(255,255,255,0.03)',
            border:'1px solid rgba(99,102,241,0.15)',
            borderRadius:'14px',
            padding:'22px 24px',
            display:'flex', gap:'18px', alignItems:'flex-start',
          }}>
            <div style={{ fontSize:'13px', fontWeight:800, color:'#6366f1', opacity:0.7, paddingTop:'3px', minWidth:'24px' }}>{m.num}</div>
            <div>
              <div style={{ fontSize:'16px', fontWeight:700, color:'white', marginBottom:'6px' }}>{m.title}</div>
              <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', lineHeight:1.5 }}>{m.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Value prop row */}
      <div style={{ marginTop:'48px', display:'flex', gap:'40px', justifyContent:'center' }}>
        {[['6', 'Core Modules'], ['Self-Paced', 'Learn Anytime'], ['Lifetime', 'Access Included']].map(([val, lbl]) => (
          <div key={lbl} style={{ textAlign:'center', padding:'0 24px', borderRight: lbl==='Lifetime Access Included' ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize:'30px', fontWeight:800, color:'#818cf8' }}>{val}</div>
            <div style={{ fontSize:'14px', color:'rgba(255,255,255,0.35)', marginTop:'6px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:'40px', fontSize:'16px', color:'rgba(255,255,255,0.25)', letterSpacing:'0.04em' }}>
        coinforgelab.com  ·  Member Access Only
      </div>
    </div>
  );
}

// ── Card 5: Daily Market Mark-Ups ─────────────────────────────────────────────
function Card5() {
  const items = [
    { icon:'🎯', title:'Key Levels Identified',    body:'Support, resistance, and liquidity zones marked before the session opens.' },
    { icon:'📐', title:'Structure Analysis',        body:'Higher timeframe market structure broken down — are we trending, ranging, or reversing?' },
    { icon:'⚡', title:'Bias for the Day',          body:'Bullish, bearish, or neutral — and exactly what needs to happen to change the bias.' },
    { icon:'🔔', title:'Levels to Watch',           body:'The exact prices that matter. Know before you open a single chart.' },
  ];

  return (
    <div id="card-5" style={{
      width: 1200, height: 1200,
      background: 'linear-gradient(145deg, #070809 0%, #090d14 50%, #070809 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      position: 'relative', overflow: 'hidden',
      padding: '80px',
      boxSizing: 'border-box',
    }}>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'1000px', height:'1000px', borderRadius:'50%', background:'radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 65%)', pointerEvents:'none' }} />

      {/* Badge */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'48px', background:'rgba(14,165,233,0.1)', border:'1px solid rgba(14,165,233,0.3)', borderRadius:'100px', padding:'10px 24px' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#0ea5e9', boxShadow:'0 0 8px #0ea5e9' }} />
        <span style={{ color:'#38bdf8', fontSize:'15px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>CoinForge Lab · Daily Mark-Ups</span>
      </div>

      <div style={{ fontSize:'64px', fontWeight:800, color:'white', letterSpacing:'-2px', lineHeight:1.1, marginBottom:'16px', textAlign:'center' }}>
        Daily Market<br/>Mark-Ups
      </div>
      <div style={{ fontSize:'24px', color:'rgba(255,255,255,0.45)', marginBottom:'72px', textAlign:'center', maxWidth:'700px', lineHeight:1.5 }}>
        Wake up knowing exactly where the key levels are — <br/>before the market opens
      </div>

      {/* Feature list */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px', width:'100%', marginBottom:'48px' }}>
        {items.map((item, i) => (
          <div key={i} style={{
            background:'rgba(255,255,255,0.03)',
            border:'1px solid rgba(14,165,233,0.12)',
            borderRadius:'20px',
            padding:'36px',
            display:'flex', flexDirection:'column', gap:'14px',
          }}>
            <div style={{ fontSize:'36px' }}>{item.icon}</div>
            <div style={{ fontSize:'22px', fontWeight:700, color:'white' }}>{item.title}</div>
            <div style={{ fontSize:'16px', color:'rgba(255,255,255,0.45)', lineHeight:1.6 }}>{item.body}</div>
          </div>
        ))}
      </div>

      {/* Chart mockup bar */}
      <div style={{
        width:'100%', background:'rgba(14,165,233,0.05)', border:'1px solid rgba(14,165,233,0.15)',
        borderRadius:'16px', padding:'24px 32px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#0ea5e9', boxShadow:'0 0 8px #0ea5e9' }} />
          <span style={{ color:'white', fontWeight:700, fontSize:'18px' }}>BTC/USDT · 4H · Mark-Up Ready</span>
        </div>
        <div style={{ display:'flex', gap:'32px' }}>
          {[['Resistance','$74,200','#ef4444'],['Range High','$72,800','#f97316'],['Current','$70,925','#e8e8ff'],['Support','$68,400','#22c55e']].map(([lbl,val,col]) => (
            <div key={lbl} style={{ textAlign:'right' }}>
              <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)', letterSpacing:'0.06em', marginBottom:'4px' }}>{lbl}</div>
              <div style={{ fontSize:'16px', fontWeight:700, color: col }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop:'40px', display:'flex', gap:'48px', justifyContent:'center' }}>
        {[['Daily', 'Every Trading Day'], ['BTC · ETH · Alts', 'Multiple Assets'], ['Pre-Market', 'Delivered Before Open']].map(([val, lbl]) => (
          <div key={lbl} style={{ textAlign:'center', padding:'0 32px', borderRight: lbl.includes('Before') ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize:'26px', fontWeight:800, color:'#38bdf8' }}>{val}</div>
            <div style={{ fontSize:'14px', color:'rgba(255,255,255,0.35)', marginTop:'6px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:'32px', fontSize:'16px', color:'rgba(255,255,255,0.25)', letterSpacing:'0.04em' }}>
        coinforgelab.com  ·  Member Access Only
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function WhopCards() {
  return (
    <div style={{ background:'#000', padding:'40px', display:'flex', flexDirection:'column', gap:'40px', alignItems:'center' }}>
      <Card1 />
      <Card2 />
      <Card3 />
      <Card4 />
      <Card5 />
    </div>
  );
}
