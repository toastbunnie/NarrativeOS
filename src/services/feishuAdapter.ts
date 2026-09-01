import { FeishuSettings, FeishuSyncResult, FeishuTableInfo } from '../types';
import { getDB, getAllFromStore, putToStore, deleteFromStore, logActivity, StoreName } from './db';

export const FEISHU_SETTINGS_KEY = 'narrative_os_feishu_config_v2';

export const STANDARD_12_TABLES = [
  { key: 'projects', name: 'Projects', labelZh: '项目 (Projects)' },
  { key: 'sources', name: 'Sources', labelZh: '源文本资料 (Sources)' },
  { key: 'characters', name: 'Characters', labelZh: '人物角色 (Characters)' },
  { key: 'quests', name: 'Quests', labelZh: '任务剧情 (Quests)' },
  { key: 'locations', name: 'Locations', labelZh: '地点世界 (Locations)' },
  { key: 'factions', name: 'Factions', labelZh: '势力阵营 (Factions)' },
  { key: 'items', name: 'Items', labelZh: '物品道具 (Items)' },
  { key: 'events', name: 'Events', labelZh: '大事件时间线 (Events)' },
  { key: 'themes', name: 'Themes', labelZh: '主题母题 (Themes)' },
  { key: 'annotations', name: 'Annotations', labelZh: '批注引用 (Annotations)' },
  { key: 'relationships', name: 'Relationships', labelZh: '人物/势力关系网 (Relationships)' },
  { key: 'analyses', name: 'Analyses', labelZh: '叙事分析 (Analyses)' },
];

export function getStoredFeishuSettings(): FeishuSettings {
  const raw = localStorage.getItem(FEISHU_SETTINGS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        appToken: parsed.appToken || '',
        tableId: parsed.tableId || '',
        tableMapping: parsed.tableMapping || {},
        autoSync: parsed.autoSync ?? false,
        connectionStatus: parsed.connectionStatus || 'unknown',
        tablesStatus: parsed.tablesStatus || {},
        missingTables: parsed.missingTables || [],
        matchedTablesCount: parsed.matchedTablesCount ?? 0,
        totalTablesCount: parsed.totalTablesCount ?? 12,
        lastSyncTime: parsed.lastSyncTime || null,
        lastSyncStatus: parsed.lastSyncStatus || 'idle',
        lastSyncMessage: parsed.lastSyncMessage || '',
        lastError: parsed.lastError || '',
      };
    } catch (e) {}
  }
  return {
    appToken: '',
    tableId: '',
    tableMapping: {},
    autoSync: false,
    connectionStatus: 'unknown',
    tablesStatus: {},
    missingTables: [],
    matchedTablesCount: 0,
    totalTablesCount: 12,
    lastSyncTime: null,
    lastSyncStatus: 'idle',
  };
}

export function saveFeishuSettings(settings: FeishuSettings) {
  // Strict sanitization: ensure no secret is ever saved
  const sanitized: FeishuSettings = {
    appToken: settings.appToken?.trim() || '',
    tableId: settings.tableId?.trim() || '',
    tableMapping: settings.tableMapping || {},
    autoSync: !!settings.autoSync,
    connectionStatus: settings.connectionStatus || 'unknown',
    tablesStatus: settings.tablesStatus || {},
    missingTables: settings.missingTables || [],
    matchedTablesCount: settings.matchedTablesCount ?? 0,
    totalTablesCount: settings.totalTablesCount ?? 12,
    lastSyncTime: settings.lastSyncTime || null,
    lastSyncStatus: settings.lastSyncStatus || 'idle',
    lastSyncMessage: settings.lastSyncMessage || '',
    lastError: settings.lastError || '',
  };
  localStorage.setItem(FEISHU_SETTINGS_KEY, JSON.stringify(sanitized));

  // Purge any legacy keys that might have stored secrets
  localStorage.removeItem('feishu_app_secret');
  localStorage.removeItem('feishu_app_id');
  localStorage.removeItem('narrative_os_feishu_config');
}

/**
 * Tests connection to the Feishu Serverless proxy and automatically discovers all 12 tables.
 */
