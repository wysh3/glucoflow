/*
 * React port of CodexApp 0.1.91 DesktopLayout, ContentHeader,
 * SidebarThreadControls and SidebarMenuRow. See README.md and MIT LICENSE.
 */
import {
  useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTrigger } from '@glucoflow/ui';
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { registerBackGuard } from '../../platform/back';
import './desktop-layout.css';
import './shell-adaptation.css';

const storageKey = 'glucoflow.canvas.navigation';
const minimumWidth = 220;
const maximumWidth = 620;
const defaultWidth = 240;
const mobileQuery = '(max-width: 767px)';
const layoutScope = { 'data-v-59d3c494': '' };
const sidebarScope = { 'data-v-705e1c85': '' };
const controlsScope = { 'data-v-2369affb': '' };
const headerScope = { 'data-v-717320c2': '' };
const rowScope = { 'data-v-36239f39': '' };
const treeScope = { 'data-v-0e565e1c': '' };

type NavigationPreference = { collapsed: boolean; width: number };

function clampWidth(width: number, max = maximumWidth) {
  return Math.max(minimumWidth, Math.min(max, width));
}

function viewportWidthLimit() {
  return typeof window === 'undefined' ? maximumWidth : clampWidth(window.innerWidth - 448);
}

function readPreference(): NavigationPreference {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (value && typeof value.collapsed === 'boolean' && typeof value.width === 'number' && Number.isFinite(value.width)) {
      return { collapsed: value.collapsed, width: clampWidth(value.width) };
    }
  } catch {
    // The layout stays usable when storage is unavailable.
  }
  return { collapsed: false, width: defaultWidth };
}

function savePreference(preference: NavigationPreference) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preference));
  } catch {
    // The in-memory preference remains available.
  }
}

export function CodexSidebarRow({ to, active, icon, onClick, children }: {
  to: string;
  active?: boolean;
  icon: ReactNode;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Link to={to} className="sidebar-menu-row thread-row" aria-current={active ? 'page' : undefined}
      title={typeof children === 'string' ? children : undefined} aria-label={typeof children === 'string' ? children : undefined}
      data-active={active || undefined} data-has-left="true" onClick={onClick} {...rowScope} {...treeScope}>
      <span className="sidebar-menu-row-left" {...rowScope}>{icon}</span>
      <span className="sidebar-menu-row-main" {...rowScope}>{children}</span>
    </Link>
  );
}

type DesktopLayoutProps = {
  title: string;
  sidebarLabel: string;
  compactToolbar?: boolean;
  sidebarHeading?: ReactNode;
  sidebar: (close: () => void) => ReactNode;
  sidebarFooter?: ReactNode;
  toolbar?: ReactNode;
  toolbarFooter?: ReactNode;
  mobileFooter?: ReactNode;
  skipLink?: ReactNode;
  children: ReactNode;
};

