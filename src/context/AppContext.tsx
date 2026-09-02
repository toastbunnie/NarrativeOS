import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AppTheme,
  AppLanguage,
  NavTab,
  Project,
  LibraryDocument,
  Character,
  Quest,
  QuestStep,
  QuestConnection,
  NarrativeCopy,
  Storyboard,
  AVRequirement,
  PerformanceScript,
  WorldLocation,
  WorldFaction,
  WorldItem,
  WorldLore,
  WorldTheme,
  WorldEvent,
  TimelineEvent,
  Annotation,
  ArchiveRecord,
  AnalysisRecord,
  ActivityLog,
  AISettings,
  FeishuSettings,
} from '../types';
import { i18n } from '../i18n/translations';
import { getAllFromStore, getDB } from '../services/db';
import { getStoredAISettings, saveAISettings } from '../services/aiService';
import { getStoredFeishuSettings, saveFeishuSettings } from '../services/feishuSync';

export interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface AnalysisTarget {
  entityType: 'character' | 'quest' | 'location' | 'faction' | 'event' | 'theme' | 'document' | 'copy';
  entityId: string;
  entityName: string;
  extra?: any;
}

interface AppContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: typeof i18n['zh'];
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  
  // Data state
  projects: Project[];
  documents: LibraryDocument[];
  characters: Character[];
  quests: Quest[];
  questSteps: QuestStep[];
  questConnections: QuestConnection[];
  narrativeCopies: NarrativeCopy[];
  narrativeCopy: NarrativeCopy[];
  storyboards: Storyboard[];
  avRequirements: AVRequirement[];
  performanceScripts: PerformanceScript[];
  locations: WorldLocation[];
  factions: WorldFaction[];
  items: WorldItem[];
  lore: WorldLore[];
  themes: WorldTheme[];
  events: WorldEvent[];
  timeline: TimelineEvent[];
  annotations: Annotation[];
  archiveRecords: ArchiveRecord[];
  archives: ArchiveRecord[];
  analyses: AnalysisRecord[];
  activityLogs: ActivityLog[];
  
  // Settings
  aiSettings: AISettings;
  updateAISettings: (settings: Partial<AISettings>) => void;
  feishuSettings: FeishuSettings;
  updateFeishuSettings: (settings: Partial<FeishuSettings>) => void;

  // Search & Navigation
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  analysisTarget: AnalysisTarget | null;
  setAnalysisTarget: (target: AnalysisTarget | null) => void;
  navigateToAnalysis: (target: AnalysisTarget) => void;
  
  // Toast notifications
  toasts: ToastInfo[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Actions
  refreshData: () => Promise<void>;
  loading: boolean;
  selectedDocForLab?: LibraryDocument;
  setSelectedDocForLab: (doc?: LibraryDocument) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    return (localStorage.getItem('narrative_os_theme') as AppTheme) || 'sunshine-greentea';
  });

  const [language, setLanguageState] = useState<AppLanguage>(() => {
    return (localStorage.getItem('narrative_os_lang') as AppLanguage) || 'zh';
  });

  const [currentTab, setCurrentTab] = useState<NavTab>('HOME');
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    return localStorage.getItem('narrative_os_active_project') || null;
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [questSteps, setQuestSteps] = useState<QuestStep[]>([]);
  const [questConnections, setQuestConnections] = useState<QuestConnection[]>([]);
  const [narrativeCopies, setNarrativeCopies] = useState<NarrativeCopy[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [avRequirements, setAVRequirements] = useState<AVRequirement[]>([]);
  const [performanceScripts, setPerformanceScripts] = useState<PerformanceScript[]>([]);
  const [locations, setLocations] = useState<WorldLocation[]>([]);
  const [factions, setFactions] = useState<WorldFaction[]>([]);
  const [items, setItems] = useState<WorldItem[]>([]);
  const [lore, setLore] = useState<WorldLore[]>([]);
  const [themes, setThemes] = useState<WorldTheme[]>([]);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [archiveRecords, setArchiveRecords] = useState<ArchiveRecord[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const [aiSettings, setAISettingsState] = useState<AISettings>(getStoredAISettings);
  const [feishuSettings, setFeishuSettingsState] = useState<FeishuSettings>(getStoredFeishuSettings);
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisTarget, setAnalysisTarget] = useState<AnalysisTarget | null>(null);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDocForLab, setSelectedDocForLab] = useState<LibraryDocument | undefined>(undefined);

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('narrative_os_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('narrative_os_lang', lang);
  };

  const setActiveProjectId = (id: string | null) => {
    setActiveProjectIdState(id);
    if (id) {
      localStorage.setItem('narrative_os_active_project', id);
    } else {
      localStorage.removeItem('narrative_os_active_project');
    }
  };

  const navigateToAnalysis = (target: AnalysisTarget) => {
    setAnalysisTarget(target);
    setCurrentTab('ANALYSIS');
  };

  const updateAISettings = (newSettings: Partial<AISettings>) => {
    const updated = { ...aiSettings, ...newSettings };
    setAISettingsState(updated);
    saveAISettings(updated);
  };

  const updateFeishuSettings = (newSettings: Partial<FeishuSettings>) => {
    const updated = { ...feishuSettings, ...newSettings };
    setFeishuSettingsState(updated);
    saveFeishuSettings(updated);
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await getDB();
      const [
        p,
        d,
        c,
        q,
        steps,
        conns,
        copies,
        sbs,
        avs,
        pscripts,
        loc,
        fac,
        it,
        lr,
        th,
        ev,
        tl,
        an,
        ar,
        ana,
        al,
      ] = await Promise.all([
        getAllFromStore<Project>('projects'),
        getAllFromStore<LibraryDocument>('documents', activeProjectId || undefined),
        getAllFromStore<Character>('characters', activeProjectId || undefined),
        getAllFromStore<Quest>('quests', activeProjectId || undefined),
        getAllFromStore<QuestStep>('quest_steps', activeProjectId || undefined),
        getAllFromStore<QuestConnection>('quest_connections', activeProjectId || undefined),
        getAllFromStore<NarrativeCopy>('narrative_copy', activeProjectId || undefined),
        getAllFromStore<Storyboard>('storyboards', activeProjectId || undefined),
        getAllFromStore<AVRequirement>('av_requirements', activeProjectId || undefined),
        getAllFromStore<PerformanceScript>('performance_scripts', activeProjectId || undefined),
        getAllFromStore<WorldLocation>('locations', activeProjectId || undefined),
        getAllFromStore<WorldFaction>('factions', activeProjectId || undefined),
        getAllFromStore<WorldItem>('items', activeProjectId || undefined),
        getAllFromStore<WorldLore>('lore', activeProjectId || undefined),
        getAllFromStore<WorldTheme>('themes', activeProjectId || undefined),
        getAllFromStore<WorldEvent>('events', activeProjectId || undefined),
        getAllFromStore<TimelineEvent>('timeline', activeProjectId || undefined),
        getAllFromStore<Annotation>('annotations', activeProjectId || undefined),
        getAllFromStore<ArchiveRecord>('archive'),
        getAllFromStore<AnalysisRecord>('analyses', activeProjectId || undefined),
        getAllFromStore<ActivityLog>('activity_logs'),
      ]);

      setProjects(p.sort((a, b) => b.updatedAt - a.updatedAt));
      setDocuments(d.sort((a, b) => b.updatedAt - a.updatedAt));
      setCharacters(c.sort((a, b) => b.updatedAt - a.updatedAt));
      setQuests(q.sort((a, b) => b.updatedAt - a.updatedAt));
      setQuestSteps(steps.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)));
      setQuestConnections(conns.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)));
      setNarrativeCopies(copies.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
      setStoryboards(sbs.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
      setAVRequirements(avs.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
      setPerformanceScripts(pscripts.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
      setLocations(loc.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
      setFactions(fac.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
      setItems(it.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
      setLore(lr.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
      setThemes(th.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
      setEvents(ev.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
      setTimeline(tl.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)));
      setAnnotations(an.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
      setArchiveRecords(ar.sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)));
      setAnalyses(ana.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
      setActivityLogs(al.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 30));
    } catch (err) {
      console.error('Failed to load database state:', err);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    refreshData();
  }, [theme, activeProjectId, refreshData]);

  const t = i18n[language] || i18n.zh;

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        language,
        setLanguage,
        t,
        currentTab,
        setCurrentTab,
        activeProjectId,
        setActiveProjectId,
        projects,
        documents,
        characters,
        quests,
        questSteps,
        questConnections,
        narrativeCopies,
        narrativeCopy: narrativeCopies,
        storyboards,
        avRequirements,
        performanceScripts,
        locations,
        factions,
        items,
        lore,
        themes,
        events,
        timeline,
        annotations,
        archiveRecords,
        archives: archiveRecords,
        analyses,
        activityLogs,
        aiSettings,
        updateAISettings,
        feishuSettings,
        updateFeishuSettings,
        searchQuery,
        setSearchQuery,
        analysisTarget,
        setAnalysisTarget,
        navigateToAnalysis,
        toasts,
        showToast,
        removeToast,
        refreshData,
        loading,
        selectedDocForLab,
        setSelectedDocForLab,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
