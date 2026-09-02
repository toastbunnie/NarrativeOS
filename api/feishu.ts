import type { IncomingMessage, ServerResponse } from 'http';

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;

// The Standard Tables in NARRATIVE OS
export interface StandardTableDefinition {
  key: string;
  name: string;
  labelZh: string;
  aliases: string[];
}

export const STANDARD_TABLES: StandardTableDefinition[] = [
  { key: 'projects', name: 'Projects', labelZh: '项目 (Projects)', aliases: ['projects', 'project', '项目', '项目表', '剧本项目'] },
  { key: 'sources', name: 'Sources', labelZh: '源文本资料 (Sources)', aliases: ['sources', 'source', 'documents', 'document', '源文本', '资料库', '文档', '源文本资料', '文献'] },
  { key: 'characters', name: 'Characters', labelZh: '人物角色 (Characters)', aliases: ['characters', 'character', '人物', '角色', '人物角色', '人物表', '登场人物'] },
  { key: 'quests', name: 'Quests', labelZh: '任务剧情 (Quests)', aliases: ['quests', 'quest', '任务', '剧情', '任务剧情', '剧情线索', '任务表'] },
  { key: 'storyboards', name: 'Storyboards', labelZh: '分镜脚本 (Storyboards)', aliases: ['storyboards', 'storyboard', '分镜', '分镜脚本', '分镜表', '镜头脚本', 'shot_list', 'shotlist'] },
  { key: 'av_requirements', name: 'AV Requirements', labelZh: '音美需求 (AV Requirements)', aliases: ['av_requirements', 'av_requirement', 'avrequirements', '音美', '音美需求', '音频', '美术', 'sound_design', 'art_requirement'] },
  { key: 'performance_scripts', name: 'Performance Scripts', labelZh: '演出剧本 (Performance Scripts)', aliases: ['performance_scripts', 'performance_script', '演出剧本', '剧本', 'scripts', 'script', 'dialogue_script', '表演剧本'] },
  { key: 'locations', name: 'Locations', labelZh: '地点世界 (Locations)', aliases: ['locations', 'location', '地点', '场景', '世界观', '空间地点', '地理设定'] },
  { key: 'factions', name: 'Factions', labelZh: '势力阵营 (Factions)', aliases: ['factions', 'faction', '势力', '阵营', '组织', '门派', '组织势力'] },
  { key: 'items', name: 'Items', labelZh: '物品道具 (Items)', aliases: ['items', 'item', '物品', '道具', '宝物', '法宝', '关键道具'] },
  { key: 'events', name: 'Events', labelZh: '大事件时间线 (Events)', aliases: ['events', 'event', 'timeline', '事件', '时间线', '大事件', '历史节点', '事件表'] },
  { key: 'themes', name: 'Themes', labelZh: '主题母题 (Themes)', aliases: ['themes', 'theme', '主题', '母题', '哲学主题', '主题分析'] },
  { key: 'annotations', name: 'Annotations', labelZh: '批注引用 (Annotations)', aliases: ['annotations', 'annotation', '批注', '高亮', '文献批注', '卡片', '引文批注'] },
  { key: 'relationships', name: 'Relationships', labelZh: '人物/势力关系网 (Relationships)', aliases: ['relationships', 'relationship', '关系', '人物关系', '关系网', '势力关系', '人物关系网'] },
  { key: 'analyses', name: 'Analyses', labelZh: '叙事分析 (Analyses)', aliases: ['analyses', 'analysis', '分析', '叙事分析', '故事分析', 'AI分析', '实验室记录', '深度分析'] },
];

// Helper to get environment variables with fallback
function getEnvConfig(reqBody?: any) {
  const appId = process.env.FEISHU_APP_ID?.trim() || '';
  const appSecret = process.env.FEISHU_APP_SECRET?.trim() || '';
  const appToken = reqBody?.appToken?.trim() || process.env.FEISHU_APP_TOKEN?.trim() || '';
  const tableId = reqBody?.tableId?.trim() || process.env.FEISHU_TABLE_ID?.trim() || '';

  return { appId, appSecret, appToken, tableId };
}

