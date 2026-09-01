import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { HomeView } from './views/HomeView';
import { ProjectsView } from './views/ProjectsView';
import { LibraryView } from './views/LibraryView';
import { CharactersView } from './views/CharactersView';
import { QuestsView } from './views/QuestsView';
import { NarrativeCopyView } from './views/NarrativeCopyView';
import { WorldView } from './views/WorldView';
import { TimelineView } from './views/TimelineView';
import { GraphView } from './views/GraphView';
import { AnalysisView } from './views/AnalysisView';
import { ArchiveView } from './views/ArchiveView';
import { LabView } from './views/LabView';
import { SettingsView } from './views/SettingsView';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const App: React.FC = () => {
  const { currentTab, toasts, removeToast } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('narrative_os_sidebar_collapsed') === 'true';
  });

  const handleToggleCollapse = (val?: boolean) => {
    setSidebarCollapsed((prev) => {
      const next = typeof val === 'boolean' ? val : !prev;
      localStorage.setItem('narrative_os_sidebar_collapsed', String(next));
      return next;
    });
  };

  const renderCurrentView = () => {
    switch (currentTab) {
      case 'HOME':
        return <HomeView />;
      case 'PROJECTS':
        return <ProjectsView />;
      case 'LIBRARY':
        return <LibraryView />;
      case 'CHARACTERS':
        return <CharactersView />;
      case 'QUESTS':
        return <QuestsView />;
      case 'COPY':
        return <NarrativeCopyView />;
      case 'WORLD':
        return <WorldView />;
      case 'TIMELINE':
        return <TimelineView />;
      case 'KNOWLEDGE GRAPH':
        return <GraphView />;
      case 'ANALYSIS':
        return <AnalysisView />;
      case 'ARCHIVE':
        return <ArchiveView />;
      case 'LAB':
        return <LabView />;
      case 'SETTINGS':
        return <SettingsView />;
      default:
        return <HomeView />;
    }
  };

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-[#00FFBF] flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-[#F04E98] flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-cyan-500 flex-shrink-0" />;
    }
  };

  const getToastAccentBorder = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-[#00FFBF]/50 shadow-[0_10px_30px_-5px_rgba(0,255,191,0.25)]';
      case 'error':
        return 'border-[#F04E98]/50 shadow-[0_10px_30px_-5px_rgba(240,78,152,0.25)]';
      case 'warning':
        return 'border-amber-400/50 shadow-[0_10px_30px_-5px_rgba(245,158,11,0.25)]';
      default:
        return 'border-cyan-400/50 shadow-[0_10px_30px_-5px_rgba(6,182,212,0.25)]';
    }
  };

  return (
    <div
      id="narrative-os-app-root"
      className="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-300"
      style={{
        background: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Responsive Sidebar (Handles desktop flex layout & mobile slide-out overlay) */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={handleToggleCollapse}
      />

      {/* Main Workspace Area (Direct flex sibling - NEVER blocked by sidebar) */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
        {/* Ambient Gradient Glows from Vibrant Palette */}
        <div 
          className="absolute top-10 right-10 w-96 h-96 blur-[100px] rounded-full pointer-events-none z-0 transition-all duration-500 animate-pulse" 
          style={{ background: 'var(--ambient-glow-1)', animationDuration: '8s' }}
        />
        <div 
          className="absolute bottom-10 left-10 w-80 h-80 blur-[80px] rounded-full pointer-events-none z-0 transition-all duration-500 animate-pulse" 
          style={{ background: 'var(--ambient-glow-2)', animationDuration: '10s' }}
        />

        {/* Topbar */}
        <Topbar
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => handleToggleCollapse()}
        />

        {/* Dynamic Page Workspace with Smooth Fluid Page Transitions */}
        <main
          id="main-stage-viewport"
          className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-3 sm:p-5 lg:p-7 relative z-10"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="max-w-7xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, y: 10, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                {renderCurrentView()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Global Toast Notifications Stack */}
      <div
        id="global-toast-container"
        className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.92, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 30, scale: 0.9, filter: 'blur(4px)' }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`pointer-events-auto flex items-center justify-between space-x-3 px-4 py-3 rounded-2xl border bg-white/95 backdrop-blur-xl text-[#494949] ${getToastAccentBorder(toast.type)}`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                {getToastIcon(toast.type)}
                <span className="text-xs font-bold text-[#494949] truncate">{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-black/40 hover:text-black/80 hover:bg-black/5 rounded-lg p-1 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;
