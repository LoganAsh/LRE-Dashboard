"use client";

/**
 * Expandable sidebar from 21st.dev (manuarora700/sidebar), adapted for Vite:
 *  - next/link removed (SidebarLink renders a button, or an anchor when href is given)
 *  - desktop rail expands on hover as an OVERLAY (content doesn't reflow)
 *  - active state, optional badge, and mobile menu that closes on navigation
 *  - colors come from the app's CSS tokens, so light/dark follow data-theme
 */

import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const RAIL_WIDTH = 60;
const FULL_WIDTH = 264;

interface Links {
  label: string;
  href?: string;
  icon: React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

/** Non-null only inside the mobile overlay; links call it to dismiss the menu. */
const MobileCloseContext = createContext<(() => void) | null>(null);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = ({
  mobileHeader,
  ...props
}: React.ComponentProps<typeof motion.div> & { mobileHeader?: React.ReactNode }) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar mobileHeader={mobileHeader} {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  const expanded = animate ? open : true;
  return (
    // Reserves the rail's width in the layout; the panel itself floats above the page.
    <div
      className="relative hidden h-full shrink-0 md:block"
      style={{ width: animate ? RAIL_WIDTH : FULL_WIDTH }}
    >
      <motion.div
        className={cn(
          "absolute inset-y-0 left-0 z-40 hidden h-full flex-col border-r border-[var(--border)] bg-[var(--background)] px-3 py-4 md:flex",
          className
        )}
        initial={false}
        animate={{ width: expanded ? FULL_WIDTH : RAIL_WIDTH }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        {...props}
      >
        {children as React.ReactNode}
      </motion.div>
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  mobileHeader,
  ...props
}: React.ComponentProps<"div"> & { mobileHeader?: React.ReactNode }) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "flex h-12 w-full flex-row items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-4 md:hidden"
        )}
        {...props}
      >
        <div className="flex items-center">{mobileHeader}</div>
        <button
          type="button"
          aria-label="Open menu"
          className="z-20 flex size-8 appearance-none items-center justify-center rounded-lg border-0 bg-transparent text-[var(--text-secondary)]"
          onClick={() => setOpen(!open)}
        >
          <Menu className="size-5" strokeWidth={1.5} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={cn(
                "fixed inset-0 z-[100] flex h-full w-full flex-col justify-between bg-[var(--background)] p-8",
                className
              )}
            >
              <button
                type="button"
                aria-label="Close menu"
                className="absolute right-6 top-6 z-50 flex size-8 appearance-none items-center justify-center rounded-lg border-0 bg-transparent text-[var(--text-secondary)]"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" strokeWidth={1.5} />
              </button>
              <MobileCloseContext.Provider value={() => setOpen(false)}>
                {children}
              </MobileCloseContext.Provider>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  active = false,
  badge,
  className,
  onClick,
}: {
  link: Links;
  active?: boolean;
  badge?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) => {
  const { open, animate } = useSidebar();
  const closeMobile = useContext(MobileCloseContext);
  const showLabels = animate ? open : true;

  const classes = cn(
    "group/sidebar flex h-8 w-full appearance-none items-center justify-start gap-2.5 rounded-md border-0 bg-transparent px-2 text-left text-[13px] font-medium [font-family:inherit] outline-none transition-colors duration-150",
    "focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
    active
      ? "font-semibold text-[var(--foreground)]"
      : "text-[#6f6a64] hover:text-[var(--foreground)] dark:text-[#a8a29e] dark:hover:text-[var(--foreground)]",
    className
  );

  const handle = () => {
    onClick?.();
    closeMobile?.();
  };

  const content = (
    <>
      <span className={cn("flex size-5 shrink-0 items-center justify-center", active && "text-[#ea580c] dark:text-[#fb923c]")}>{link.icon}</span>
      <motion.span
        animate={{
          display: showLabels ? "inline-block" : "none",
          opacity: showLabels ? 1 : 0,
        }}
        className="inline-block whitespace-pre text-[13px]"
      >
        {link.label}
      </motion.span>
      {badge && showLabels ? <span className="ml-auto flex items-center">{badge}</span> : null}
    </>
  );

  if (link.href) {
    return (
      <a
        href={link.href}
        aria-current={active ? "page" : undefined}
        title={showLabels ? undefined : link.label}
        className={classes}
        onClick={handle}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      title={showLabels ? undefined : link.label}
      className={classes}
      onClick={handle}
    >
      {content}
    </button>
  );
};
