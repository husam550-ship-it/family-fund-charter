import { useEffect, useState } from 'react';

// مسار صفحة المشارك: #/join/<معرّف الخدمة>[/<هوية المشارك>]. يُفحص قبل تحميل المنصة حتى لا يحمّل المشارك إلا صفحته.

const JOIN_PREFIX = '#/join/';

const current = (): string | null => (window.location.hash.startsWith(JOIN_PREFIX) ? window.location.hash.slice(JOIN_PREFIX.length) : null);

export const useJoinRoute = (): string | null => {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const on = (): void => setRoute(current());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
};
