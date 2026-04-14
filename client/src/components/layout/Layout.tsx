import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { pipelineApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import type { DataSource } from '@shared/types';
import { LayoutDashboard, Database, Building2, Factory, GitCompare, Download, Search, Menu, X } from 'lucide-react';
import GlobalSearch from '../search/GlobalSearch';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/sources', icon: Database, label: 'Sources' },
  { to: '/companies', icon: Building2, label: 'Companies' },
  { to: '/facilities', icon: Factory, label: 'Factories' },
  { to: '/review', icon: GitCompare, label: 'Review' },
  { to: '/export', icon: Download, label: 'Export' },
];

export default function Layout() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: pipelineApi.status,
    refetchInterval: 5000,
  });

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-border-subtle">
        <h1 className="header-title text-fg-default tracking-wider">PILLAR</h1>
        <p className="sub-header text-fg-soft mt-1">Data Acquisition</p>
      </div>

      {/* Search trigger */}
      <div className="px-3 pt-3">
        <button
          onClick={() => { setIsSearchOpen(true); setSidebarOpen(false); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-border-subtle text-sm text-fg-soft hover:text-fg-muted hover:border-border-strong transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Global Search</span>
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-bg-elevated text-xs text-fg-soft border border-border-subtle">
            <span className="text-[10px]">&#8984;</span>K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-bg-elevated text-fg-default'
                  : 'text-fg-muted hover:text-fg-default hover:bg-bg-surface'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border-subtle space-y-2">
        {pipelineStatus?.running && pipelineStatus.currentSource && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs text-fg-muted truncate">
                Syncing {DATA_SOURCES[pipelineStatus.currentSource as DataSource]?.name ?? pipelineStatus.currentSource}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${pipelineStatus.stageProgress ?? 0}%` }}
              />
            </div>
            {pipelineStatus.stageLabel && (
              <p className="text-[10px] text-fg-soft truncate">{pipelineStatus.stageLabel}</p>
            )}
          </div>
        )}
        <p className="text-xs text-fg-soft">Companion to Archangel</p>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-bg-shell">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 border-r border-border-subtle bg-bg-base flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-bg-base border-r border-border-subtle flex flex-col
        transform transition-transform duration-200 ease-out md:hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Close button */}
        <div className="absolute top-4 right-4">
          <button onClick={() => setSidebarOpen(false)} className="p-1 text-fg-soft hover:text-fg-default">
            <X className="w-5 h-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-bg-base">
        {/* Mobile header with hamburger */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-bg-base/95 backdrop-blur-xl border-b border-border-subtle md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1 text-fg-muted hover:text-fg-default">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-fg-default tracking-wider">PILLAR</span>
          <div className="flex-1" />
          <button onClick={() => setIsSearchOpen(true)} className="p-1 text-fg-muted hover:text-fg-default">
            <Search className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Global search modal */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
