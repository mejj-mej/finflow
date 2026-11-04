import React from 'react';

// Original, consistent 20px line icons; decorative alongside visible control labels.
const paths = {
  Dashboard: <><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="13" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="13" width="6" height="6" rx="1.5"/><rect x="13" y="13" width="6" height="6" rx="1.5"/></>,
  Transactions: <><path d="M4 7h14m-4-4 4 4-4 4M18 15H4m4-4-4 4 4 4"/></>,
  'Scan Receipt': <><path d="M3 7V4a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H4a1 1 0 0 1-1-1v-3M2 11h18M7 7h8M7 15h8"/></>,
  Receipts: <><path d="M5 3h12v16l-3-2-3 2-3-2-3 2V3ZM8 7h6M8 11h6"/></>,
  Warranties: <><path d="M11 2 3.5 5v6c0 4.5 3 7.8 7.5 10 4.5-2.2 7.5-5.5 7.5-10V5L11 2Z"/><path d="m7.5 11 2.3 2.3 4.7-5"/></>,
  Settings: <><path d="M9 3h4l.7 2.4 2.3.8 2.1-.6 2 3.4-1.7 1.8.1 2.5 1.6 1.7-2 3.4-2.4-.5-2.1 1-.6 2.1H9l-.7-2.4-2.3-.8-2.1.6-2-3.4 1.7-1.8-.1-2.5L2 9l2-3.4 2.4.5 2.1-1L9 3Z"/><circle cx="11" cy="12" r="3"/></>,
};
export default function Icon({name}) {
  return <svg className="ui-icon" viewBox="0 0 22 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name] || paths.Receipts}</svg>;
}
