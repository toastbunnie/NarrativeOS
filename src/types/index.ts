export type AppTheme = 'sunshine-greentea' | 'plain-cream' | 'haze-coffee' | 'sweet-lolita';
export type ThemeName = 'sunshine_green_tea' | 'plain_cream' | 'haze_coffee_blue' | 'sweet_lolita';
export type AppLanguage = 'zh' | 'en';
export type Language = 'zh' | 'en';

export type NavTab =
  | 'HOME'
  | 'WORKBENCH'
  | 'PROJECTS'
  | 'LIBRARY'
  | 'CHARACTERS'
  | 'QUESTS'
  | 'SCRIPT'
  | 'STORYBOARD'
  | 'AV_REQUIREMENTS'
  | 'COPY'
  | 'WORLD'
  | 'TIMELINE'
  | 'KNOWLEDGE GRAPH'
  | 'ANALYSIS'
  | 'ARCHIVE'
  | 'LAB'
  | 'SETTINGS';

export interface Project {
  id: string;
  name: string;
  description: string;
  type: string; // e.g. 'game' | 'novel' | 'film' | 'worldbuilding' | 'other'
  status: 'planning' | 'writing' | 'revising' | 'completed' | 'archived';
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type DocumentFileType = 'TXT' | 'MD' | 'PDF' | 'DOC' | 'DOCX' | 'JSON' | 'CSV';

export interface DocumentSegment {
  id: string;
  index: number;
  text: string;
  page?: number;
  paragraphOffset?: number;
}

export interface LibraryDocument {
  id: string;
  projectId: string;
  title: string;
  fileType: DocumentFileType;
  category: string;
  originalText: string;
  segments: DocumentSegment[];
  summary?: string;
  tags: string[];
  metadata: {
    fileName?: string;
    fileSize?: number;
    wordCount: number;
    pageCount?: number;
    author?: string;
    importedAt: number;
  };
  createdAt: number;
  updatedAt: number;
}

export type AnnotationType = 
  | 'Dialogue'
  | 'Action'
  | 'Conflict'
  | 'Reveal'
  | 'Foreshadowing'
  | 'Choice'
  | 'Consequence'
  | 'Lore'
  | 'Character Beat'
  | 'Emotional Beat'
  | 'Quest Beat'
  | 'Theme';

export interface Annotation {
  id: string;
  projectId: string;
  sourceId: string; // LibraryDocument id
  segmentId?: string;
  start: number;
  end: number;
  text: string;
  type: AnnotationType;
  note?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  createdAt: number;
}

export type RelationType = 
  | 'knows'
  | 'likes'
  | 'dislikes'
  | 'trusts'
  | 'conflicts_with'
  | 'belongs_to'
  | 'appears_in'
  | 'located_in'
  | 'reveals'
  | 'foreshadows'
  | 'causes'
  | 'depends_on'
  | 'related_to';

export interface CharacterRelation {
  targetId: string;
  targetName: string;
  type: RelationType;
  description?: string;
  weight?: number; // 1-5
}

export interface CharacterDialogue {
  quote: string;
  context?: string;
  sourceDocId?: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  aliases: string[];
  identity: string; // 身份 / 职业 / 阵营
  personality: string;
  goals: string;
  bio: string;
  relationships: CharacterRelation[];
  appearances: string[]; // doc ids or scene names
  dialogues: CharacterDialogue[];
  events: string[]; // event names or ids
  locations: string[]; // location names or ids
  quests: string[]; // quest names or ids
  themes: string[]; // theme names or ids
  tags: string[];
  avatarColor?: string;
  createdAt: number;
  updatedAt: number;
}

export type QuestStatus = 'draft' | 'active' | 'completed' | 'branched';

export interface QuestChoice {
  id: string;
  description: string;
  requirement?: string;
  consequence: string;
}

export type QuestStepType = 'normal' | 'start' | 'action' | 'dialogue' | 'branch' | 'choice' | 'puzzle' | 'battle' | 'climax' | 'ending';

export interface QuestStep {
  id: string;
  projectId: string;
  questId: string;
  title: string;
  summary: string;
  stepType?: QuestStepType;
  type?: QuestStepType;
  orderIndex?: number;
  order?: number;
  location?: string;
  locations?: string[];
  characters?: string[];
  tags?: string[];
  condition?: string;
  notes?: string;
  position?: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
}

export type QuestConnectionType = 
  | 'Next' 
  | 'Branch' 
  | 'Choice' 
  | 'Success' 
  | 'Failure' 
  | 'Ending' 
  | 'Merge'
  | 'Loop';

export interface QuestConnection {
  id: string;
  projectId: string;
  questId: string;
  fromStepId: string;
  toStepId: string;
  type: QuestConnectionType;
  label?: string;
  condition?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Quest {
  id: string;
  projectId: string;
  name: string;
  description: string;
  objectives: string[];
  characters: string[];
  locations: string[];
  events: string[];
  prerequisites: string[];
  choices: QuestChoice[];
  outcomes: string[];
  status: QuestStatus;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type NarrativeCopyType = 
  | 'item_lore'          // 道具包装
  | 'voice_interactive' // 语音/点击对话文本
  | 'pv_trailer'         // PV文案
  | 'letter'             // 游戏内书信
  | 'announcement'       // 游戏公告
  | 'mail'               // 游戏邮件
  | 'document'           // 游戏文档
  | 'loading_tip'        // 加载文本
  | 'tutorial'           // 教学文案
  | 'ui_copy'            // UI 文案
  | 'system_ui'          // 系统UI
  | 'dialogue'           // 对白包装
  | 'world_lore'         // 世界观设定
  | 'skill_desc'         // 技能描述
  | 'activity'           // 活动文案
  | 'atmosphere'         // 氛围文本
  | 'other';             // 其他

export type NarrativeCopyCategory = NarrativeCopyType;
export type NarrativeCopyStatus = 'draft' | 'review' | 'final' | 'approved' | 'deprecated';

export interface NarrativeCopy {
  id: string;
  projectId: string;
  title: string;
  type: NarrativeCopyType;
  category?: NarrativeCopyCategory;
  content: string;
  flavorText?: string;
  tags: string[];
  relatedCharacterIds?: string[];
  relatedQuestIds?: string[];
  relatedItemIds?: string[];
  relatedSourceIds?: string[];
  questId?: string;
  characters?: string[];
  locations?: string[];
  status: NarrativeCopyStatus;
  version?: string;
  wordCount: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoryboardColumn {
  id: string;
  name?: string;
  label?: string;
  type: 'text' | 'select' | 'number' | 'multiline';
  width?: number;
}

export interface StoryboardRow {
  id: string;
  orderIndex?: number;
  shotNumber?: string | number;
  cells: Record<string, string>;
}

export interface Storyboard {
  id: string;
  projectId: string;
  questId: string;
  title: string;
  description?: string;
  columns: StoryboardColumn[];
  rows: StoryboardRow[];
  createdAt: number;
  updatedAt: number;
}

export type AVReqLevel = 'global' | 'shot' | 'step';
export type AVReqType = 'Music' | 'SFX' | 'Voice' | 'Art' | 'VFX' | 'Animation' | 'Other';
export type AVReqStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'blocked';
export type AVReqPriority = 'low' | 'medium' | 'high' | 'urgent';

export type AVType = AVReqType;
export type AVLevel = AVReqLevel;
export type AVStatus = AVReqStatus;
export type AVPriority = AVReqPriority;

export interface AVRequirement {
  id: string;
  projectId: string;
  questId?: string;
  stepId?: string;
  shotId?: string;
  level: AVReqLevel;
  targetId?: string; // Storyboard ID or Step ID
  targetName?: string; // Shot identifier or Step Title
  title: string;
  type: AVReqType;
  status: AVReqStatus;
  priority: AVReqPriority;
  description: string;
  format?: string;
  referenceUrl?: string;
  assignee?: string;
  estimatedDuration?: string;
  tags: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ====== 演出剧本 / Performance Script ======

export type ScriptStatus = 'draft' | 'review' | 'final' | 'archived';

export type ScriptNodeType =
  | 'dialogue'   // 角色对白
  | 'narration'  // 旁白
  | 'scene'      // 场景描述
  | 'action'     // 动作/表演提示
  | 'choice'     // 选项
  | 'branch'     // 分支
  | 'ending';   // 结局

export interface ScriptChoiceOption {
  id: string;
  text: string;
  targetNodeId?: string;
  targetStepId?: string;
  targetScriptId?: string;
  endingLabel?: string;
  condition?: string;
}

export interface ScriptNode {
  id: string;
  type: ScriptNodeType;
  speaker?: string;       // 角色名（对白/动作）
  text?: string;          // 对白/旁白/场景/动作文本
  side?: 'left' | 'right' | 'center'; // 演出展示位置
  options?: ScriptChoiceOption[];     // 选项（type=choice 时）
  targetNodeId?: string;  // 分支目标节点（type=branch 时）
  targetStepId?: string;  // 跳转到任务步骤
  targetScriptId?: string; // 跳转到其他剧本
  endingLabel?: string;   // 结局标签（type=ending 时）
  condition?: string;     // 分支条件
  orderIndex: number;
  meta?: { cue?: string; note?: string };
}

export interface PerformanceScript {
  id: string;
  projectId: string;
  questId?: string;
  stepIds: string[];
  title: string;
  description: string;
  status: ScriptStatus;
  nodes: ScriptNode[];
  startNodeId?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldLocation {
  id: string;
  projectId: string;
  name: string;
  type: string; // e.g. City, Dungeon, Realm, Planet
  description: string;
  factions: string[];
  lore: string;
  events: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldFaction {
  id: string;
  projectId: string;
  name: string;
  description: string;
  leader: string;
  allies: string[];
  rivals: string[];
  members: string[];
  lore: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldItem {
  id: string;
  projectId: string;
  name: string;
  type: string; // Relic, Weapon, Tool, Document, Material
  description: string;
  owner: string;
  origin: string;
  lore: string;
  effects: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldLore {
  id: string;
  projectId: string;
  title: string;
  category: string; // Mythology, History, Magic System, Science, Custom
  content: string;
  relatedEntities: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldTheme {
  id: string;
  projectId: string;
  name: string;
  coreConcept: string;
  motif: string;
  relatedCharacters: string[];
  relatedQuests: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldEvent {
  id: string;
  projectId: string;
  name: string;
  time: string;
  location: string;
  characters: string[];
  description: string;
  causes: string[];
  dependsOn: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TimelineEvent {
  id: string;
  projectId: string;
  orderIndex: number;
  order?: number;
  time: string;
  timeLabel?: string;
  name: string;
  title?: string;
  location: string;
  characters: string[];
  description: string;
  causalCauses: string[];
  causalDependsOn: string[];
  category?: string;
  track?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/** 解析结果元数据：置信度 / 来源片段 / 需人工确认（附着在每条候选结果上，不入库实体表） */
export interface ExtractionMeta {
  confidence?: number; // 0~1，解析置信度
  sourceSegment?: string; // 来源原文片段
  needsReview?: boolean; // 无法确定或低置信度时标记「需确认」
}

/** 文本解析实验区解析模式 */
export type ParseMode =
  | 'smart' // 智能综合解析（自动判断文本类型，可同时识别多个类型）
  | 'quest' // 任务解析
  | 'world' // 世界观解析
  | 'character' // 角色解析
  | 'copy' // 文本包装解析
  | 'storyboard' // 分镜解析
  | 'av' // 音美解析
  | 'script'; // 演出剧本解析

export interface ParseReportChunk {
  index: number;
  title: string;
  chars: number;
}

/** 五阶段解析报告（仅存在于解析预览中，供用户审阅） */
export interface ParseReport {
  mode: ParseMode;
  modeLabel: string;
  detectedTypes: string[];
  chunks: ParseReportChunk[];
  stages: Array<{ stage: string; detail: string; at: number }>;
  warnings: string[];
  aliasMerges: Array<{ category: string; canonical: string; aliases: string[] }>;
  stats: {
    chunkCount: number;
    aiCalls: number;
    mergedCount: number;
    flaggedCount: number;
    fallbackChunks: number;
    durationMs: number;
  };
}

export interface EntityExtractionResult {
  characters: Array<Partial<Character> & ExtractionMeta>;
  locations: Array<Partial<WorldLocation> & ExtractionMeta>;
  factions: Array<Partial<WorldFaction> & ExtractionMeta>;
  items: Array<Partial<WorldItem> & ExtractionMeta>;
  events: Array<Partial<WorldEvent> & ExtractionMeta>;
  quests: Array<Partial<Quest> & ExtractionMeta>;
  questSteps?: Array<Partial<QuestStep> & ExtractionMeta>;
  questConnections?: Array<Partial<QuestConnection> & ExtractionMeta>;
  themes: Array<Partial<WorldTheme> & ExtractionMeta>;
  lore: Array<Partial<WorldLore> & ExtractionMeta>;
  annotations?: Array<Partial<Annotation> & ExtractionMeta>;
  narrativeCopy?: Array<Partial<NarrativeCopy> & ExtractionMeta>;
  storyboards?: Array<Partial<Storyboard> & ExtractionMeta>;
  avRequirements?: Array<Partial<AVRequirement> & ExtractionMeta>;
  performanceScripts?: Array<Partial<PerformanceScript> & ExtractionMeta>;
  dialogues: Array<{ speaker: string; text: string; context?: string }>;
  choices: Array<{ prompt: string; options: string[]; result?: string }>;
  relationships: Array<{ source: string; target: string; type: RelationType; note?: string }>;
  keywords: string[];
  summary: string;
  report?: ParseReport;
}

export interface LabSession {
  id: string;
  projectId: string;
  sourceName: string;
  rawText: string;
  status: 'idle' | 'parsing' | 'reviewed' | 'saved';
  extracted: EntityExtractionResult;
  createdAt: number;
}

export interface ArchiveRecord {
  id: string;
  entityType: 'project' | 'document' | 'character' | 'quest' | 'quest_step' | 'quest_connection' | 'narrative_copy' | 'storyboard' | 'av_requirement' | 'performance_script' | 'location' | 'faction' | 'item' | 'lore' | 'theme' | 'event' | 'timeline' | 'analysis';
  originalId: string;
  projectId: string;
  title: string;
  data: any;
  archivedAt: number;
  reason?: string;
}

export interface AISettings {
  provider: 'qwen' | 'local';
  qwenApiKey: string;
  qwenModel: string;
  qwenEndpoint: string;
  localModel: string;
  localDevice: 'webgpu' | 'cpu';
}

export interface FeishuTableInfo {
  key: string;
  name: string;
  labelZh: string;
  tableId?: string;
  tableName?: string;
  exists: boolean;
  recordCount?: number;
}

export interface FeishuSettings {
  appToken: string; // Base ID / App Token
  tableId?: string; // Default or fallback Table ID
  tableMapping: Record<string, string>; // Map of 'projects' | 'sources' | 'characters' etc. -> Table ID
  autoSync: boolean; // Automatic background sync on change
  connectionStatus: 'unknown' | 'connected' | 'unconfigured' | 'partial' | 'error';
  tablesStatus?: Record<string, FeishuTableInfo>;
  missingTables?: string[];
  matchedTablesCount?: number;
  totalTablesCount?: number;
  lastSyncTime?: number | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'partial' | 'error';
  lastSyncMessage?: string;
  lastError?: string;
}

export interface FeishuRecordField {
  entity_id: string;
  entity_type: string;
  name: string;
  project_id?: string;
  status?: string;
  updated_at: number;
  data_json: string;
  summary?: string;
}

export interface FeishuSyncResult {
  success: boolean;
  message: string;
  createdCount?: number;
  updatedCount?: number;
  deletedCount?: number;
  totalSynced?: number;
  perTableResults?: Record<string, {
    tableName: string;
    tableId?: string;
    created: number;
    updated: number;
    remoteCount: number;
    skipped?: boolean;
    reason?: string;
  }>;
  missingTables?: string[];
  conflicts?: Array<{
    entityId: string;
    entityType: string;
    name: string;
    localUpdatedAt: number;
    remoteUpdatedAt: number;
  }>;
  remoteDataCount?: number;
  timestamp: number;
}


export interface ActivityLog {
  id: string;
  projectId?: string;
  action: string;
  entityType: string;
  entityName: string;
  timestamp: number;
}

export interface AnalysisRecord {
  id: string;
  projectId: string;
  title: string;
  targetType: 'project' | 'quest' | 'character' | 'narrative_copy' | 'document';
  targetId?: string;
  targetName?: string;
  metrics: any;
  insights: string[];
  recommendations: string[];
  createdAt: number;
  updatedAt: number;
}