export async function testFeishuConnection(
  overrideSettings?: Partial<FeishuSettings>
): Promise<{
  success: boolean;
  connectionStatus: FeishuSettings['connectionStatus'];
  message: string;
  tableMapping?: Record<string, string>;
  tablesStatus?: Record<string, FeishuTableInfo>;
  missingTables?: string[];
  matchedCount?: number;
  totalCount?: number;
}> {
  const settings = { ...getStoredFeishuSettings(), ...overrideSettings };

  try {
    const res = await fetch('/api/feishu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'discover_tables',
        appToken: settings.appToken,
        tableId: settings.tableId,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      const msg = data.message || `代理端连接失败 (HTTP ${res.status})`;
      const updated: FeishuSettings = {
        ...settings,
        connectionStatus: (data.connectionStatus || 'error') as any,
        lastError: msg,
      };
      saveFeishuSettings(updated);
      return { success: false, connectionStatus: updated.connectionStatus, message: msg };
    }

    const tableMapping = data.tableMapping || {};
    const tablesStatus = data.tablesStatus || {};
    const missingTables = data.missingTables || [];
    const matchedCount = data.matchedCount ?? Object.keys(tableMapping).length;
    const totalCount = data.totalCount ?? 12;

    const connectionStatus: FeishuSettings['connectionStatus'] =
      matchedCount === totalCount ? 'connected' : matchedCount > 0 ? 'partial' : 'connected';

    const updated: FeishuSettings = {
      ...settings,
      tableMapping,
      tablesStatus,
      missingTables,
      matchedTablesCount: matchedCount,
      totalTablesCount: totalCount,
      connectionStatus,
      lastError: undefined,
    };
    saveFeishuSettings(updated);

    return {
      success: true,
      connectionStatus,
      message: data.message || `已自动匹配 ${matchedCount}/${totalCount} 张数据表`,
      tableMapping,
      tablesStatus,
      missingTables,
      matchedCount,
      totalCount,
    };
  } catch (err: any) {
    const errorMsg = `无法连接 Serverless Proxy 网关: ${err.message || String(err)}`;
    const updated: FeishuSettings = {
      ...settings,
      connectionStatus: 'error',
      lastError: errorMsg,
    };
    saveFeishuSettings(updated);
    return { success: false, connectionStatus: 'error', message: errorMsg };
  }
}

/**
 * Gathers all local entities from IndexedDB into a normalized snapshot array across the 12 domains.
 */
async function gatherAllIndexedDBEntities(): Promise<any[]> {
  const [
    projects,
    documents,
    characters,
    quests,
    locations,
    factions,
    items,
    lore,
    themes,
    events,
    timeline,
    annotations,
    labSessions,
  ] = await Promise.all([
    getAllFromStore('projects'),
    getAllFromStore('documents'),
    getAllFromStore('characters'),
    getAllFromStore('quests'),
    getAllFromStore('locations'),
    getAllFromStore('factions'),
    getAllFromStore('items'),
    getAllFromStore('lore'),
    getAllFromStore('themes'),
    getAllFromStore('events'),
    getAllFromStore('timeline'),
    getAllFromStore('annotations'),
    getAllFromStore('lab_sessions'),
  ]);

  const allItems: any[] = [];

  const addItems = (list: any[], entityType: string) => {
    for (const item of list) {
      if (!item || !item.id) continue;
      allItems.push({
        id: item.id,
        entityType,
        name: item.name || item.title || item.originalId || item.id,
        projectId: item.projectId || '',
        status: item.status || 'active',
        updatedAt: item.updatedAt || item.archivedAt || item.createdAt || Date.now(),
        summary: item.summary || item.description || item.bio || item.coreConcept || item.lore || item.text || '',
        data: item,
      });
    }
  };

  // 1. Projects
  addItems(projects, 'projects');
  // 2. Sources (documents)
  addItems(documents, 'sources');
  // 3. Characters
  addItems(characters, 'characters');
  // 4. Quests
  addItems(quests, 'quests');
  // 5. Locations
  addItems(locations, 'locations');
  // 6. Factions
  addItems(factions, 'factions');
  // 7. Items
  addItems(items, 'items');
  // 8. Events & Timeline
  addItems(events, 'events');
  addItems(timeline, 'events');
  // 9. Themes & Lore
  addItems(themes, 'themes');
  addItems(lore, 'themes');
  // 10. Annotations
  addItems(annotations, 'annotations');

  // 11. Relationships (Synthesized from character and faction relationships)
  for (const char of (characters as any[])) {
    if (Array.isArray(char.relationships)) {
      for (const rel of char.relationships) {
        if (rel && rel.targetId) {
          const relId = `rel_${char.id}_${rel.targetId}`;
          allItems.push({
            id: relId,
            entityType: 'relationships',
            name: `${char.name} ➔ ${rel.targetName || rel.targetId} (${rel.relationType || '关联'})`,
            projectId: char.projectId || '',
            status: 'active',
            updatedAt: char.updatedAt || Date.now(),
            summary: rel.description || `${rel.relationType || '关联'}: 亲密度 ${rel.intimacy || 0}`,
            data: {
              id: relId,
              sourceId: char.id,
              sourceName: char.name,
              targetId: rel.targetId,
              targetName: rel.targetName || rel.targetId,
              relationType: rel.relationType,
              intimacy: rel.intimacy,
              description: rel.description,
              projectId: char.projectId,
              updatedAt: char.updatedAt || Date.now(),
            },
          });
        }
      }
    }
  }

  // 12. Analyses (Lab sessions / AI narrative analysis records)
  addItems(labSessions, 'analyses');

  return allItems;
}

