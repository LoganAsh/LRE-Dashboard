import { useRef, useState } from 'react';
import { Camera, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCEPT } from './clientLogos.js';
import { initialsOf } from './clientStats.js';

// A client's logo, or their initials when there isn't one yet. When `onPick` is given, hovering shows an upload button.
export default function ClientLogo({ name, logo, busy = false, onPick, size = 48, className }) {
  const inputRef = useRef(null);
  const [broken, setBroken] = useState(false);
  const showImage = logo && !broken;
  const dim = { width: size, height: size };

  return (
    <div className={cn('group/logo relative shrink-0', className)} style={dim}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--card)]">
        {showImage ? (
          <img
            src={logo} alt={`${name} logo`} loading="lazy" onError={() => setBroken(true)}
            className="h-full w-full object-contain p-1.5"
          />
        ) : (
          <span aria-hidden="true" className="select-none font-semibold text-[var(--text-subtle)]" style={{ fontSize: Math.round(size * 0.3) }}>
            {initialsOf(name)}
          </span>
        )}
      </div>

      {onPick && (
        <>
          <input
            ref={inputRef} type="file" accept={ACCEPT} tabIndex={-1} aria-hidden="true" className="sr-only"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file) { setBroken(false); onPick(file); }
              e.target.value = '';                                  // lets you pick the same file again
            }}
          />
          <button
            type="button"
            aria-label={`${showImage ? 'Change' : 'Upload'} logo for ${name}`}
            title={showImage ? 'Change logo' : 'Upload logo'}
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); inputRef.current && inputRef.current.click(); }}
            className={cn(
              'absolute inset-0 flex appearance-none items-center justify-center rounded-xl border-0 bg-[color-mix(in_srgb,var(--card)_82%,transparent)] text-[var(--text-secondary)]',
              'outline-none cursor-pointer transition-opacity duration-150 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#ea580c]',
              busy ? 'opacity-100' : cn('opacity-0 group-hover/logo:opacity-100', !showImage && '[@media(hover:none)]:opacity-100')   // on touch screens, only show it over empty (initials) tiles
            )}
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" /> : <Camera className="size-4" strokeWidth={1.75} aria-hidden="true" />}
            {busy && <span className="sr-only">Saving logo</span>}
          </button>
        </>
      )}
    </div>
  );
}