// Fetch Feishu tenant_access_token with caching
async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
  if (!appId || !appSecret) {
    throw new Error('Serverless 环境变量中缺失 FEISHU_APP_ID 或 FEISHU_APP_SECRET，请在 Vercel / 部署控制台中配置。');
  }

  // Use cached token if valid for at least 2 more minutes
  if (cachedToken && cachedToken.expiresAt > Date.now() + 120 * 1000) {
    return cachedToken.token;
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`飞书鉴权失败 (Code ${data.code}): ${data.msg || '无法获取 tenant_access_token'}`);
  }

  cachedToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire || 7200) * 1000,
  };

  return cachedToken.token;
}

// Format entity for Feishu record fields
function formatEntityFields(item: any): Record<string, any> {
  const entityId = String(item.id || item.entity_id || '');
  const entityType = String(item.entityType || item.entity_type || 'unknown');
  const name = String(item.name || item.title || entityId);
  const projectId = String(item.projectId || item.project_id || '');
  const status = String(item.status || 'active');
  const updatedAt = typeof item.updatedAt === 'number' ? item.updatedAt : Date.now();
  const summary = String(item.summary || item.description || item.bio || item.coreConcept || item.lore || '');
  const payloadJson = typeof item.data === 'string' ? item.data : JSON.stringify(item.data || item);

  return {
    'Entity ID': entityId,
    'Type': entityType,
    'Name': name,
    'Project ID': projectId,
    'Status': status,
    'Updated At': updatedAt,
    'Summary': summary.slice(0, 1000),
    'Payload JSON': payloadJson,
  };
}

// Extract entity properties from Feishu record fields
function parseFeishuFields(record: any): any {
  const fields = record.fields || {};
  const entityId = fields['Entity ID'] || fields['entity_id'] || fields['ID'] || record.record_id;
  const entityType = fields['Type'] || fields['entity_type'] || 'unknown';
  const name = fields['Name'] || fields['title'] || fields['名称'] || '';
  const projectId = fields['Project ID'] || fields['project_id'] || '';
  const status = fields['Status'] || fields['status'] || 'active';
  const updatedAt = Number(fields['Updated At'] || fields['updated_at'] || record.updated_time || Date.now());
  const summary = fields['Summary'] || fields['summary'] || '';
  
  let data = null;
  const rawPayload = fields['Payload JSON'] || fields['data_json'] || fields['Payload'];
  if (rawPayload) {
    try {
      data = JSON.parse(rawPayload);
    } catch (e) {
      data = { raw: rawPayload };
    }
  } else {
    data = { id: entityId, name, entityType, projectId, status, updatedAt, summary };
  }

  return {
    recordId: record.record_id,
    entityId,
    entityType,
    name,
    projectId,
    status,
    updatedAt,
    summary,
    data,
  };
}

