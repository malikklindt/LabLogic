'use client';
import { useState, useEffect, useCallback } from 'react';

const KEY = 'll_settings';

export const DEFAULTS = {
  // Notifications
  whaleSound:     true,
  whaleThreshold: 10_000_000,   // $10M
  whaleSig_inflow:   true,
  whaleSig_outflow:  true,
  whaleSig_exchange: true,
  whaleSig_transfer: true,

  // Dashboard
  defaultPage:      '/',
  defaultTimeframe: '1M',
  defaultPair:      'BTC/USD',

  // Whale Watch
  defaultChain: 'all',
  minTxDisplay: 1_000_000,      // $1M

  // Journal
  defaultSide: 'long',

  // Appearance
  theme: 'dark',
  density: 'comfortable',
};

function load() {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

/** Read settings synchronously (for non-React contexts like WhaleNotifier). */
export function getSettings() {
  return load();
}

/** Apply theme to the document root. Call on load and on change. */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme || 'dark');
}

/** React hook — returns [settings, set(key, value)] */
export function useSettings() {
  const [settings, setSettings] = useState(load);

  // Sync across tabs / components via storage event
  useEffect(() => {
    const handler = () => setSettings(load());
    window.addEventListener('storage', handler);
    window.addEventListener('ll_settings_change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('ll_settings_change', handler);
    };
  }, []);

  const set = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      save(next);
      window.dispatchEvent(new Event('ll_settings_change'));
      return next;
    });
  }, []);

  return [settings, set];
}
