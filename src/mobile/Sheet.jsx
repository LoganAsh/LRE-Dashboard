import { useRef } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { cn } from '@/lib/utils';

// Drag the handle (or the top of the sheet) down to close, like a native bottom sheet.
export function SheetGrip({ popupRef, onClose, className }) {
  const drag = useRef(null);
  const el = () => popupRef && popupRef.current;
  const start = (e) => { drag.current = { y: e.clientY, dy: 0 }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } const p = el(); if (p) p.style.transition = 'none'; };
  const move = (e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y); drag.current.dy = dy;
    const p = el(); if (p) p.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    if (!drag.current) return;
    const { dy } = drag.current; drag.current = null;
    const p = el();
    if (p) { p.style.transition = 'transform 0.2s ease-out'; p.style.transform = dy > 110 ? 'translateY(100%)' : ''; }
    if (dy > 110) setTimeout(onClose, 160);
  };
  return (
    <div className={cn('m-grip', className)} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-hidden="true">
      <span />
    </div>
  );
}

// A bottom sheet: slides up from the bottom, rounded top, grab handle, scrolls inside.
export default function Sheet({ open, onClose, title, subtitle, children, footer, full = false, label }) {
  const popupRef = useRef(null);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="m-backdrop" />
        <Dialog.Viewport className="m-sheet-viewport">
          <Dialog.Popup ref={popupRef} initialFocus={popupRef} className={cn('m-sheet', full && 'm-sheet-full')} aria-label={label}>
            <SheetGrip popupRef={popupRef} onClose={onClose} />
            {(title || subtitle) && (
              <div className="m-sheet-head">
                {title && <Dialog.Title className="m-sheet-title">{title}</Dialog.Title>}
                {subtitle && <Dialog.Description className="m-sheet-sub">{subtitle}</Dialog.Description>}
              </div>
            )}
            <div className="m-sheet-body">{children}</div>
            {footer && <div className="m-sheet-foot">{footer}</div>}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
