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

export interface EntityExtractionResult {
  characters: Array<Partial<Character>>;
  locations: Array<Partial<WorldLocation>>;
  factions: Array<Partial<WorldFaction>>;
  items: Array<Partial<WorldItem>>;
  events: Array<Partial<WorldEvent>>;
  quests: Array<Partial<Quest>>;
  questSteps?: Array<Partial<QuestStep>>;
  questConnections?: Array<Partial<QuestConnection>>;
  themes: Array<Partial<WorldTheme>>;
  lore: Array<Partial<WorldLore>>;
  annotations?: Array<Partial<Annotation>>;
  narrativeCopy?: Array<Partial<NarrativeCopy>>;
  storyboards?: Array<Partial<Storyboard>>;
  avRequirements?: Array<Partial<AVRequirement>>;
  dialogues: Array<{ speaker: string; text: string; context?: string }>;
  choices: Array<{ prompt: string; options: string[]; result?: string }>;
  relationships: Array<{ source: string; target: string; type: RelationType; note?: string }>;
  keywords: string[];
  summary: string;
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
  entityType: 'project' | 'document' | 'character' | 'quest' | 'quest_step' | 'quest_connection' | 'narrative_copy' | 'storyboard' | 'av_requirement' | 'location' | 'faction' | 'item' | 'lore' | 'theme' | 'event' | 'timeline' | 'analysis';
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