/**
 * Store mapper for remote entities applied to IndexedDB
 */
const TYPE_TO_STORE_MAP: Record<string, StoreName> = {
  projects: 'projects',
  project: 'projects',
  sources: 'documents',
  documents: 'documents',
  document: 'documents',
  characters: 'characters',
  character: 'characters',
  quests: 'quests',
  quest: 'quests',
  locations: 'locations',
  location: 'locations',
  factions: 'factions',
  faction: 'factions',
  items: 'items',
  item: 'items',
  lore: 'lore',
  themes: 'themes',
  theme: 'themes',
  events: 'events',
  event: 'events',
  timeline: 'timeline',
  annotations: 'annotations',
  annotation: 'annotations',
  analyses: 'lab_sessions',
  analysis: 'lab_sessions',
  lab_sessions: 'lab_sessions',
};

/**
 * Performs bi-directional synchronization between local IndexedDB and Feishu Bitable across 12 tables.
 * Gracefully falls back to IndexedDB if Feishu is not configured or network fails.
 */
export async function syncWithFeishuNow(
  onProgress?: (status: string) => void
): Promise<FeishuSyncResult> {
  const settings = getStoredFeishuSettings();

  onProgress?.('正在读取本地 IndexedDB 12 表数据快照...');
  const localEntities = await gatherAllIndexedDBEntities();

  onProgress?.('正在与 Vercel Serverless Proxy 飞书多维表格通信...');
  try {
    const res = await fetch('/api/feishu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'batch_sync',
        appToken: settings.appToken,
        tableId: settings.tableId,
        tableMapping: settings.tableMapping,
        items: localEntities,
        clientLastSyncTime: settings.lastSyncTime || 0,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || `同步网关报错 (HTTP ${res.status})`);
    }

    // Apply remote updates to IndexedDB if any
    let remoteApplied = 0;
    if (data.remoteUpdates && Array.isArray(data.remoteUpdates) && data.remoteUpdates.length > 0) {
      onProgress?.(`正在将 ${data.remoteUpdates.length} 条远端变更应用至本地 IndexedDB...`);
      for (const remoteItem of data.remoteUpdates) {
        const entityType = String(remoteItem.entityType || '').toLowerCase();
        const targetStore = TYPE_TO_STORE_MAP[entityType];
        if (targetStore && remoteItem.id) {
          try {
            await putToStore(targetStore, remoteItem);
            remoteApplied++;
          } catch (e) {
            console.warn('Failed to apply remote record to local IndexedDB:', e);
          }
        }
      }
    }

    const now = Date.now();
    const resultMessage = data.message || `12 表同步成功！新增 ${data.createdCount || 0} 条，更新 ${data.updatedCount || 0} 条，合并远端 ${remoteApplied} 条。`;

    const updatedMapping = data.tableMapping || settings.tableMapping;
    const matchedCount = data.matchedTablesCount ?? Object.keys(updatedMapping).length;
    const missingTables = data.missingTables || [];

    const newConnectionStatus: FeishuSettings['connectionStatus'] =
      matchedCount === 12 ? 'connected' : matchedCount > 0 ? 'partial' : 'connected';

    // Update settings in localStorage
    saveFeishuSettings({
      ...settings,
      tableMapping: updatedMapping,
      matchedTablesCount: matchedCount,
      missingTables,
      connectionStatus: newConnectionStatus,
      lastSyncTime: now,
      lastSyncStatus: missingTables.length > 0 ? 'partial' : 'success',
      lastSyncMessage: resultMessage,
      lastError: undefined,
    });

    await logActivity('FEISHU_SYNC', 'sync', `12 表自动同步 ${localEntities.length} 条本地实体`);

    return {
      success: true,
      message: resultMessage,
      createdCount: data.createdCount || 0,
      updatedCount: data.updatedCount || 0,
      deletedCount: data.deletedCount || 0,
      totalSynced: (data.createdCount || 0) + (data.updatedCount || 0) + remoteApplied,
      conflicts: data.conflicts || [],
      remoteDataCount: data.remoteUpdates?.length || 0,
      perTableResults: data.perTableResults,
      missingTables,
      timestamp: now,
    };
  } catch (err: any) {
    const errorMsg = err.message || '网络连接或飞书同步异常';
    console.warn('Feishu sync failed, continuing seamlessly on IndexedDB:', errorMsg);

    saveFeishuSettings({
      ...settings,
      lastSyncStatus: 'error',
      lastError: errorMsg,
    });

    return {
      success: false,
      message: `飞书同步未完成 (${errorMsg})。NARRATIVE OS 已自动切换为本地 IndexedDB 纯本地模式，所有数据安全完整。`,
      timestamp: Date.now(),
    };
  }
}

