import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { describeRemoteStatus, useRemoteStatus } from './remoteStatus.js';

const TONE = {
  inuse: { text: 'text-[#b91c1c] dark:text-[#f87171]', track: 'bg-[#dc2626]' },
  available: { text: 'text-[#15803d] dark:text-[#4ade80]', track: 'bg-[#16a34a]' },
};

// A read-only switch: knob right and red when someone is on, knob left and green when it is free, grey when we cannot tell.
function Switch({ on, tone }) {
  const t = TONE[tone];
  return (
    <span aria-hidden="true" className={cn('relative inline-block h-[22px] w-[40px] shrink-0 rounded-full transition-colors duration-200', t ? t.track : 'bg-[color-mix(in_srgb,var(--text)_22%,transparent)]')}>
      <span className={cn('absolute top-[3px] size-4 rounded-full bg-white transition-[left] duration-200', on ? 'left-[21px]' : 'left-[3px]')} />
    </span>
  );
}

// Shown on the Bid Dashboard: is someone using the dedicated Bid2Win computer through Chrome Remote Desktop?
export default function Bid2WinStatus() {
  const status = useRemoteStatus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);   // keeps the "for 12 Min" numbers moving
  const info = describeRemoteStatus(status, now);
  const t = TONE[info.tone];
  return (
    <Card className="mb-4 px-5 py-3.5" data-bid2win-status data-state={info.tone}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Switch on={info.on} tone={info.tone} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">Bid2Win Computer</div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span role="status" className={cn('text-[15px] font-semibold', t ? t.text : 'text-[var(--text-secondary)]')}>{info.label}</span>
            {info.detail && <span className="text-xs text-[var(--text-subtle)]">{info.detail}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}
