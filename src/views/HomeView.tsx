import React from 'react';
import {
  FolderKanban,
  BookOpen,
  Users,
  Compass,
  MapPin,
  Network,
  Sparkles,
  ArrowRight,
  PlusCircle,
  FileUp,
  FlaskConical,
  Clock,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const HomeView: React.FC = () => {
  const {
    t,
    projects = [],
    documents = [],
    characters = [],
    quests = [],
    locations = [],
    timeline = [],
    activityLogs = [],
    setCurrentTab,
    setActiveProjectId,
  } = useApp();

  // Compute total relationships
  const totalRelations = (characters || []).reduce((sum, c) => sum + (c?.relationships?.length || 0), 0);

  return (
    <div id="home-view-container" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Welcome Hero Banner */}
      <div
        id="home-welcome-hero"
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 glass-card border shadow-xl"
        style={{
          background: 'var(--bg-surface-glass)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="relative z-10 max-w-2xl">
          <div 
            className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-bold mb-3 border theme-badge-secondary"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" style={{ color: 'var(--theme-primary)' }} />
            <span>NARRATIVE OS · VIBRANT WORKBENCH</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2 uppercase font-display" style={{ color: 'var(--text-primary)' }}>
            {t.home.welcome}
          </h2>
          <p className="text-sm leading-relaxed mb-6 font-medium opacity-80" style={{ color: 'var(--text-secondary)' }}>
            {t.home.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="home-hero-create-project-btn"
              onClick={() => setCurrentTab('PROJECTS')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full font-bold text-xs shadow-lg transition-all active:scale-95 theme-btn-primary"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.home.createFirstProject}</span>
            </button>
            <button
              id="home-hero-import-doc-btn"
              onClick={() => setCurrentTab('LIBRARY')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-full font-bold text-xs border shadow-sm transition-all hover:bg-black/5"
              style={{
                background: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <FileUp className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
              <span>{t.home.newDoc}</span>
            </button>
            <button
              id="home-hero-open-lab-btn"
              onClick={() => setCurrentTab('LAB')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-full font-bold text-xs shadow-sm transition-all"
              style={{
                background: 'var(--theme-sidebar-bg)',
                color: 'var(--theme-sidebar-text)',
              }}
            >
              <FlaskConical className="w-4 h-4" style={{ color: 'var(--theme-secondary)' }} />
              <span>{t.home.openLab}</span>
            </button>
          </div>
        </div>

        {/* Ambient Glows */}
        <div 
          className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-50 transition-all duration-500" 
          style={{ background: 'var(--ambient-glow-1)' }}
        />
        <div 
          className="absolute bottom-0 right-1/4 -mb-16 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-50 transition-all duration-500" 
          style={{ background: 'var(--ambient-glow-2)' }}
        />
      </div>

      {/* KPI Stats Grid */}
      <div id="home-kpi-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Projects KPI */}
        <div
          id="kpi-projects"
          onClick={() => setCurrentTab('PROJECTS')}
          className="glass-card p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="text-[10px] uppercase font-black opacity-70 font-mono" style={{ color: 'var(--text-secondary)' }}>{t.home.stats.projects}</div>
          <div className="text-4xl font-black leading-none my-2 group-hover:scale-105 transition-transform" style={{ color: 'var(--theme-primary)' }}>{projects.length}</div>
          <div 
            className="text-[10px] font-bold px-2 py-0.5 self-start rounded font-mono"
            style={{ background: 'var(--theme-sidebar-bg)', color: 'var(--theme-sidebar-text)' }}
          >
            + ACTIVE
          </div>
        </div>

        {/* Library KPI */}
        <div
          id="kpi-docs"
          onClick={() => setCurrentTab('LIBRARY')}
          className="glass-card p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="text-[10px] uppercase font-black opacity-70 font-mono" style={{ color: 'var(--text-secondary)' }}>{t.home.stats.documents}</div>
          <div className="text-4xl font-black leading-none my-2 group-hover:scale-105 transition-transform" style={{ color: 'var(--text-primary)' }}>{documents.length}</div>
          <div className="h-1.5 w-full rounded-full overflow-hidden mt-1" style={{ background: 'var(--border-subtle)' }}>
            <div className="w-3/4 h-full" style={{ background: 'var(--theme-secondary)' }} />
          </div>
        </div>

        {/* Characters KPI */}
        <div
          id="kpi-chars"
          onClick={() => setCurrentTab('CHARACTERS')}
          className="glass-card p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="text-[10px] uppercase font-black opacity-70 font-mono" style={{ color: 'var(--text-secondary)' }}>{t.home.stats.characters}</div>
          <div className="text-4xl font-black leading-none my-2 group-hover:scale-105 transition-transform" style={{ color: 'var(--text-primary)' }}>{characters.length}</div>
          <div className="flex -space-x-2 mt-1">
            <div className="w-5 h-5 rounded-full border border-white flex-shrink-0" style={{ background: 'var(--theme-primary)' }} />
            <div className="w-5 h-5 rounded-full border border-white flex-shrink-0" style={{ background: 'var(--theme-secondary)' }} />
            <div className="w-5 h-5 rounded-full border border-white flex-shrink-0" style={{ background: 'var(--theme-sidebar-bg)' }} />
          </div>
        </div>

        {/* Quests KPI */}
        <div
          id="kpi-quests"
          onClick={() => setCurrentTab('QUESTS')}
          className="glass-card p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="text-[10px] uppercase font-black opacity-70 font-mono" style={{ color: 'var(--text-secondary)' }}>{t.home.stats.quests}</div>
          <div className="text-4xl font-black leading-none my-2 group-hover:scale-105 transition-transform" style={{ color: 'var(--text-primary)' }}>{quests.length}</div>
          <div className="text-[10px] font-bold font-mono" style={{ color: 'var(--theme-primary)' }}>
            {(quests || []).filter(q => q && q.status === 'in_progress').length || quests.length} ACTIVE
          </div>
        </div>

        {/* Locations KPI */}
        <div
          id="kpi-locations"
          onClick={() => setCurrentTab('WORLD')}
          className="glass-card p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="text-[10px] uppercase font-black opacity-70 font-mono" style={{ color: 'var(--text-secondary)' }}>{t.home.stats.locations}</div>
          <div className="text-4xl font-black leading-none my-2 group-hover:scale-105 transition-transform" style={{ color: 'var(--text-primary)' }}>{locations.length}</div>
          <div className="h-1.5 w-full rounded-full overflow-hidden mt-1" style={{ background: 'var(--border-subtle)' }}>
            <div className="w-2/3 h-full" style={{ background: 'var(--theme-primary)' }} />
          </div>
        </div>

        {/* Relations KPI */}
        <div
          id="kpi-relations"
          onClick={() => setCurrentTab('KNOWLEDGE GRAPH')}
          className="glass-card p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="text-[10px] uppercase font-black opacity-70 font-mono" style={{ color: 'var(--text-secondary)' }}>{t.home.stats.relationships}</div>
          <div className="text-4xl font-black leading-none my-2 group-hover:scale-105 transition-transform" style={{ color: 'var(--theme-primary)' }}>{totalRelations}</div>
          <div 
            className="text-[10px] font-bold px-2 py-0.5 self-start rounded font-mono"
            style={{ background: 'var(--theme-sidebar-bg)', color: 'var(--theme-sidebar-text)' }}
          >
            GRAPH
          </div>
        </div>
      </div>

      {/* Main Content Grid: Recent Projects & Narrative Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recent Projects Card */}
        <div
          id="home-recent-projects-card"
          className="glass-card rounded-3xl p-6 shadow-xl relative overflow-hidden"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-sm uppercase tracking-wider font-mono" style={{ color: 'var(--text-primary)' }}>
              Recent Projects / {t.home.recentProjects}
            </h3>
            <button
              id="home-view-all-projects-btn"
              onClick={() => setCurrentTab('PROJECTS')}
              className="text-[10px] font-bold uppercase hover:underline"
              style={{ color: 'var(--theme-primary)' }}
            >
              VIEW ALL
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="py-10 text-center rounded-2xl border border-dashed" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <FolderKanban className="w-10 h-10 opacity-40 mx-auto mb-2" />
              <p className="text-xs opacity-70 mb-3" style={{ color: 'var(--text-secondary)' }}>{t.home.noRecentProjects}</p>
              <button
                id="home-empty-create-project-btn"
                onClick={() => setCurrentTab('PROJECTS')}
                className="px-4 py-2 rounded-full text-xs font-bold shadow-md theme-btn-primary active:scale-95"
              >
                + {t.projects.newProject}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 4).map((proj, idx) => (
                <div
                  key={proj.id}
                  id={`home-project-item-${proj.id}`}
                  onClick={() => {
                    setActiveProjectId(proj.id);
                    setCurrentTab('LIBRARY');
                  }}
                  className={`flex items-center gap-4 p-3.5 rounded-2xl cursor-pointer transition-all border ${
                    idx === 0
                      ? 'shadow-sm hover:shadow-md'
                      : 'hover:bg-black/5'
                  }`}
                  style={{
                    background: idx === 0 ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    borderColor: idx === 0 ? 'var(--theme-primary)' : 'var(--border-subtle)',
                  }}
                >
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 text-sm shadow-inner"
                    style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-primary)' }}
                  >
                    {proj.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 truncate">
                    <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{proj.name}</div>
                    <div className="text-[10px] uppercase truncate opacity-70" style={{ color: 'var(--text-secondary)' }}>
                      {proj.type} · {proj.description || 'Updated recently'}
                    </div>
                  </div>
                  <span 
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                  >
                    {t.projects.statuses[proj.status] || proj.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Narrative Analysis Card */}
        <div
          id="home-narrative-analysis-card"
          className="rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between"
          style={{
            background: 'var(--theme-sidebar-bg)',
            color: 'var(--theme-sidebar-text)',
          }}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl pointer-events-none select-none">
            DATA
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: 'var(--theme-sidebar-accent)' }}>
                Narrative Analysis / 叙事统计
              </h3>
              <button
                id="home-run-deep-analysis-btn"
                onClick={() => setCurrentTab('ANALYSIS')}
                className="text-[10px] font-bold hover:underline"
                style={{ color: 'var(--theme-primary)' }}
              >
                DETAILS →
              </button>
            </div>

            <div className="space-y-5 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase opacity-70 font-bold">Dialogue Ratio / 对白占比</div>
                  <div className="text-2xl font-black">
                    {documents.length > 0 ? '42.5%' : '0%'}
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div className="h-full w-[42%]" style={{ background: 'var(--theme-primary)' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] uppercase opacity-70 font-bold">Conflict Density / 冲突密度</div>
                  <div className="text-2xl font-black" style={{ color: 'var(--theme-secondary)' }}>
                    {quests.length > 0 ? 'High' : 'Normal'}
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div className="h-full w-[88%]" style={{ background: 'var(--theme-secondary)' }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase opacity-70 font-bold">Worldbuilding / 世界观覆盖</div>
                  <div className="text-lg font-bold">
                    {Math.min(100, (locations.length * 15 + characters.length * 10))}%
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div
                      className="h-full"
                      style={{ 
                        width: `${Math.min(100, (locations.length * 15 + characters.length * 10))}%`,
                        background: 'var(--theme-primary)',
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] uppercase opacity-70 font-bold">Timeline Causal / 时序因果</div>
                  <div className="text-lg font-bold">
                    {timeline.length > 0 ? Math.min(100, timeline.length * 20) : 0}%
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div
                      className="h-full"
                      style={{ 
                        width: `${timeline.length > 0 ? Math.min(100, timeline.length * 20) : 0}%`,
                        background: 'var(--theme-secondary)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                <div className="text-[10px] uppercase opacity-70 mb-2 font-bold">Core Themes / 核心标签</div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.12)' }}>CYBERPUNK</span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-md theme-btn-primary">IDENTITY</span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.12)' }}>REVENGE</span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold theme-badge-secondary">TECHNOLOGY</span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.12)' }}>LOSS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log & Recent Documents Sub-grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents Card */}
        <div id="home-recent-docs-card" className="glass-card rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
              <h3 className="font-bold text-sm uppercase font-display" style={{ color: 'var(--text-primary)' }}>{t.home.recentDocs}</h3>
            </div>
            <button
              id="home-view-all-docs-btn"
              onClick={() => setCurrentTab('LIBRARY')}
              className="text-[10px] font-bold uppercase hover:underline"
              style={{ color: 'var(--theme-primary)' }}
            >
              VIEW ALL
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="py-8 text-center rounded-2xl border border-dashed" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <BookOpen className="w-8 h-8 opacity-40 mx-auto mb-2" />
              <p className="text-xs opacity-70 mb-2" style={{ color: 'var(--text-secondary)' }}>{t.common.empty}</p>
              <button
                id="home-empty-import-doc-btn"
                onClick={() => setCurrentTab('LIBRARY')}
                className="px-3 py-1.5 rounded-full font-bold text-xs border theme-badge-secondary"
              >
                + {t.library.importDoc}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.slice(0, 4).map((doc) => (
                <div
                  key={doc.id}
                  id={`home-doc-item-${doc.id}`}
                  onClick={() => setCurrentTab('LIBRARY')}
                  className="p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all shadow-sm hover:bg-black/5"
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
                      style={{
                        background: 'var(--theme-secondary-bg)',
                        color: 'var(--theme-primary)',
                        borderColor: 'var(--theme-secondary-border)',
                      }}
                    >
                      {doc.fileType}
                    </span>
                    <span className="text-xs truncate font-bold" style={{ color: 'var(--text-primary)' }}>{doc?.title || doc?.name || '未命名资料'}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] font-mono flex-shrink-0 font-medium opacity-70" style={{ color: 'var(--text-secondary)' }}>
                    <span>{doc.metadata?.wordCount || 0} 字</span>
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div id="home-activity-log-card" className="glass-card rounded-3xl p-6 shadow-xl">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
            <h3 className="font-bold text-sm uppercase font-display" style={{ color: 'var(--text-primary)' }}>{t.home.recentActivity}</h3>
          </div>

          {activityLogs.length === 0 ? (
            <p className="text-xs opacity-60 text-center py-8" style={{ color: 'var(--text-secondary)' }}>{t.home.noActivity}</p>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
              {activityLogs.slice(0, 6).map((act) => (
                <div 
                  key={act.id} 
                  className="flex items-start space-x-2.5 text-xs p-2.5 rounded-xl border"
                  style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--theme-secondary)' }} />
                  <div className="truncate flex-1">
                    <p className="truncate font-medium">
                      <span className="font-mono text-[10px] font-bold mr-1.5" style={{ color: 'var(--theme-primary)' }}>[{act.action}]</span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{act.entityName}</span>
                    </p>
                    <p className="text-[10px] font-mono opacity-60" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
