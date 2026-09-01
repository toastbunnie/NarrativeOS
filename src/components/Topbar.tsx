import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  Search,
  Plus,
  FolderKanban,
  FileText,
  UserPlus,
  Compass,
  Globe2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { syncWithFeishuNow } from '../services/feishuAdapter';

interface TopbarProps {
  onOpenMobileMenu: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenMobileMenu,
  sidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const {
    currentTab,
    setCurrentTab,
    t,
    projects,
    activeProjectId,
    setActiveProjectId,
    searchQuery,
    setSearchQuery,
    showToast,
    refreshData,
    documents,
    characters,
    quests,
    theme,
    setTheme,
  } = useApp();

  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const topbarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (topbarRef.current && !topbarRef.current.contains(e.target as Node)) {
        setQuickMenuOpen(false);
        setProjectDropdownOpen(false);
        setThemeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const themesList = [
    {
      id: 'sunshine-greentea' as const,
      name: '日照绿茶',
      desc: '高能量深粉绿茶与质感墨黑 (旗舰)',
      colors: ['#F04E98', '#00FFBF', '#E8E8E8', '#494949'],
    },
    {
      id: 'plain-cream' as const,
      name: '素色奶油',
      desc: '温润奶油米白，高对比深棕黑字阶',
      colors: ['#F8F7E2', '#FFFDF3', '#FCF2D7', '#C0D0D3'],
    },
    {
      id: 'haze-coffee' as const,
      name: '雾霾咖蓝',
      desc: '沉稳咖蓝底蕴与灰白米调',
      colors: ['#809AAA', '#C4BEB3', '#A38E82', '#473D37'],
    },
    {
      id: 'sweet-lolita' as const,
      name: '甜心萝莉',
      desc: '粉桃、丁香浅紫与玫瑰深粉',
      colors: ['#F8D2E1', '#F9E6F2', '#D0CFE6', '#D48AA0'],
    },
  ];

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleFeishuSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncWithFeishuNow();
      if (res.success) {
        showToast(res.message, 'success');
        await refreshData();
      } else {
        showToast(res.message, 'info');
      }
    } catch (err: any) {
      showToast(`飞书同步提示: ${err.message || String(err)}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const getTabHeading = () => {
    switch (currentTab) {
      case 'HOME':
        return {
          title: t.nav.HOME,
          desc: '叙事架构总览与快速生产工作台',
        };
      case 'PROJECTS':
        return {
          title: t.nav.PROJECTS,
          desc: '管理不同作品企划与分支宇宙',
        };
      case 'LIBRARY':
        return {
          title: t.nav.LIBRARY,
          desc: '结构化沉淀设定集、文档与灵感碎屑',
        };
      case 'CHARACTERS':
        return {
          title: t.nav.CHARACTERS,
          desc: '人物档案、弧光设计与人物关系网络',
        };
      case 'QUESTS':
        return {
          title: t.nav.QUESTS,
          desc: '任务链设计、分支网状叙事与视听分镜需求',
        };
      case 'COPY':
        return {
          title: t.nav.COPY,
          desc: '游戏道具包装、信件、公告、UI与环境文案生产库',
        };
      case 'WORLD':
        return {
          title: t.nav.WORLD,
          desc: '世界观法则、阵营势力、地理与术语体系',
        };
      case 'TIMELINE':
        return {
          title: t.nav.TIMELINE,
          desc: '正史编年史、大事件与角色个人轨迹比对',
        };
      case 'KNOWLEDGE GRAPH':
        return {
          title: t.nav['KNOWLEDGE GRAPH'],
          desc: '全要素实体拓扑连接与叙事知识图谱',
        };
      case 'ANALYSIS':
        return {
          title: t.nav.ANALYSIS,
          desc: '剧本节奏曲线、叙事张力与台词密度雷达',
        };
      case 'ARCHIVE':
        return {
          title: t.nav.ARCHIVE,
          desc: '版本归档、快照恢复与格式化导出 (JSON/TXT/MD)',
        };
      case 'LAB':
        return {
          title: t.nav.LAB,
          desc: '文本智能解析实验区 · 多模态叙事内容自动萃取',
        };
      case 'SETTINGS':
        return {
          title: t.nav.SETTINGS,
          desc: '飞书同步配置、AI 模型选择与偏好设置',
        };
      default:
        return { title: 'NARRATIVE OS', desc: '叙事设计与资产管理系统' };
    }
  };

  const heading = getTabHeading();

  return (
    <header
      ref={topbarRef}
      id="narrative-os-topbar"
      className="h-16 px-4 sm:px-6 flex items-center justify-between z-40 flex-shrink-0 transition-colors duration-300 relative"
      style={{
        background: 'var(--theme-topbar-bg)',
        borderBottom: '1px solid var(--theme-topbar-border)',
        color: 'var(--text-primary)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Left: Mobile Menu Trigger / Sidebar Collapse Toggle & Page Heading */}
      <div className="flex items-center space-x-3 overflow-hidden">
        {/* Mobile Hamburger Button */}
        <motion.button
          id="topbar-mobile-menu-trigger"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={onOpenMobileMenu}
          className="p-2 rounded-xl bg-white/60 hover:bg-white/90 border border-white/80 shadow-sm lg:hidden flex items-center justify-center flex-shrink-0"
          title="打开侧边导航"
        >
          <Menu className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
        </motion.button>

        {/* Desktop Sidebar Collapse Toggle Button */}
        {onToggleSidebar && (
          <motion.button
            id="topbar-sidebar-toggle-desktop"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={onToggleSidebar}
            className="hidden lg:flex p-2 rounded-xl bg-white/60 hover:bg-white/90 border border-white/80 shadow-sm items-center justify-center flex-shrink-0 transition-colors"
            title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
            ) : (
              <PanelLeftClose className="w-4 h-4 opacity-70 hover:opacity-100" />
            )}
          </motion.button>
        )}

        {/* Page Title & Breadcrumb */}
        <div className="truncate">
          <div className="flex items-center space-x-2">
            <h2 className="font-extrabold text-base tracking-tight truncate font-display">
              {heading.title}
            </h2>
            {activeProject && (
              <span
                className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border shadow-xs"
                style={{
                  backgroundColor: 'var(--theme-secondary-bg)',
                  borderColor: 'var(--theme-secondary-border)',
                  color: 'var(--theme-secondary-text)',
                }}
              >
                {activeProject.name}
              </span>
            )}
          </div>
          <p className="hidden xl:block text-[11px] opacity-70 truncate max-w-md">
            {heading.desc}
          </p>
        </div>
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center space-x-1.5 sm:space-x-2.5">
        {/* Project Selector Dropdown */}
        <div className="relative">
          <motion.button
            id="topbar-project-dropdown-trigger"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setProjectDropdownOpen(!projectDropdownOpen);
              setThemeDropdownOpen(false);
              setQuickMenuOpen(false);
            }}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/70 hover:bg-white/95 border border-white/80 text-xs font-medium shadow-sm transition-all"
          >
            <FolderKanban className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--theme-primary)' }} />
            <span className="max-w-[70px] sm:max-w-[120px] truncate font-bold text-xs">
              {activeProject ? activeProject.name : t.common.allProjects}
            </span>
            <ChevronDown className={`w-3 h-3 opacity-60 flex-shrink-0 transition-transform duration-200 ${projectDropdownOpen ? 'rotate-180' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {projectDropdownOpen && (
              <motion.div
                id="topbar-project-dropdown-menu"
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 mt-2 w-56 p-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/80 shadow-2xl z-50 origin-top-right"
              >
                <div className="px-2 py-1 text-[10px] uppercase font-mono opacity-60 border-b border-black/5 font-bold">
                  {t.common.activeProject}
                </div>
                <button
                  id="topbar-select-all-projects-btn"
                  onClick={() => {
                    setActiveProjectId(null);
                    setProjectDropdownOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 my-0.5 rounded-lg text-xs flex items-center justify-between font-medium transition-colors ${
                    activeProjectId === null
                      ? 'font-bold'
                      : 'hover:bg-black/5'
                  }`}
                  style={activeProjectId === null ? {
                    backgroundColor: 'var(--theme-secondary-bg)',
                    borderColor: 'var(--theme-secondary-border)',
                  } : {}}
                >
                  <span>{t.common.allProjects}</span>
                  {activeProjectId === null && <span className="text-[10px] font-black" style={{ color: 'var(--theme-primary)' }}>✓</span>}
                </button>

                {projects.map((p) => (
                  <button
                    key={p.id}
                    id={`topbar-select-project-${p.id}`}
                    onClick={() => {
                      setActiveProjectId(p.id);
                      setProjectDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 my-0.5 rounded-lg text-xs flex items-center justify-between font-medium transition-colors ${
                      activeProjectId === p.id
                        ? 'font-bold'
                        : 'hover:bg-black/5'
                    }`}
                    style={activeProjectId === p.id ? {
                      backgroundColor: 'var(--theme-secondary-bg)',
                      borderColor: 'var(--theme-secondary-border)',
                    } : {}}
                  >
                    <span className="truncate">{p.name}</span>
                    {activeProjectId === p.id && <span className="text-[10px] font-black" style={{ color: 'var(--theme-primary)' }}>✓</span>}
                  </button>
                ))}

                <div className="border-t border-black/5 mt-1 pt-1">
                  <button
                    id="topbar-manage-projects-btn"
                    onClick={() => {
                      setCurrentTab('PROJECTS');
                      setProjectDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-black/5 transition-colors"
                    style={{ color: 'var(--theme-primary)' }}
                  >
                    + {t.projects.newProject} / 管理
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Search Input with Focus Expand */}
        <motion.div 
          animate={{ width: searchFocused ? 220 : 160 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative hidden md:block"
        >
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            id="topbar-global-search"
            type="text"
            placeholder={t.common.search}
            value={searchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 rounded-full bg-white/70 border border-white/80 text-xs placeholder:opacity-40 focus:bg-white focus:outline-none focus:ring-2 shadow-xs transition-all"
            style={{
              borderColor: searchFocused ? 'var(--theme-primary)' : 'rgba(255,255,255,0.8)',
            }}
          />
          {!searchQuery && (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono px-1 py-0.5 rounded bg-black/5 text-black/40 pointer-events-none">
              /
            </kbd>
          )}
        </motion.div>

        {/* AI Model Badge */}
        <motion.button
          id="topbar-ai-status-badge"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setCurrentTab('SETTINGS')}
          title="点击进入设置配置 AI 引擎与 API Key"
          className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/70 hover:bg-white/95 border border-white/80 text-xs font-bold transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--theme-primary)', animationDuration: '6s' }} />
          <span className="hidden sm:inline text-[10px] font-mono font-bold" style={{ color: 'var(--theme-primary)' }}>
            QWEN-AI
          </span>
        </motion.button>

        {/* Feishu Sync Button */}
        <motion.button
          id="topbar-feishu-sync-btn"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          onClick={handleFeishuSync}
          disabled={syncing}
          title="飞书多维表格双向同步"
          className="hidden sm:flex items-center space-x-1 px-3 py-1.5 rounded-full bg-white/70 hover:bg-white/95 border border-white/80 text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} style={{ color: 'var(--theme-primary)' }} />
          <span className="text-[11px]">{t.common.sync}</span>
        </motion.button>

        {/* Quick Theme Switcher */}
        <div className="relative">
          <motion.button
            id="topbar-theme-switcher-btn"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              setThemeDropdownOpen(!themeDropdownOpen);
              setProjectDropdownOpen(false);
              setQuickMenuOpen(false);
            }}
            title="快捷切换主题色彩 (Theme Color Switcher)"
            className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/70 hover:bg-white/95 border border-white/80 text-xs font-bold transition-all shadow-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            <Palette className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
            <span className="hidden md:inline text-xs font-medium">
              {themesList.find((t) => t.id === theme)?.name || '主题'}
            </span>
            <ChevronDown className={`w-3 h-3 opacity-60 flex-shrink-0 transition-transform duration-200 ${themeDropdownOpen ? 'rotate-180' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {themeDropdownOpen && (
              <motion.div
                id="topbar-theme-dropdown-menu"
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 mt-2 w-64 p-2.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/80 shadow-2xl z-50 origin-top-right"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="px-2.5 py-1 text-[10px] uppercase font-mono opacity-60 border-b font-bold flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span>视觉主题配色 (THEMES)</span>
                  <Palette className="w-3 h-3" style={{ color: 'var(--theme-primary)' }} />
                </div>

                <div className="space-y-1.5 my-1.5">
                  {themesList.map((th) => {
                    const isSelected = theme === th.id;
                    return (
                      <motion.button
                        key={th.id}
                        id={`topbar-theme-select-${th.id}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setTheme(th.id as any);
                          setThemeDropdownOpen(false);
                          showToast(`已切换主题为「${th.name}」`, 'success');
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs flex flex-col justify-between border transition-all ${
                          isSelected ? 'font-bold ring-2 shadow-sm' : 'hover:opacity-90'
                        }`}
                        style={{
                          background: isSelected ? 'var(--theme-secondary-bg)' : 'var(--bg-surface)',
                          borderColor: isSelected ? 'var(--theme-primary)' : 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-bold text-xs">{th.name}</span>
                          {isSelected && (
                            <span 
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                              style={{ background: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                            >
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] opacity-70 mb-1.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>{th.desc}</p>
                        <div className="flex items-center space-x-1.5">
                          {th.colors.map((c, i) => (
                            <span
                              key={i}
                              className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-inner flex-shrink-0"
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="border-t mt-1 pt-1 text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    onClick={() => {
                      setCurrentTab('SETTINGS');
                      setThemeDropdownOpen(false);
                    }}
                    className="text-[11px] font-bold py-1 w-full hover:underline transition-colors"
                    style={{ color: 'var(--theme-primary)' }}
                  >
                    前往「系统设置」查看详情 →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Action / Primary CTA Button */}
        <div className="relative">
          <motion.button
            id="topbar-quick-action-trigger"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              setQuickMenuOpen(!quickMenuOpen);
              setProjectDropdownOpen(false);
              setThemeDropdownOpen(false);
            }}
            className="flex items-center space-x-1 sm:space-x-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-black shadow-lg hover:opacity-95 transition-all"
            style={{
              backgroundColor: 'var(--theme-primary)',
              color: 'var(--theme-primary-text)',
              boxShadow: 'var(--theme-primary-shadow)',
            }}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span className="hidden sm:inline">{t.common.create}</span>
          </motion.button>

          <AnimatePresence>
            {quickMenuOpen && (
              <motion.div
                id="topbar-quick-action-menu"
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 mt-2 w-48 p-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/80 shadow-2xl z-50 origin-top-right"
              >
                <button
                  id="quick-add-doc"
                  onClick={() => {
                    setCurrentTab('LIBRARY');
                    setQuickMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-black/5 flex items-center space-x-2 font-bold transition-colors"
                >
                  <FileText className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                  <span>{t.home.newDoc}</span>
                </button>
                <button
                  id="quick-add-character"
                  onClick={() => {
                    setCurrentTab('CHARACTERS');
                    setQuickMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-black/5 flex items-center space-x-2 font-bold transition-colors"
                >
                  <UserPlus className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                  <span>{t.home.newChar}</span>
                </button>
                <button
                  id="quick-add-quest"
                  onClick={() => {
                    setCurrentTab('QUESTS');
                    setQuickMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-black/5 flex items-center space-x-2 font-bold transition-colors"
                >
                  <Compass className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                  <span>{t.home.newQuest}</span>
                </button>
                <button
                  id="quick-add-world"
                  onClick={() => {
                    setCurrentTab('WORLD');
                    setQuickMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-black/5 flex items-center space-x-2 font-bold transition-colors"
                >
                  <Globe2 className="w-4 h-4 text-amber-500" />
                  <span>{t.home.newWorld}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
