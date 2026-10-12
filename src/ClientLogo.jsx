import { useState } from 'react';
import { cn } from '@/lib/utils';
import { initialsOf } from './clientStats.js';

// A client's logo, or their initials when there isn't one yet. It only displays; it has no buttons of its own,
// so on a card a click on it is just a click on the card. Changing a logo happens in the client pop-up.
// Give it a `size` for a fixed square, or leave `size` off and position it (e.g. absolute inset-0) to fill its box.
export default function ClientLogo({ name, logo, size, className }) {
  const [broken, setBroken] = useState(false);
  const showImage = logo && !broken;
  const dim = size ? { width: size, height: size } : undefined;

  return (
    <div className={cn(size && 'relative shrink-0', className)} style={dim}>
      <div className={cn('flex h-full w-full items-center justify-center overflow-hidden rounded-xl', !showImage && 'border border-[color:var(--border)]')}>
        {showImage ? (
          <img
            src={logo} alt={`${name} logo`} loading="lazy" onError={() => setBroken(true)}
            className={cn('h-full w-full object-contain', size ? 'p-0.5' : 'p-1')}
          />
        ) : (
          <span aria-hidden="true" className="select-none font-semibold text-[var(--text-subtle)]" style={{ fontSize: size ? Math.round(size * 0.3) : 38 }}>
            {initialsOf(name)}
          </span>
        )}
      </div>
    </div>
  );
}
