import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 767px)';

// True on a phone-sized screen. The whole phone layout switches on and off with this; desktop never sees it.
export function useIsMobile() {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : false);
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    on();
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, []);
  return mobile;
}
