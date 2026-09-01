// 类型定义：解析结果与中间结构
export type Segment = {
  id: string; // 唯一 id，例如 hash(起始位置+长度)
  text: string;
  start?: number; // 可选：在原文中的起始字符索引
  end?: number;
  title?: string; // 若存在章节标题
  summary?: string; // 阶段1保留的上下文摘要
};

export type Confidence = number; // 0..1

export type BaseEntity = {
  id: string;
  type: string; // 'Character'|'Location'|'Faction'|'Item'|'Event'|'Quest'|'Lore'|'Theme'|'Storyboard'|'AV'|'Textual'
  name?: string; // 标准化名字（若无法确定留空）
  aliases?: string[];
  description?: string; // 原文中对应描述的一段或摘要
  sourceSegmentIds: string[]; // 引用来源片段 id 列表
  confidence: Confidence;
  needsReview?: boolean;
  metadata?: Record<string, any>;
};

export type QuestStep = {
  id: string;
  title?: string;
  description?: string;
  order?: number | null; // 若无明确顺序则 null
  prerequisites?: string[]; // 与其他 step id 的关联或条件描述
  successConditions?: string[];
  failureConditions?: string[];
  choices?: { text: string; consequence?: string }[];
  avRequirements?: string[]; // ids referencing AV entities
  storyboardIds?: string[]; // link to storyboard entries
  sourceSegmentIds: string[];
  confidence: Confidence;
  needsReview?: boolean;
};

export type Quest = BaseEntity & {
  steps?: QuestStep[];
  connections?: QuestConnection[]; // 连接关系
  metadata?: { tags?: string[] };
};

export type QuestConnection = {
  fromStepId: string;
  toStepId: string;
  condition?: string; // e.g., "if player chooses A"
  type?: 'sequence' | 'branch' | 'merge' | 'conditional';
  confidence: Confidence;
  needsReview?: boolean;
};

export type ParseResult = {
  documentId?: string;
  segments: Segment[]; // 阶段1输出
  entities: BaseEntity[]; // 阶段2合并后输出（角色/地点/物品/事件/任务/世界观/主题）
  quests: Quest[]; // 识别到的 quest
  questSteps: QuestStep[]; // 平铺的步骤（也会在 quests 中引用）
  storyboard: BaseEntity[]; // 分镜条目
  av: BaseEntity[]; // 音美需求（Global/Shot/Step 范围在 metadata.range）
  annotations?: { text: string; sourceSegmentIds: string[] }[];
  warnings?: string[]; // e.g., "孤立步骤: stepId xxx"
  generatedAt: string;
};
