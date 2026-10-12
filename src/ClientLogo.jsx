import { useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { Camera, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCEPT } from './clientLogos.js';
import { initialsOf } from './clientStats.js';

// A client's logo, or their initials when there isn't one yet. When `onPick` is given, hovering shows an upload button.
// With `menu`, clicking the logo opens a small pop-up whose only choice is Change Logo (Add Logo when there is none);
// without it, clicking goes straight to the file picker.
// Give it a `size` for a fixed square, or leave `size` off and position it (e.g. absolute inset-0) to fill its box.
export default function ClientLogo({ name, logo, busy = false, onPick, size, className, menu = false }) {
  const inputRef = useRef(null);
  const [broken, setBroken] = useState(false);
  const showImage = logo && !broken;
  const dim = size ? { width: size, height: size } : undefined;
  const overlayCls = cn(
    'absolute inset-0 flex appearance-none items-center justify-center rounded-xl border-0 bg-[color-mix(in_srgb,var(--card)_82%,transparent)] text-[var(--text-secondary)]',
    'outline-none cursor-pointer transition-opacity duration-150 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#ea580c]',
    busy ? 'opacity-100' : cn('opacity-0 group-hover/logo:opacity-100', !showImage && '[@media(hover:none)]:opacity-100')   // on touch screens, only show it over empty (initials) tiles
  );
  const overlayIcon = (
    <>
      {busy ? <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" /> : <Camera className="size-4" strokeWidth={1.75} aria-hidden="true" />}
      {busy && <span className="sr-only">Saving logo</span>}
    </>
  );

  return (
    <div className={cn('group/logo', size && 'relative shrink-0', className)} style={dim}>
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
          {menu ? (
            <Menu.Root>
              <Menu.Trigger
                aria-label={`Logo options for ${name}`} title="Logo options" disabled={busy}
                onClick={(e) => e.stopPropagation()}            // opening the menu must not also open the client's details
                className={cn(overlayCls, 'data-[popup-open]:opacity-100')}
              >
                {overlayIcon}
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner sideOffset={6} className="z-[160]">
                  {/* The pop-up lives outside the card in the page, but clicks inside it still travel up to the card, so stop them here */}
                  <Menu.Popup
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-[168px] rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-1.5 text-[var(--text)] outline-none"
                  >
                    <Menu.Item
                      onClick={() => inputRef.current && inputRef.current.click()}
                      className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium outline-none data-[highlighted]:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
                    >
                      <Camera className="size-4 text-[var(--text-subtle)]" strokeWidth={1.75} aria-hidden="true" />
                      {showImage ? 'Change Logo' : 'Add Logo'}
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ) : (
            <button
              type="button"
              aria-label={`${showImage ? 'Change' : 'Upload'} logo for ${name}`}
              title={showImage ? 'Change logo' : 'Upload logo'}
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); inputRef.current && inputRef.current.click(); }}
              className={overlayCls}
            >
              {overlayIcon}
            </button>
          )}
        </>
      )}
    </div>
  );
}
