import React, { useEffect, useState } from 'react';

const listeners = new Set<() => void>();

export const navigate = (to: string) => {
  if (to === window.location.pathname + window.location.search) return;
  window.history.pushState(null, '', to);
  listeners.forEach(l => l());
  window.scrollTo(0, 0);
};

export const usePath = () => {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    listeners.add(on);
    window.addEventListener('popstate', on);
    return () => {
      listeners.delete(on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return path;
};

/** Cocokkan pola seperti "/fpk/:id". */
export const match = (pattern: string, path: string): Record<string, string> | null => {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
};

export const Link: React.FC<{ to: string; className?: string; children: React.ReactNode; title?: string }> = ({ to, className, children, title }) => (
  <a
    href={to}
    title={title}
    className={className}
    onClick={e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(to);
    }}
  >
    {children}
  </a>
);
