import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  ExternalLink,
  FolderKanban,
  BookOpen,
  Users,
  Compass,
  FileText,
  Globe2,
  GitCommit,
  Network,
  BarChart3,
  Archive,
  FlaskConical,
  Settings,
  Sparkles,
  Database,
  Languages,
  Palette,
  ChevronLeft,
  ChevronRight,
  X,
  Cpu,
  Drama,
  Clapperboard,
  SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NavTab, AppTheme } from '../types';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen,
  setMobileOpen,
  collapsed,
  setCollapsed,
}) => {
  const {
    currentTab,
    setCurrentTab,
    t,
    theme,
    setTheme,
    language,
    setLanguage,
    activeProjectId,
    projects,
    aiSettings,
  } = useApp();

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isExternal?: boolean;
    url?: string;
  }> = [
    { id: 'HOME', label: t.nav.HOME, icon: LayoutDashboard },
    { id: 'WORKBENCH', label: t.nav.WORKBENCH, icon: ExternalLink, isExternal: true, url: 'https://o9hvl8i7mb5d.meoo.info' },
    { id: 'PROJECTS', label: t.nav.PROJECTS, icon: FolderKanban },
    { id: 'LIBRARY', label: t.nav.LIBRARY, icon: BookOpen },
    { id: 'CHARACTERS', label: t.nav.CHARACTERS, icon: Users },
    { id: 'QUESTS', label: t.nav.QUESTS, icon: Compass },
    { id: 'SCRIPT', label: t.nav.SCRIPT, icon: Drama },
    { id: 'STORYBOARD', label: t.nav.STORYBOARD, icon: Clapperboard },
    { id: 'AV_REQUIREMENTS', label: t.nav.AV_REQUIREMENTS, icon: SlidersHorizontal },
    { id: 'COPY', label: t.nav.COPY, icon: FileText },
    { id: 'WORLD', label: t.nav.WORLD, icon: Globe2 },
    { id: 'TIMELINE', label: t.nav.TIMELINE, icon: GitCommit },
    { id: 'KNOWLEDGE GRAPH', label: t.nav['KNOWLEDGE GRAPH'], icon: Network },
    { id: 'ANALYSIS', label: t.nav.ANALYSIS, icon: BarChart3 },
    { id: 'ARCHIVE', label: t.nav.ARCHIVE, icon: Archive },
    { id: 'LAB', label: t.nav.LAB, icon: FlaskConical },
    { id: 'SETTINGS', label: t.nav.SETTINGS, icon: Settings },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.isExternal && item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setCurrentTab(item.id);
    setMobileOpen(false);
  };

  const themeList: Array<{ id: AppTheme; label: string; primaryColor: string; accentColor: string }> = [
    { id: 'sunshine-greentea', label: '绿茶', primaryColor: '#F04E98', accentColor: '#00FFBF' },
    { id: 'plain-cream', label: '奶油', primaryColor: '#C0D0D3', accentColor: '#FCF2D7' },
    { id: 'haze-coffee', label: '咖蓝', primaryColor: '#809AAA', accentColor: '#473D37' },
    { id: 'sweet-lolita', label: '萝莉', primaryColor: '#D48AA0', accentColor: '#F8D2E1' },
  ];

  const sidebarContent = (isMobileDrawer: boolean) => {
    const isCollapsed = !isMobileDrawer && collapsed;

    return (
      <div 
        className="flex flex-col h-full select-none transition-colors duration-300 relative"
        style={{
          background: 'var(--theme-sidebar-bg)',
          color: 'var(--theme-sidebar-text)',
        }}
      >
        {/* Brand Header */}
        <div
          id="sidebar-header"
          className={`p-4 border-b flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
          style={{ borderColor: 'var(--theme-sidebar-border)' }}
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            <motion.div 
              whileHover={{ scale: 1.08, rotate: 4 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-lg cursor-pointer"
              style={{
                background: 'var(--theme-primary)',
                color: 'var(--theme-primary-text)',
                boxShadow: 'var(--theme-primary-shadow)',
              }}
            >
              N
            </motion.div>
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="font-black text-sm tracking-wider font-sans uppercase truncate" style={{ color: 'var(--theme-sidebar-text)' }}>
                  NARRATIVE OS
                </h1>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span 
                    className="w-1.5 h-1.5 rounded-full animate-pulse-glow" 
                    style={{ background: 'var(--theme-sidebar-accent)' }}
                  />
                  <p 
                    className="text-[9px] tracking-widest uppercase font-mono font-bold"
                    style={{ color: 'var(--theme-sidebar-accent)' }}
                  >
                    AI CONNECTED
                  </p>
                </div>
              </div>
            )}
          </div>

          {isMobileDrawer ? (
            <button
              id="sidebar-mobile-close-btn"
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-colors"
              title="关闭侧边栏"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              id="sidebar-desktop-collapse-btn"
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-white/10 transition-all hover:scale-105 active:scale-95 hidden lg:flex"
              title={collapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--theme-sidebar-accent)' }} />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Active Project Pill */}
        {!isCollapsed ? (
          <motion.div
            id="sidebar-active-project-bar"
            whileHover={{ scale: 1.01 }}
            className="px-3 py-2 mx-3 mt-3 rounded-xl border flex items-center justify-between text-xs flex-shrink-0 shadow-sm transition-colors"
            style={{
              background: 'var(--theme-sidebar-project-bg)',
              borderColor: 'var(--theme-sidebar-border)',
            }}
          >
            <div className="flex items-center space-x-2 truncate">
              <span 
                className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" 
                style={{ background: 'var(--theme-sidebar-accent)' }}
              />
              <span className="truncate text-[11px] font-medium opacity-90">
                {activeProject ? activeProject.name : t.common.allProjects}
              </span>
            </div>
            <button
              id="sidebar-switch-project-btn"
              onClick={() => {
                setCurrentTab('PROJECTS');
                if (isMobileDrawer) setMobileOpen(false);
              }}
              className="text-[10px] font-bold ml-1 flex-shrink-0 hover:underline transition-transform active:scale-95"
              style={{ color: 'var(--theme-sidebar-accent)' }}
            >
              {activeProject ? '切换' : '选择'}
            </button>
          </motion.div>
        ) : (
          <div 
            className="py-2 flex justify-center border-b"
            style={{ borderColor: 'var(--theme-sidebar-border)' }}
          >
            <button
              onClick={() => setCurrentTab('PROJECTS')}
              title={activeProject ? activeProject.name : '项目管理'}
              className="p-2 rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'var(--theme-sidebar-project-bg)',
                color: 'var(--theme-sidebar-accent)',
              }}
            >
              <FolderKanban className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav
          id="sidebar-nav-container"
          className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto sidebar-scrollbar text-xs font-medium relative"
        >
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                id={`sidebar-nav-${item.id.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => handleNavClick(item)}
                title={isCollapsed ? item.label : undefined}
                whileHover={{ x: isCollapsed ? 0 : 3 }}
                whileTap={{ scale: 0.98 }}
                style={
                  isActive
                    ? {
                        color: 'var(--theme-sidebar-active-text)',
                      }
                    : {
                        color: 'var(--theme-sidebar-text-muted)',
                      }
                }
                className={`w-full flex items-center relative z-10 ${
                  isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                } py-2.5 rounded-xl text-xs transition-colors group hover:text-white`}
              >
                {/* Active Sliding Background Indicator */}
                {isActive && (
                  <motion.div
                    layoutId={`sidebar-active-indicator-${isMobileDrawer ? 'mobile' : 'desktop'}`}
                    className="absolute inset-0 rounded-xl z-0 shadow-md"
                    style={{
                      backgroundColor: 'var(--theme-sidebar-active-bg)',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 32,
                    }}
                  />
                )}

                <div className="flex items-center space-x-3 truncate relative z-10">
                  <Icon
                    className="w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{
                      color: isActive ? 'var(--theme-sidebar-active-text)' : 'inherit',
                    }}
                  />
                  {!isCollapsed && <span className="truncate tracking-wide font-medium">{item.label}</span>}
                </div>

                {!isCollapsed && (
                  <div className="relative z-10">
                    {item.isExternal ? (
                      <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                    ) : (
                      isActive && (
                        <motion.span 
                          layoutId="active-dot"
                          className="w-1.5 h-1.5 rounded-full block"
                          style={{
                            background: 'var(--theme-sidebar-accent)',
                            boxShadow: '0 0 8px var(--theme-sidebar-accent)',
                          }}
                        />
                      )
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Footer Area */}
        <div 
          id="sidebar-footer" 
          className="p-3 border-t space-y-2 flex-shrink-0 transition-colors duration-300"
          style={{
            background: 'var(--theme-sidebar-footer-bg)',
            borderColor: 'var(--theme-sidebar-border)',
          }}
        >
          {/* Theme Switcher */}
          {!isCollapsed ? (
            <div 
              className="p-2 rounded-xl border"
              style={{
                background: 'rgba(0, 0, 0, 0.15)',
                borderColor: 'var(--theme-sidebar-border)',
              }}
            >
              <div className="flex items-center justify-between text-[10px] mb-1.5 font-bold opacity-90">
                <span className="flex items-center gap-1">
                  <Palette className="w-3 h-3" style={{ color: 'var(--theme-sidebar-accent)' }} />
                  主题配色
                </span>
                <span 
                  className="text-[9px] font-mono uppercase font-bold"
                  style={{ color: 'var(--theme-sidebar-accent)' }}
                >
                  {theme}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {themeList.map((th) => (
                  <motion.button
                    key={th.id}
                    id={`theme-btn-${th.id}`}
                    onClick={() => setTheme(th.id)}
                    title={th.label}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    style={
                      theme === th.id
                        ? {
                            borderColor: 'var(--theme-sidebar-accent)',
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                          }
                        : {
                            borderColor: 'transparent',
                          }
                    }
                    className="flex flex-col items-center justify-center p-1 rounded-lg border text-[9px] transition-all hover:bg-white/5"
                  >
                    <span 
                      className="w-3.5 h-3.5 rounded-full mb-0.5 border shadow-sm flex items-center justify-center overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${th.primaryColor} 0%, ${th.accentColor} 100%)`,
                        borderColor: 'rgba(255,255,255,0.4)',
                      }}
                    />
                    <span className="truncate w-full text-center text-[8px] opacity-90">{th.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <motion.button
                whileHover={{ scale: 1.1, rotate: 15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  const nextTheme: Record<AppTheme, AppTheme> = {
                    'sunshine-greentea': 'plain-cream',
                    'plain-cream': 'haze-coffee',
                    'haze-coffee': 'sweet-lolita',
                    'sweet-lolita': 'sunshine-greentea',
                  };
                  setTheme(nextTheme[theme] || 'sunshine-greentea');
                }}
                title={`当前主题: ${theme} (点击切换)`}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/15 transition-colors"
                style={{ color: 'var(--theme-sidebar-accent)' }}
              >
                <Palette className="w-4 h-4" />
              </motion.button>
            </div>
          )}

          {/* Lang & Local First status */}
          {!isCollapsed ? (
            <div className="flex items-center justify-between text-[11px] pt-1 px-1">
              <button
                id="sidebar-lang-toggle"
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 font-bold text-xs transition-all active:scale-95 border border-white/10"
              >
                <Languages className="w-3.5 h-3.5" style={{ color: 'var(--theme-sidebar-accent)' }} />
                <span>{language === 'zh' ? '中文' : 'EN'}</span>
              </button>

              <div className="flex items-center space-x-1 opacity-80 text-[10px] font-mono">
                <Database className="w-3 h-3" style={{ color: 'var(--theme-sidebar-accent)' }} />
                <span>IndexedDB</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-1">
              <button
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                title="切换语言"
                className="p-1.5 rounded-lg text-xs font-mono font-bold opacity-80 hover:opacity-100 active:scale-90 transition-all"
              >
                {language === 'zh' ? '中' : 'EN'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* 2. Mobile Drawer Panel */}
      <div
        id="sidebar-mobile-drawer"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent(true)}
      </div>

      {/* 3. Desktop Flex Sidebar (Normal layout flow - NEVER covers main workspace) */}
      <aside
        id="narrative-os-desktop-sidebar"
        className={`hidden lg:flex flex-col flex-shrink-0 h-full border-r transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-60 xl:w-64'
        }`}
        style={{ borderColor: 'var(--theme-sidebar-border)' }}
      >
        {sidebarContent(false)}
      </aside>
    </>
  );
};