/**
 * Targeted background sync for a single entity creation/update
 */
export async function syncEntityToFeishu(entityType: string, entity: any): Promise<boolean> {
  const settings = getStoredFeishuSettings();
  if (!settings.appToken || settings.connectionStatus === 'unconfigured' || settings.connectionStatus === 'error') {
    return false;
  }

  // Check if this entity's table is mapped
  const mappedTableId = settings.tableMapping?.[entityType];
  if (!mappedTableId && !settings.tableId) {
    return false; // Table not mapped, skip quietly to IndexedDB
  }

  try {
    const res = await fetch('/api/feishu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        appToken: settings.appToken,
        tableKey: entityType,
        tableId: mappedTableId || settings.tableId,
        tableMapping: settings.tableMapping,
        entity,
      }),
    });
    const data = await res.json();
    return data.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Targeted background sync for entity deletion
 */
export async function deleteEntityFromFeishu(entityType: string, entityId: string): Promise<boolean> {
  const settings = getStoredFeishuSettings();
  if (!settings.appToken || settings.connectionStatus === 'unconfigured' || settings.connectionStatus === 'error') {
    return false;
  }

  const mappedTableId = settings.tableMapping?.[entityType];
  if (!mappedTableId && !settings.tableId) {
    return false;
  }

  try {
    const res = await fetch('/api/feishu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        appToken: settings.appToken,
        tableKey: entityType,
        tableId: mappedTableId || settings.tableId,
        tableMapping: settings.tableMapping,
        entityId,
      }),
    });
    const data = await res.json();
    return data.ok;
  } catch (e) {
    return false;
  }
}

// Auto-sync debouncer
let autoSyncTimeout: any = null;

export function triggerAutoSyncDebounced(delayMs: number = 3000) {
  const settings = getStoredFeishuSettings();
  if (!settings.autoSync || (settings.connectionStatus !== 'connected' && settings.connectionStatus !== 'partial')) {
    return;
  }

  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }

  autoSyncTimeout = setTimeout(() => {
    syncWithFeishuNow().catch((e) => {
      console.warn('Background auto sync notice:', e);
    });
  }, delayMs);
}
