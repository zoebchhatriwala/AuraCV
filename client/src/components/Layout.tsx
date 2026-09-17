import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';
import {
  LayoutDashboard, Settings, Upload,
  Palette, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Sun, Moon, Menu, X
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Resumes' },
  { to: '/templates', icon: Palette,         label: 'Templates' },
  { to: '/import',    icon: Upload,          label: 'Import' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
];

export default function Layout() {
  const { sidebarOpen, setSidebarOpen, activeProvider, theme, toggleTheme } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer when route changes
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const currentRouteTitle = () => {
    if (location.pathname.startsWith('/editor')) return 'Resume Editor';
    if (location.pathname.startsWith('/ai-studio')) return 'Writing Assistant';
    const match = NAV_ITEMS.find(item => item.to === location.pathname);
    return match ? match.label : 'AuraCV';
  };

  return (
    <div
      className="flex h-screen overflow-hidden transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── Mobile Backdrop ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/25 dark:bg-black/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-20
          flex flex-col shrink-0 transition-all duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full md:translate-x-0'}
          ${sidebarOpen ? 'md:w-60' : 'md:w-16'}
          glass border-r
        `}
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-glass)',
        }}
      >
        {/* Brand Header */}
        <div
          className={`flex items-center justify-between p-4 border-b transition-all ${sidebarOpen ? '' : 'md:justify-center'}`}
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-xs border border-white/10 flex items-center justify-center">
              <img src="/logo.svg" alt="AuraCV Logo" className="w-full h-full object-contain" />
            </div>
            {(sidebarOpen || mobileMenuOpen) && (
              <div className="flex flex-col">
                <span className="font-display font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  AuraCV
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                  Resume Studio
                </span>
              </div>
            )}
          </div>

          {/* Close button for mobile menu */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto" style={{ color: 'var(--text-primary)' }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all group
                ${sidebarOpen ? '' : 'md:justify-center'}
                ${isActive
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                  : 'hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-blue-700 dark:hover:text-blue-400'
                }
              `}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
              {(sidebarOpen || mobileMenuOpen) && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Active Provider Pill */}
        {(sidebarOpen || mobileMenuOpen) && activeProvider && (
          <div
            className="p-2.5 m-2.5 rounded-xl border transition-all"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-default)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${activeProvider.has_api_key || activeProvider.local ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {activeProvider.name}
                </span>
              </div>
              <span className="text-[10px] text-slate-700 dark:text-slate-400 font-mono font-semibold">
                {activeProvider.local ? 'Local' : 'Ready'}
              </span>
            </div>
            <p className="text-[10px] mt-0.5 truncate text-slate-600 dark:text-slate-400 font-mono">
              {activeProvider.model.split('/').pop() || activeProvider.model}
            </p>
          </div>
        )}

        {/* Footer controls: Theme toggle + Collapse toggle */}
        <div
          className={`p-3 border-t flex items-center gap-2 ${sidebarOpen ? '' : 'md:flex-col md:p-2'}`}
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl transition-all hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer ${sidebarOpen ? 'flex-1' : 'w-full'}`}
            style={{ color: 'var(--text-primary)' }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
                {(sidebarOpen || mobileMenuOpen) && <span className="text-xs font-semibold">Light Mode</span>}
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-600 transition-transform hover:-rotate-12" />
                {(sidebarOpen || mobileMenuOpen) && <span className="text-xs font-semibold">Dark Mode</span>}
              </>
            )}
          </button>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
            className="p-2 rounded-xl transition-all hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer hidden md:block"
            style={{ color: 'var(--text-primary)' }}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* ── Main Canvas ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header
          className="h-14 px-3 sm:px-6 border-b flex items-center justify-between shrink-0 glass z-10"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Sidebar Toggle Button right in the Navbar */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer items-center justify-center"
              style={{ color: 'var(--text-primary)' }}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="hidden sm:inline text-slate-600 dark:text-slate-400 font-medium">AuraCV</span>
              <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-slate-500 dark:text-slate-500" />
              <span className="font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                {currentRouteTitle()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {activeProvider && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeProvider.has_api_key || activeProvider.local ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {activeProvider.name}
              </span>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-all hover:bg-slate-200 dark:hover:bg-neutral-700 border cursor-pointer"
              style={{
                borderColor: 'var(--border-default)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