// Fetch all tables in the Feishu Bitable Base
async function fetchBaseTables(appToken: string, token: string) {
  const tablesUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables?page_size=100`;
  const res = await fetch(tablesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`无法获取飞书多维表格列表 (Code ${data.code}): ${data.msg}`);
  }
  return data.data?.items || [];
}

// Match the 12 standard tables against existing remote tables
function matchStandardTables(remoteTables: Array<{ table_id: string; name: string }>) {
  const tableMapping: Record<string, string> = {};
  const tablesStatus: Record<string, {
    key: string;
    name: string;
    labelZh: string;
    tableId?: string;
    tableName?: string;
    exists: boolean;
  }> = {};
  const missingTables: string[] = [];

  for (const std of STANDARD_TABLES) {
    const matched = remoteTables.find((rt) => {
      const normalizedRemote = rt.name.trim().toLowerCase();
      return (
        normalizedRemote === std.name.toLowerCase() ||
        std.aliases.some((alias) => normalizedRemote === alias.toLowerCase() || normalizedRemote.includes(alias.toLowerCase()))
      );
    });

    if (matched) {
      tableMapping[std.key] = matched.table_id;
      tablesStatus[std.key] = {
        key: std.key,
        name: std.name,
        labelZh: std.labelZh,
        tableId: matched.table_id,
        tableName: matched.name,
        exists: true,
      };
    } else {
      missingTables.push(std.name);
      tablesStatus[std.key] = {
        key: std.key,
        name: std.name,
        labelZh: std.labelZh,
        exists: false,
      };
    }
  }

  const matchedCount = Object.keys(tableMapping).length;
  const totalCount = STANDARD_TABLES.length;

  return {
    tableMapping,
    tablesStatus,
    missingTables,
    matchedCount,
    totalCount,
  };
}

// Resolve target table ID for an action
function resolveTargetTableId(reqBody: any, defaultTableId?: string, tableMapping?: Record<string, string>): string {
  if (reqBody?.tableId) return reqBody.tableId;

  const tableKey = reqBody?.tableKey || reqBody?.entityType || reqBody?.entity?.entityType;
  if (tableKey) {
    const normalizedKey = String(tableKey).toLowerCase();
    // Direct mapping match
    if (tableMapping && tableMapping[normalizedKey]) {
      return tableMapping[normalizedKey];
    }
    // Search in aliases
    const foundStd = STANDARD_TABLES.find(
      (s) => s.key === normalizedKey || s.aliases.some((a) => a.toLowerCase() === normalizedKey)
    );
    if (foundStd && tableMapping && tableMapping[foundStd.key]) {
      return tableMapping[foundStd.key];
    }
  }

  if (defaultTableId) return defaultTableId;
  throw new Error(`无法解析目标飞书数据表 ID (tableKey: ${tableKey || 'none'})，请确认多维表格是否包含该表。`);
}

// Main Feishu Proxy Handler supporting both Vercel Serverless & Express
export async function handleFeishuProxyRequest(reqBody: any, queryAction?: string) {
  const { appId, appSecret, appToken, tableId } = getEnvConfig(reqBody);
  const action = reqBody?.action || queryAction || 'status';

  // 1. Status / Connection Test / 12 Tables Auto-Discovery
  if (action === 'status' || action === 'test' || action === 'discover_tables') {
    if (!appId || !appSecret) {
      return {
        ok: false,
        connectionStatus: 'unconfigured',
        hasAppSecret: false,
        hasAppToken: !!appToken,
        hasTableId: !!tableId,
        message: '服务端未检测到 FEISHU_APP_ID 或 FEISHU_APP_SECRET 环境变量。请在服务端环境变量中配置。',
      };
    }

    try {
      const token = await getTenantAccessToken(appId, appSecret);

      if (!appToken) {
        return {
          ok: true,
          connectionStatus: 'connected_no_table',
          hasAppSecret: true,
          hasAppToken: false,
          message: `飞书 tenant_access_token 鉴权成功！请在设置中配置 App Token (Base ID) 以自动映射 ${STANDARD_TABLES.length} 张数据表。`,
        };
      }

      // Fetch all tables in Base
      const remoteTables = await fetchBaseTables(appToken, token);
      const { tableMapping, tablesStatus, missingTables, matchedCount, totalCount } = matchStandardTables(remoteTables);

      // If user supplied a specific tableId and it's valid, map fallback
      const primaryTableId = tableId || tableMapping.projects || remoteTables[0]?.table_id || '';

      const isAllMatched = matchedCount === totalCount;
      const isPartial = matchedCount > 0 && !isAllMatched;

      let msg = '';
      if (isAllMatched) {
        msg = `成功连接飞书多维表格！已全部自动映射 ${matchedCount}/${totalCount} 张数据表。`;
      } else if (isPartial) {
        msg = `飞书已连接！已自动匹配 ${matchedCount}/${totalCount} 张数据表。未匹配表: [${missingTables.join(', ')}]，未匹配表将安全运行于本地 IndexedDB。`;
      } else {
        msg = `已连接多维表格 Base，但未找到匹配的 ${STANDARD_TABLES.length} 张标准表名。当前多维表格包含表: [${remoteTables.map((t: any) => t.name).join(', ')}]。`;
      }

      return {
        ok: true,
        connectionStatus: isAllMatched ? 'connected' : isPartial ? 'partial' : 'connected_no_table',
        hasAppSecret: true,
        appToken,
        tableId: primaryTableId,
        tableMapping,
        tablesStatus,
        missingTables,
        matchedCount,
        totalCount,
        remoteTablesCount: remoteTables.length,
        message: msg,
      };
    } catch (err: any) {
      return {
        ok: false,
        connectionStatus: 'error',
        message: `连接测试异常: ${err.message || String(err)}`,
      };
    }
  }

  // Check credentials for API calls
  if (!appId || !appSecret) {
    throw new Error('FEISHU_APP_ID 或 FEISHU_APP_SECRET 未在服务端配置。');
  }
  if (!appToken) {
    throw new Error('未配置 App Token (Base ID)。');
  }

  const token = await getTenantAccessToken(appId, appSecret);

  // Fetch or resolve table mapping
  let tableMapping: Record<string, string> = reqBody?.tableMapping || {};
  if (Object.keys(tableMapping).length === 0) {
    try {
      const remoteTables = await fetchBaseTables(appToken, token);
      const matched = matchStandardTables(remoteTables);
      tableMapping = matched.tableMapping;
    } catch (e) {}
  }

  // 2. List Records (Read from specific table)
  if (action === 'list') {
    const targetTableId = resolveTargetTableId(reqBody, tableId, tableMapping);
    const baseUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}`;
    const pageToken = reqBody?.pageToken || '';
    const pageSize = reqBody?.pageSize || 100;
    const url = new URL(`${baseUrl}/records`);
    url.searchParams.append('page_size', String(pageSize));
    if (pageToken) url.searchParams.append('page_token', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(`飞书获取记录失败: ${data.msg} (code: ${data.code})`);
    }

    const records = (data.data?.items || []).map(parseFeishuFields);
    return {
      ok: true,
      records,
      hasMore: data.data?.has_more || false,
      pageToken: data.data?.page_token,
      total: data.data?.total || records.length,
      tableId: targetTableId,
    };
  }

  // 3. Create Record
  if (action === 'create') {
    const entity = reqBody?.entity || reqBody?.record;
    if (!entity) throw new Error('缺少创建实体数据 (entity)');

    const targetTableId = resolveTargetTableId(reqBody, tableId, tableMapping);
    const baseUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}`;
    const fields = formatEntityFields(entity);
    
    const res = await fetch(`${baseUrl}/records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(`创建飞书记录失败: ${data.msg} (code: ${data.code})`);
    }

    return { ok: true, record: parseFeishuFields(data.data?.record), tableId: targetTableId };
  }

  // 4. Update Record
  if (action === 'update') {
    const recordId = reqBody?.recordId;
    const entity = reqBody?.entity || reqBody?.record;
    if (!recordId && !entity?.id) throw new Error('缺少 recordId 或 entity.id');

    const targetTableId = resolveTargetTableId(reqBody, tableId, tableMapping);
    const baseUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}`;

    let targetRecordId = recordId;
    // If only entityId was provided, look up the record_id in Feishu
    if (!targetRecordId && entity?.id) {
      const searchRes = await fetch(`${baseUrl}/records?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const searchData = await searchRes.json();
      const match = (searchData.data?.items || []).find((r: any) => {
        const eid = r.fields?.['Entity ID'] || r.fields?.['entity_id'] || r.fields?.['ID'];
        return eid === entity.id;
      });
      if (match) {
        targetRecordId = match.record_id;
      }
    }

    if (!targetRecordId) {
      // Fallback: create as new record if not found in remote
      const fields = formatEntityFields(entity);
      const createRes = await fetch(`${baseUrl}/records`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      });
      const createData = await createRes.json();
      if (createData.code !== 0) throw new Error(createData.msg);
      return { ok: true, created: true, record: parseFeishuFields(createData.data?.record), tableId: targetTableId };
    }

    const fields = formatEntityFields(entity);
    const res = await fetch(`${baseUrl}/records/${targetRecordId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(`更新飞书记录失败: ${data.msg} (code: ${data.code})`);
    }

    return { ok: true, record: parseFeishuFields(data.data?.record), tableId: targetTableId };
  }

  // 5. Delete Record
  if (action === 'delete') {
    const recordId = reqBody?.recordId;
    const entityId = reqBody?.entityId;
    if (!recordId && !entityId) throw new Error('缺少 recordId 或 entityId');

    const targetTableId = resolveTargetTableId(reqBody, tableId, tableMapping);
    const baseUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}`;

    let targetRecordId = recordId;
    if (!targetRecordId && entityId) {
      const searchRes = await fetch(`${baseUrl}/records?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const searchData = await searchRes.json();
      const match = (searchData.data?.items || []).find((r: any) => {
        const eid = r.fields?.['Entity ID'] || r.fields?.['entity_id'] || r.fields?.['ID'];
        return eid === entityId;
      });
      if (match) targetRecordId = match.record_id;
    }

    if (targetRecordId) {
      const res = await fetch(`${baseUrl}/records/${targetRecordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code !== 0) {
        throw new Error(`删除飞书记录失败: ${data.msg} (code: ${data.code})`);
      }
    }

    return { ok: true, deleted: true, entityId, recordId: targetRecordId, tableId: targetTableId };
  }

  // 6. 12-Table Bi-directional Batch Sync with Safe Incremental & Conflict Detection
  if (action === 'batch_sync' || action === 'sync') {
    const rawItems: any[] = reqBody?.items || [];
    const clientLastSync = reqBody?.clientLastSyncTime || 0;

    // Refresh table discovery
    const remoteTables = await fetchBaseTables(appToken, token);
    const { tableMapping: discoveredMapping, missingTables } = matchStandardTables(remoteTables);
    const activeMapping = { ...discoveredMapping, ...(reqBody?.tableMapping || {}) };

    // Group local items by standard table key
    const itemsByTable: Record<string, any[]> = {};
    for (const std of STANDARD_TABLES) {
      itemsByTable[std.key] = [];
    }

    for (const item of rawItems) {
      const type = String(item.entityType || '').toLowerCase();
      let matchedKey = 'projects';
      for (const std of STANDARD_TABLES) {
        if (std.key === type || std.aliases.some((a) => a.toLowerCase() === type)) {
          matchedKey = std.key;
          break;
        }
      }
      if (!itemsByTable[matchedKey]) itemsByTable[matchedKey] = [];
      itemsByTable[matchedKey].push(item);
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    const allConflicts: any[] = [];
    const allRemoteUpdates: any[] = [];
    const perTableResults: Record<string, any> = {};

    // Iterate through each standard table
    for (const std of STANDARD_TABLES) {
      const currentTableId = activeMapping[std.key];
      const localTableItems = itemsByTable[std.key] || [];

      if (!currentTableId) {
        // Table not present in Feishu -> Skip safely without error or creating bogus structures
        perTableResults[std.key] = {
          tableName: std.name,
          skipped: true,
          reason: `多维表格中未找到「${std.name}」表，本地 ${localTableItems.length} 条记录安全保留于 IndexedDB`,
          created: 0,
          updated: 0,
          remoteCount: 0,
        };
        continue;
      }

      const tableBaseUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${currentTableId}`;

      // A. Fetch existing remote records
      const remoteRecordsMap = new Map<string, any>();
      let pageToken = '';
      let hasMore = true;
      let remoteFetchedCount = 0;

      while (hasMore && remoteFetchedCount < 500) {
        const url = new URL(`${tableBaseUrl}/records`);
        url.searchParams.append('page_size', '100');
        if (pageToken) url.searchParams.append('page_token', pageToken);

        const fetchRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fetchData = await fetchRes.json();
        if (fetchData.code !== 0) {
          break;
        }

        const items = fetchData.data?.items || [];
        for (const item of items) {
          const parsed = parseFeishuFields(item);
          if (parsed.entityId) {
            remoteRecordsMap.set(parsed.entityId, parsed);
          }
        }

        remoteFetchedCount += items.length;
        hasMore = fetchData.data?.has_more || false;
        pageToken = fetchData.data?.page_token || '';
      }

      // B. Analyze Delta
      const toCreate: any[] = [];
      const toUpdate: any[] = [];
      const localIds = new Set<string>();

      for (const item of localTableItems) {
        const entityId = item.id;
        localIds.add(entityId);
        const localUpdated = item.updatedAt || Date.now();
        const remote = remoteRecordsMap.get(entityId);

        if (!remote) {
          toCreate.push({ fields: formatEntityFields(item) });
        } else {
          const remoteUpdated = remote.updatedAt || 0;
          if (localUpdated > remoteUpdated) {
            toUpdate.push({
              record_id: remote.recordId,
              fields: formatEntityFields(item),
            });
          } else if (remoteUpdated > localUpdated) {
            allConflicts.push({
              entityId,
              entityType: item.entityType || std.key,
              name: item.name || remote.name,
              localUpdatedAt: localUpdated,
              remoteUpdatedAt: remoteUpdated,
            });
            if (remote.data) {
              allRemoteUpdates.push(remote.data);
            }
          }
        }
      }

      // Collect remote-only records
      for (const [remoteEntityId, remoteRecord] of remoteRecordsMap.entries()) {
        if (!localIds.has(remoteEntityId) && remoteRecord.data) {
          allRemoteUpdates.push(remoteRecord.data);
        }
      }

      // C. Execute Batch Create
      let tableCreated = 0;
      for (let i = 0; i < toCreate.length; i += 100) {
        const chunk = toCreate.slice(i, i + 100);
        const res = await fetch(`${tableBaseUrl}/records/batch_create`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: chunk }),
        });
        const data = await res.json();
        if (data.code === 0) {
          tableCreated += chunk.length;
        }
      }

      // D. Execute Batch Update
      let tableUpdated = 0;
      for (let i = 0; i < toUpdate.length; i += 100) {
        const chunk = toUpdate.slice(i, i + 100);
        const res = await fetch(`${tableBaseUrl}/records/batch_update`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: chunk }),
        });
        const data = await res.json();
        if (data.code === 0) {
          tableUpdated += chunk.length;
        }
      }

      totalCreated += tableCreated;
      totalUpdated += tableUpdated;

      perTableResults[std.key] = {
        tableName: std.name,
        tableId: currentTableId,
        created: tableCreated,
        updated: tableUpdated,
        remoteCount: remoteRecordsMap.size,
        skipped: false,
      };
    }

    const matchedTablesCount = Object.keys(activeMapping).length;
    let syncSummary = `数据表同步完成：已自动映射 ${matchedTablesCount}/${STANDARD_TABLES.length} 张数据表，新增 ${totalCreated} 条，更新 ${totalUpdated} 条，远端合并 ${allRemoteUpdates.length} 条。`;
    if (missingTables.length > 0) {
      syncSummary += ` 缺少表: [${missingTables.join(', ')}]，对应数据已安全保存在本地。`;
    }

    return {
      ok: true,
      success: true,
      message: syncSummary,
      createdCount: totalCreated,
      updatedCount: totalUpdated,
      totalSynced: totalCreated + totalUpdated,
      remoteDataCount: allRemoteUpdates.length,
      conflicts: allConflicts,
      remoteUpdates: allRemoteUpdates,
      perTableResults,
      missingTables,
      matchedTablesCount,
      tableMapping: activeMapping,
      syncedAt: Date.now(),
    };
  }

  throw new Error(`不支持的飞书 Proxy 操作指令: ${action}`);
}

// Default export for Vercel Serverless Function (e.g. /api/feishu)
export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }

    const queryAction = req.query?.action;
    const result = await handleFeishuProxyRequest(body || {}, queryAction);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      success: false,
      message: error.message || '飞书 Serverless 代理执行失败',
    });
  }
}