export function CodexDesktopLayout({
  title, sidebarLabel, compactToolbar, sidebarHeading, sidebar, sidebarFooter, toolbar, toolbarFooter,
  mobileFooter, skipLink, children,
}: DesktopLayoutProps) {
  const [{ collapsed, width }, setPreference] = useState(readPreference);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [widthLimit, setWidthLimit] = useState(viewportWidthLimit);
  const rail = useRef<HTMLElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const restoreToggleFocus = useRef(false);
  const drag = useRef<{ startX: number; startWidth: number; width: number; direction: number } | null>(null);
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const element = layout.current;
      if (!element) return;
      if (Math.abs(viewport.scale - 1) > .01) return;
      element.style.setProperty('--app-viewport-height', `${viewport.height}px`);
      element.dataset.keyboardOpen = String(window.innerHeight - viewport.height > 150);
    };
    update();
    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const mobile = window.matchMedia(mobileQuery);
    const closeOnDesktop = () => {
      if (!mobile.matches) setDrawerOpen(false);
    };
    const updateWidthLimit = () => setWidthLimit(viewportWidthLimit());
    mobile.addEventListener('change', closeOnDesktop);
    window.addEventListener('resize', updateWidthLimit);
    return () => {
      mobile.removeEventListener('change', closeOnDesktop);
      window.removeEventListener('resize', updateWidthLimit);
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    return registerBackGuard(() => {
      setDrawerOpen(false);
      return 'handled';
    });
  }, [drawerOpen]);

  useLayoutEffect(() => {
    if (!restoreToggleFocus.current) return;
    restoreToggleFocus.current = false;
    toggle.current?.focus();
  }, [collapsed]);

  function toggleSidebar() {
    const next = { collapsed: !collapsed, width };
    restoreToggleFocus.current = true;
    setPreference(next);
    savePreference(next);
  }

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const startWidth = rail.current?.offsetWidth;
    if (!startWidth) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    drag.current = { startX: event.clientX, startWidth, width: startWidth, direction: rtl ? -1 : 1 };
  }

  function moveResize(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    const next = start.startWidth + (event.clientX - start.startX) * start.direction;
    start.width = clampWidth(next, widthLimit);
    setPreference({ collapsed: false, width: start.width });
  }

  function finishResize() {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    savePreference({ collapsed: false, width: current.width });
  }

  function keyboardResize(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const step = rtl ? -16 : 16;
    const current = rail.current?.offsetWidth ?? width;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = current - step; break;
      case 'ArrowRight': next = current + step; break;
      case 'Home': next = minimumWidth; break;
      case 'End': next = widthLimit; break;
      default: return;
    }
    event.preventDefault();
    const preference = { collapsed: false, width: clampWidth(next, widthLimit) };
    setPreference(preference);
    savePreference(preference);
  }

  const layoutStyle = {
    '--sidebar-width': `${Math.min(width, widthLimit)}px`,
    '--layout-columns': collapsed
      ? '64px minmax(0, 1fr)'
      : 'var(--sidebar-width) 1px minmax(0, 1fr)',
  } as CSSProperties;
  const toggleLabel = collapsed ? 'Expand navigation' : 'Collapse navigation';
  const desktopToggle = (
    <button ref={toggle} className="sidebar-thread-controls-button codexapp-desktop-toggle" {...controlsScope}
      type="button" aria-label={toggleLabel} title={toggleLabel} aria-expanded={!collapsed} onClick={toggleSidebar}>
      {collapsed ? <PanelLeftOpen className="sidebar-thread-controls-icon" {...controlsScope} aria-hidden />
        : <PanelLeftClose className="sidebar-thread-controls-icon" {...controlsScope} aria-hidden />}
    </button>
  );

  function sidebarBody(mobile: boolean) {
    return (
      <section className="sidebar-root" {...sidebarScope}>
        <div className="sidebar-scrollable" {...sidebarScope}>
          <div className="sidebar-thread-controls sidebar-thread-controls-host" {...controlsScope} {...sidebarScope}>
            {mobile ? (
              <DialogClose asChild>
                <button type="button" className="sidebar-thread-controls-button" {...controlsScope} aria-label="Close navigation">
                  <X className="sidebar-thread-controls-icon" {...controlsScope} aria-hidden />
                </button>
              </DialogClose>
            ) : desktopToggle}
            {sidebarHeading}
          </div>
          {sidebar(closeDrawer)}
        </div>
        {sidebarFooter ? <div className="sidebar-settings-area" {...sidebarScope}>{sidebarFooter}</div> : null}
      </section>
    );
  }

  return (
    <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div ref={layout} className="desktop-layout" {...layoutScope} style={layoutStyle}>
        {skipLink}
        <aside ref={rail} className="desktop-sidebar no-print" data-collapsed={collapsed || undefined} {...layoutScope}>{sidebarBody(false)}</aside>
        {!collapsed ? (
          <>
            <div className="desktop-resize-handle no-print" {...layoutScope}
              role="separator" tabIndex={0} aria-label="Resize sidebar" aria-orientation="vertical"
              aria-valuemin={minimumWidth} aria-valuemax={widthLimit} aria-valuenow={Math.min(width, widthLimit)}
              onPointerDown={startResize} onPointerMove={moveResize}
              onPointerUp={finishResize} onLostPointerCapture={finishResize}
              onKeyDown={keyboardResize} />
          </>
        ) : null}
        <section className="desktop-main" {...layoutScope}>
          <div className="content-root" {...sidebarScope}>
            <header className="content-header no-print" {...headerScope} data-compact={compactToolbar || undefined}>
              <div className="content-leading" {...headerScope}>
                <DialogTrigger asChild>
                  <button type="button" className="sidebar-thread-controls-button codexapp-mobile-toggle" {...controlsScope}
                    aria-label="Open navigation" title="Open navigation">
                    <Menu className="sidebar-thread-controls-icon" {...controlsScope} aria-hidden />
                  </button>
                </DialogTrigger>
              </div>
              <span className="content-title" {...headerScope} title={title}>{title}</span>
              <div className="content-actions" {...headerScope}>{toolbar}</div>
            </header>
            {toolbarFooter}
            {children}
            {mobileFooter ? <div className="codexapp-mobile-footer no-print">{mobileFooter}</div> : null}
          </div>
        </section>
      </div>
      <DialogContent className="mobile-drawer codexapp-mobile-dialog" {...layoutScope} side="floating" aria-describedby={undefined}>
        <div className="sr-only"><DialogHeader title={sidebarLabel} /></div>
        {sidebarBody(true)}
      </DialogContent>
    </Dialog>
  );
}
