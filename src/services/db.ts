import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
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
  LabSession,
  ActivityLog,
  AISettings,
  FeishuSettings,
} from '../types';

interface NarrativeOSDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-status': string; 'by-updated': number };
  };
  documents: {
    key: string;
    value: LibraryDocument;
    indexes: { 'by-project': string; 'by-category': string };
  };
  characters: {
    key: string;
    value: Character;
    indexes: { 'by-project': string };
  };
  quests: {
    key: string;
    value: Quest;
    indexes: { 'by-project': string; 'by-status': string };
  };
  quest_steps: {
    key: string;
    value: QuestStep;
    indexes: { 'by-project': string; 'by-quest': string; 'by-order': number };
  };
  quest_connections: {
    key: string;
    value: QuestConnection;
    indexes: { 'by-project': string; 'by-quest': string; 'by-from': string; 'by-to': string };
  };
  narrative_copy: {
    key: string;
    value: NarrativeCopy;
    indexes: { 'by-project': string; 'by-type': string; 'by-status': string };
  };
  storyboards: {
    key: string;
    value: Storyboard;
    indexes: { 'by-project': string; 'by-quest': string };
  };
  av_requirements: {
    key: string;
    value: AVRequirement;
    indexes: { 'by-project': string; 'by-quest': string; 'by-type': string; 'by-status': string; 'by-level': string };
  };
  performance_scripts: {
    key: string;
    value: PerformanceScript;
    indexes: { 'by-project': string; 'by-quest': string };
  };
  locations: {
    key: string;
    value: WorldLocation;
    indexes: { 'by-project': string };
  };
  factions: {
    key: string;
    value: WorldFaction;
    indexes: { 'by-project': string };
  };
  items: {
    key: string;
    value: WorldItem;
    indexes: { 'by-project': string };
  };
  lore: {
    key: string;
    value: WorldLore;
    indexes: { 'by-project': string; 'by-category': string };
  };
  themes: {
    key: string;
    value: WorldTheme;
    indexes: { 'by-project': string };
  };
  events: {
    key: string;
    value: WorldEvent;
    indexes: { 'by-project': string };
  };
  timeline: {
    key: string;
    value: TimelineEvent;
    indexes: { 'by-project': string; 'by-order': number };
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-project': string; 'by-source': string; 'by-type': string };
  };
  archive: {
    key: string;
    value: ArchiveRecord;
    indexes: { 'by-type': string; 'by-project': string };
  };
  analyses: {
    key: string;
    value: any;
    indexes: { 'by-project': string };
  };
  lab_sessions: {
    key: string;
    value: LabSession;
    indexes: { 'by-project': string };
  };
  activity_logs: {
    key: string;
    value: ActivityLog;
    indexes: { 'by-timestamp': number };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'NarrativeOS_DB_v1';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<NarrativeOSDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<NarrativeOSDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NarrativeOSDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-status', 'status');
          projectStore.createIndex('by-updated', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('by-project', 'projectId');
          docStore.createIndex('by-category', 'category');
        }

        if (!db.objectStoreNames.contains('characters')) {
          const charStore = db.createObjectStore('characters', { keyPath: 'id' });
          charStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('quests')) {
          const questStore = db.createObjectStore('quests', { keyPath: 'id' });
          questStore.createIndex('by-project', 'projectId');
          questStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('quest_steps')) {
          const stepStore = db.createObjectStore('quest_steps', { keyPath: 'id' });
          stepStore.createIndex('by-project', 'projectId');
          stepStore.createIndex('by-quest', 'questId');
          stepStore.createIndex('by-order', 'orderIndex');
        }

        if (!db.objectStoreNames.contains('quest_connections')) {
          const connStore = db.createObjectStore('quest_connections', { keyPath: 'id' });
          connStore.createIndex('by-project', 'projectId');
          connStore.createIndex('by-quest', 'questId');
          connStore.createIndex('by-from', 'fromStepId');
          connStore.createIndex('by-to', 'toStepId');
        }

        if (!db.objectStoreNames.contains('narrative_copy')) {
          const copyStore = db.createObjectStore('narrative_copy', { keyPath: 'id' });
          copyStore.createIndex('by-project', 'projectId');
          copyStore.createIndex('by-type', 'type');
          copyStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('storyboards')) {
          const sbStore = db.createObjectStore('storyboards', { keyPath: 'id' });
          sbStore.createIndex('by-project', 'projectId');
          sbStore.createIndex('by-quest', 'questId');
        }

        if (!db.objectStoreNames.contains('av_requirements')) {
          const avStore = db.createObjectStore('av_requirements', { keyPath: 'id' });
          avStore.createIndex('by-project', 'projectId');
          avStore.createIndex('by-quest', 'questId');
          avStore.createIndex('by-type', 'type');
          avStore.createIndex('by-status', 'status');
          avStore.createIndex('by-level', 'level');
        }

        if (!db.objectStoreNames.contains('performance_scripts')) {
          const scriptStore = db.createObjectStore('performance_scripts', { keyPath: 'id' });
          scriptStore.createIndex('by-project', 'projectId');
          scriptStore.createIndex('by-quest', 'questId');
        }

        if (!db.objectStoreNames.contains('locations')) {
          const locStore = db.createObjectStore('locations', { keyPath: 'id' });
          locStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('factions')) {
          const factionStore = db.createObjectStore('factions', { keyPath: 'id' });
          factionStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('lore')) {
          const loreStore = db.createObjectStore('lore', { keyPath: 'id' });
          loreStore.createIndex('by-project', 'projectId');
          loreStore.createIndex('by-category', 'category');
        }

        if (!db.objectStoreNames.contains('themes')) {
          const themeStore = db.createObjectStore('themes', { keyPath: 'id' });
          themeStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('timeline')) {
          const timelineStore = db.createObjectStore('timeline', { keyPath: 'id' });
          timelineStore.createIndex('by-project', 'projectId');
          timelineStore.createIndex('by-order', 'orderIndex');
        }

        if (!db.objectStoreNames.contains('annotations')) {
          const annotStore = db.createObjectStore('annotations', { keyPath: 'id' });
          annotStore.createIndex('by-project', 'projectId');
          annotStore.createIndex('by-source', 'sourceId');
          annotStore.createIndex('by-type', 'type');
        }

        if (!db.objectStoreNames.contains('archive')) {
          const archiveStore = db.createObjectStore('archive', { keyPath: 'id' });
          archiveStore.createIndex('by-type', 'entityType');
          archiveStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('analyses')) {
          const analysisStore = db.createObjectStore('analyses', { keyPath: 'id' });
          analysisStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('lab_sessions')) {
          const labStore = db.createObjectStore('lab_sessions', { keyPath: 'id' });
          labStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('activity_logs')) {
          const actStore = db.createObjectStore('activity_logs', { keyPath: 'id' });
          actStore.createIndex('by-timestamp', 'timestamp');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

export type StoreName = 
  | 'projects'
  | 'documents'
  | 'characters'
  | 'quests'
  | 'quest_steps'
  | 'quest_connections'
  | 'narrative_copy'
  | 'storyboards'
  | 'av_requirements'
  | 'performance_scripts'
  | 'locations'
  | 'factions'
  | 'items'
  | 'lore'
  | 'themes'
  | 'events'
  | 'timeline'
  | 'annotations'
  | 'archive'
  | 'analyses'
  | 'lab_sessions'
  | 'activity_logs';

export async function getAllFromStore<T>(storeName: StoreName, projectId?: string): Promise<T[]> {
  const db = await getDB();
  const all = await db.getAll(storeName as any);
  if (!all) return [];
  if (!projectId || storeName === 'projects' || storeName === 'activity_logs' || storeName === 'archive') {
    return all as T[];
  }
  return (all as any[]).filter((item) => !item || !item.projectId || item.projectId === projectId) as T[];
}

export async function getByIdFromStore<T>(storeName: StoreName, id: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(storeName as any, id) as Promise<T | undefined>;
}

export async function putToStore<T extends { id: string }>(storeName: StoreName, item: T): Promise<string> {
  const db = await getDB();
  await db.put(storeName as any, item);
  return item.id;
}

export async function deleteFromStore(storeName: StoreName, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(storeName as any, id);
}

export async function logActivity(action: string, entityType: string, entityName: string, projectId?: string) {
  const db = await getDB();
  const log: ActivityLog = {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    projectId,
    action,
    entityType,
    entityName,
    timestamp: Date.now(),
  };
  await db.put('activity_logs', log);
}

export async function archiveEntity(
  entityType: ArchiveRecord['entityType'],
  item: { id: string; projectId?: string; name?: string; title?: string },
  reason?: string
): Promise<string> {
  const db = await getDB();
  const archiveId = 'arch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const record: ArchiveRecord = {
    id: archiveId,
    entityType,
    originalId: item.id,
    projectId: item.projectId || '',
    title: item.name || item.title || item.id,
    data: item,
    archivedAt: Date.now(),
    reason: reason || 'User manual archive',
  };

  await db.put('archive', record);

  const targetStoreMap: Record<string, StoreName> = {
    project: 'projects',
    document: 'documents',
    character: 'characters',
    quest: 'quests',
    quest_step: 'quest_steps',
    quest_connection: 'quest_connections',
    narrative_copy: 'narrative_copy',
    storyboard: 'storyboards',
    av_requirement: 'av_requirements',
    performance_script: 'performance_scripts',
    location: 'locations',
    faction: 'factions',
    item: 'items',
    lore: 'lore',
    theme: 'themes',
    event: 'events',
    timeline: 'timeline',
  };

  const targetStore = targetStoreMap[entityType];
  if (targetStore) {
    await db.delete(targetStore as any, item.id);
  }

  await logActivity('ARCHIVE', entityType, record.title, item.projectId);
  return archiveId;
}

export async function restoreArchivedEntity(archiveId: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('archive', archiveId);
  if (!record) throw new Error('Archived record not found: ' + archiveId);

  const targetStoreMap: Record<string, StoreName> = {
    project: 'projects',
    document: 'documents',
    character: 'characters',
    quest: 'quests',
    quest_step: 'quest_steps',
    quest_connection: 'quest_connections',
    narrative_copy: 'narrative_copy',
    storyboard: 'storyboards',
    av_requirement: 'av_requirements',
    performance_script: 'performance_scripts',
    location: 'locations',
    faction: 'factions',
    item: 'items',
    lore: 'lore',
    theme: 'themes',
    event: 'events',
    timeline: 'timeline',
  };

  const targetStore = targetStoreMap[record.entityType];
  if (targetStore) {
    await db.put(targetStore as any, record.data);
  }

  await db.delete('archive', archiveId);
  await logActivity('RESTORE', record.entityType, record.title, record.projectId);
}

export async function permanentlyDeleteArchive(archiveId: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('archive', archiveId);
  if (record) {
    await db.delete('archive', archiveId);
    await logActivity('PERMANENT_DELETE', record.entityType, record.title, record.projectId);
  }
}

export async function clearAllArchives(): Promise<void> {
  const db = await getDB();
  await db.clear('archive');
}

// Database Export & Import
export async function exportAllDatabase(): Promise<string> {
  const db = await getDB();
  const stores: StoreName[] = [
    'projects',
    'documents',
    'characters',
    'quests',
    'quest_steps',
    'quest_connections',
    'narrative_copy',
    'storyboards',
    'av_requirements',
    'performance_scripts',
    'locations',
    'factions',
    'items',
    'lore',
    'themes',
    'events',
    'timeline',
    'annotations',
    'archive',
    'lab_sessions',
    'activity_logs',
  ];

  const exportObj: Record<string, any> = {
    app: 'NARRATIVE_OS',
    version: '2.5.0',
    exportedAt: new Date().toISOString(),
    stores: {},
  };

  for (const store of stores) {
    exportObj.stores[store] = await db.getAll(store as any);
  }

  return JSON.stringify(exportObj, null, 2);
}

export async function importAllDatabase(jsonString: string): Promise<{ success: boolean; counts: Record<string, number> }> {
  const data = JSON.parse(jsonString);
  if (!data.stores) {
    throw new Error('Invalid Narrative OS database backup format');
  }

  const db = await getDB();
  const counts: Record<string, number> = {};

  for (const [storeName, items] of Object.entries(data.stores)) {
    if (Array.isArray(items)) {
      const tx = db.transaction(storeName as any, 'readwrite');
      const store = tx.objectStore(storeName as any);
      for (const item of items) {
        await store.put(item);
      }
      await tx.done;
      counts[storeName] = items.length;
    }
  }

  return { success: true, counts };
}

export async function clearEntireDatabase(): Promise<void> {
  const db = await getDB();
  const stores: StoreName[] = [
    'projects',
    'documents',
    'characters',
    'quests',
    'quest_steps',
    'quest_connections',
    'narrative_copy',
    'storyboards',
    'av_requirements',
    'performance_scripts',
    'locations',
    'factions',
    'items',
    'lore',
    'themes',
    'events',
    'timeline',
    'annotations',
    'archive',
    'lab_sessions',
    'activity_logs',
  ];

  for (const store of stores) {
    await db.clear(store as any);
  }
}
