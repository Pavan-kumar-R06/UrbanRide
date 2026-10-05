/* Same vector icons as the original app, rendered as React. */
const I = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  ticket: '<path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  car: '<path d="M5 16l1.6-5A2 2 0 0 1 8.500 9.600h7a2 2 0 0 1 1.900 1.400L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.500"/><circle cx="7.500" cy="18" r=".6"/><circle cx="16.500" cy="18" r=".6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.500"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.500a3.500 3.500 0 0 1 0 7M18 14a7 7 0 0 1 4 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  rupee: '<path d="M7 5h10M7 9h10M7 5c6 0 6 8 0 8H7l7 7"/>',
  leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19c3-5 6-8 9-10"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16.500" cy="14.500" r="1"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  share: '<circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="6" r="2.500"/><circle cx="18" cy="18" r="2.500"/><path d="M8.300 10.800l7.400-3.600M8.300 13.200l7.400 3.600"/>',
  dna: '<path d="M6 3c0 6 12 6 12 12s-12 6-12 6"/><path d="M18 3c0 6-12 6-12 12"/><path d="M8 7h8M8 17h8"/>',
  badge: '<path d="M12 2l2.500 2 3.200-.2.8 3.100 2.700 1.700-1.100 3 1.100 3-2.700 1.700-.8 3.100-3.200-.2L12 22l-2.500-2-3.200.2-.8-3.100L2.800 15.400 3.900 12.400 2.800 9.400l2.700-1.700.8-3.100 3.200.2z"/><path d="M9 12l2 2 4-4"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
/* Line-style vehicle glyphs that match the rest of the icon set (used instead of emoji). */
const VEH = {
  car: '<path d="M5 17H3.5v-4.500L5.600 7.600A2 2 0 0 1 7.400 6.500h9.200a2 2 0 0 1 1.800 1.100L20.500 12.500V17H19"/><path d="M3.500 12.500h17"/><circle cx="7.500" cy="17" r="2"/><circle cx="16.500" cy="17" r="2"/><path d="M9.500 17h5"/>',
  bike: '<circle cx="5.500" cy="16.500" r="3"/><circle cx="18.500" cy="16.500" r="3"/><path d="M5.500 16.500l1.500-4.500h4l2.500-2.500h2.500"/><path d="M16 9.500l2.500 7"/><path d="M13.500 7.500h3l-1 2"/><rect x="8.500" y="12.500" width="5" height="3" rx="1"/><path d="M2.500 14h3"/>',
  scooter: '<circle cx="6" cy="17.500" r="2.500"/><circle cx="18" cy="17.500" r="2.500"/><path d="M8.500 17.500h7"/><path d="M15.500 17.500L17.200 6H19.800"/><path d="M6 17.500l1.800-5.500h5.200"/>'
};
export const Veh = ({ t = 'car', z = 18 }) => (
  <svg width={z} height={z} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-3px', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: VEH[t] || VEH.car }} />
);
export const Ic = ({ n, z = 18 }) => (
  <svg width={z} height={z} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: I[n] || '' }} />
);
export const Logo = ({ z }) => (
  <svg width={z} height={z} viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#ffffff"/><path d="M15 43c6-5 11-7 18-7h9c7 0 11-5 11-12" fill="none" stroke="#090a0f" strokeWidth="9" strokeLinecap="round"/><path d="M17 41.5l5-3.1M31 36h5m9-2.6 3-3.4" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="square"/><path d="M8 41a8 8 0 1 1 16 0c0 6-8 14-8 14S8 47 8 41zM44 19a8 8 0 1 1 16 0c0 6-8 14-8 14s-8-8-8-14z" fill="#090a0f"/><circle cx="16" cy="40" r="4" fill="#ffffff"/><circle cx="52" cy="18" r="4" fill="#ffffff"/><path d="M25 34l3-8h9l3 8" fill="#ffffff" stroke="#090a0f" strokeWidth="2.5" strokeLinejoin="round"/><rect x="23" y="33" width="19" height="9" rx="2.5" fill="#090a0f"/><circle cx="28" cy="31" r="1.8" fill="#090a0f"/><circle cx="33" cy="30" r="1.8" fill="#090a0f"/><circle cx="38" cy="31" r="1.8" fill="#090a0f"/><rect x="25" y="35" width="5" height="3" rx="1" fill="#ffffff"/><rect x="35" y="35" width="5" height="3" rx="1" fill="#ffffff"/><rect x="20" y="35" width="4" height="4" rx="1.2" fill="#090a0f"/><rect x="41" y="35" width="4" height="4" rx="1.2" fill="#090a0f"/></svg>
);
export const Brand = ({ z }) => (<span className="brand"><Logo z={z} /><span>UrbanRide</span></span>);
