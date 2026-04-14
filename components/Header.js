'use client';
export default function Header() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const d = new Date();
  const ord = n => n===1?'st':n===2?'nd':n===3?'rd':'th';
  return (
    <div className="hdr">
      <div className="hdr-name">Welcome, Trader</div>
      <div className="hdr-date">{days[d.getDay()]}, {months[d.getMonth()]} {d.getDate()}{ord(d.getDate())}, {d.getFullYear()}</div>
    </div>
  );
}
