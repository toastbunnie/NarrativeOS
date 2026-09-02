import {
  AISettings,
  AnnotationType,
  AVReqLevel,
  AVReqType,
  CharacterRelation,
  EntityExtractionResult,
  ExtractionMeta,
  NarrativeCopyType,
  ParseMode,
  ParseReport,
  QuestConnectionType,
  QuestStepType,
  RelationType,
  ScriptNodeType,
  ScriptStatus,
} from '../types';
import { callQwenJSON } from './aiService';

/* ============================================================
 * NARRATIVE OS · 五阶段结构化叙事解析器
 * 阶段1 结构理解（本地结构化分块，保留上下文摘要）
 * 阶段2 实体抽取（分块 AI 抽取，带置信度/来源片段/需确认）
 * 阶段3 生产内容抽取（与阶段2同一次调用，按模式加权聚焦）
 * 阶段4 实体合并与关系校验（本地去重 + AI 别名/指代合并 + 流程校验）
 * 阶段5 结果整理（生成报告，进入「识别结果预览」，等待用户确认）
 * ============================================================ */

export interface ParseModeOption {
  id: ParseMode;
  label: string;
  description: string;
}

export const PARSE_MODE_OPTIONS: ParseModeOption[] = [
  { id: 'smart', label: '智能综合解析', description: '自动判断文本类型，可同时识别多个类型' },
  { id: 'quest', label: '任务解析', description: '重点识别任务、步骤、前置条件、分支、选择、成功/失败、结局及流程连接' },
  { id: 'world', label: '世界观解析', description: '重点识别世界观、地点、阵营、历史、事件、规则、主题' },
  { id: 'character', label: '角色解析', description: '重点识别角色档案、关系、目标、动机、行为和角色节点' },
  { id: 'copy', label: '文本包装解析', description: '识别道具包装、书信、公告、邮件、文档、教学、UI 文案、Loading、Flavor、PV、语音对话、词条、技能、氛围散文与剧本对话' },
  { id: 'storyboard', label: '分镜解析', description: '识别镜头编号、画面、景别、机位、动作、对白、旁白、表演、镜头运动、时长（动态列）' },
  { id: 'av', label: '音美解析', description: '识别音乐、音效、配音、环境声、美术、VFX、动画需求（Global/Shot/Step 三种范围）' },
  { id: 'script', label: '演出剧本解析', description: '识别角色对白、旁白、场景描述、动作/表演提示、选项、分支条件、分支目标、结局及对应任务与步骤，自动建立 Quest→Step→Script→Dialogue/Choice→Branch→Ending' },
];

/* ---------------- 常量 ---------------- */

const MAX_CHUNK_CHARS = 3800; // 单块目标字符数
const MIN_CHUNK_CHARS = 600;
const MAX_CHUNKS = 48; // 超出则截断并记录警告
const CONTEXT_TAIL_CHARS = 320; // 传给下一块的前文摘要长度

const QUEST_STEP_TYPES: QuestStepType[] = ['normal', 'start', 'action', 'dialogue', 'branch', 'choice', 'puzzle', 'battle', 'climax', 'ending'];
const CONNECTION_TYPES: QuestConnectionType[] = ['Next', 'Branch', 'Choice', 'Success', 'Failure', 'Ending', 'Merge', 'Loop'];
const COPY_TYPES: NarrativeCopyType[] = [
  'item_lore', 'voice_interactive', 'pv_trailer', 'letter', 'announcement', 'mail', 'document',
  'loading_tip', 'tutorial', 'ui_copy', 'system_ui', 'dialogue', 'world_lore', 'skill_desc',
  'activity', 'atmosphere', 'other',
];
const AV_TYPES: AVReqType[] = ['Music', 'SFX', 'Voice', 'Art', 'VFX', 'Animation', 'Other'];
const AV_LEVELS: AVReqLevel[] = ['global', 'shot', 'step'];
const RELATION_TYPES: RelationType[] = [
  'knows', 'likes', 'dislikes', 'trusts', 'conflicts_with', 'belongs_to', 'appears_in',
  'located_in', 'reveals', 'foreshadows', 'causes', 'depends_on', 'related_to',
];
const ANNOTATION_TYPES: AnnotationType[] = [
  'Dialogue', 'Action', 'Conflict', 'Reveal', 'Foreshadowing', 'Choice', 'Consequence',
  'Lore', 'Character Beat', 'Emotional Beat', 'Quest Beat', 'Theme',
];

/** 文案类型别名归一化（容忍 AI 输出中文/变体） */
const COPY_TYPE_ALIASES: Record<string, NarrativeCopyType> = {
  '道具包装': 'item_lore', '道具': 'item_lore', '物品文案': 'item_lore', 'item': 'item_lore', 'itemlore': 'item_lore',
  '语音对话': 'voice_interactive', '语音': 'voice_interactive', '点击对话': 'voice_interactive', '互动语音': 'voice_interactive',
  'pv': 'pv_trailer', 'pv文案': 'pv_trailer', '宣发': 'pv_trailer', '预告': 'pv_trailer', 'trailer': 'pv_trailer',
  '书信': 'letter', '信件': 'letter', '游戏书信': 'letter', 'letter': 'letter',
  '公告': 'announcement', '游戏公告': 'announcement', 'announcement': 'announcement',
  '邮件': 'mail', '游戏邮件': 'mail', 'mail': 'mail',
  '文档': 'document', '游戏文档': 'document', 'document': 'document',
  'loading': 'loading_tip', '加载': 'loading_tip', '加载文本': 'loading_tip', 'loadingtip': 'loading_tip',
  '教学': 'tutorial', '引导': 'tutorial', '教学文案': 'tutorial', 'tutorial': 'tutorial',
  'ui': 'ui_copy', 'ui文案': 'ui_copy', '界面文案': 'ui_copy', 'uicopy': 'ui_copy',
  '系统ui': 'system_ui', 'systemui': 'system_ui',
  '对白': 'dialogue', '对话包装': 'dialogue', '剧本对话': 'dialogue', 'dialogue': 'dialogue',
  '世界观词条': 'world_lore', '词条': 'world_lore', '世界观': 'world_lore', 'worldlore': 'world_lore',
  '技能': 'skill_desc', '技能描述': 'skill_desc', '技能特性': 'skill_desc', 'skill': 'skill_desc',
  '活动': 'activity', '活动文案': 'activity', 'activity': 'activity',
  '氛围': 'atmosphere', '氛围散文': 'atmosphere', '散文': 'atmosphere', 'atmosphere': 'atmosphere',
  'flavor': 'other', 'flavortext': 'other',
};

const MODE_FOCUS: Record<ParseMode, string> = {
  smart: '本次为「智能综合解析」：先自行判断文本类型（任务文档/世界观设定/角色档案/文案包装/分镜脚本/音美需求/对白剧本等，可多选），然后同时识别所有类型中真实存在的内容，不得因判断为某一类型而遗漏其他信息。',
  quest: '本次为「任务解析」：重点识别任务（quests）、任务步骤（questSteps）与任务流程连接（questConnections）。必须逐步拆解流程，识别顺序、前置条件、后续步骤、分支、选择、条件、成功、失败、汇聚与结局；注意「如果、否则、选择、成功、失败、之后、然后、完成后」等语义关系词来判定连接类型。其他类型信息若明确存在也一并识别，不要遗漏。',
  world: '本次为「世界观解析」：重点识别世界观设定（lore）、地点（locations）、阵营（factions）、历史事件（events）与主题（themes），梳理世界规则、历史脉络与组织关系。其他类型信息若明确存在也一并识别，不要遗漏。',
  character: '本次为「角色解析」：重点识别角色档案（characters）、角色间关系（relationships）、角色目标与动机（goals）、行为节选（dialogues）以及角色出场节点。注意通过代词与称呼推断归属，但不得编造。其他类型信息若明确存在也一并识别，不要遗漏。',
  copy: '本次为「文本包装解析」：重点识别游戏文案包装（narrativeCopy），覆盖：道具包装、游戏内书信、公告、邮件、文档、教学文本、UI 文案、Loading Text、Flavor text、PV/宣发文案、语音/点击对话文本、世界观词条、技能特性、氛围与散文、剧本对话包装。请将每段独立文案完整摘录到 content 字段（保留原文措辞）。其他类型信息若明确存在也一并识别，不要遗漏。',
  storyboard: '本次为「分镜解析」：重点识别分镜脚本（storyboards）：镜头编号、画面、景别、机位、动作、对白、旁白、表演、镜头运动、时长等。必须根据原文实际出现的字段动态生成 columns 列名与 rows 镜头行，不要强制固定列名；原文没有的字段不要杜撰列。其他类型信息若明确存在也一并识别，不要遗漏。',
  av: '本次为「音美解析」：重点识别音美制作需求（avRequirements）：音乐 Music、音效 SFX、配音 Voice、环境声（归入 SFX）、美术 Art、特效 VFX、动画 Animation。每条需求必须标注范围 level（global 全局 / shot 镜头 / step 任务步骤），并尽量给出 questName / stepTitle / shotId 以便自动关联。其他类型信息若明确存在也一并识别，不要遗漏。',
  script: '本次为「演出剧本解析」：重点识别演出剧本（performanceScripts）。从原文中识别：角色对白（dialogue）、旁白（narration）、场景描述（scene）、动作/表演提示（action）、选项（choice）、分支（branch）、结局（ending）。每个剧本节点包含 type/speaker/text/side/options/targetNodeId/endingLabel/condition 等。尽量根据原文自动建立 Quest→Step→Script→Dialogue/Choice→Branch→Ending。无法确定的关联（如 questName/stepTitles 对应不明确）留空并标记 needsReview=true，禁止编造任务名或步骤名。',
};

/* ---------------- 候选类型 ---------------- */

type CharCand = Partial<import('../types').Character> & ExtractionMeta;
type LocCand = Partial<import('../types').WorldLocation> & ExtractionMeta;
type FacCand = Partial<import('../types').WorldFaction> & ExtractionMeta;
type ItemCand = Partial<import('../types').WorldItem> & ExtractionMeta;
type EventCand = Partial<import('../types').WorldEvent> & ExtractionMeta;
type QuestCand = Partial<import('../types').Quest> & ExtractionMeta;
type StepCand = Partial<import('../types').QuestStep> & ExtractionMeta;
type ConnCand = Partial<import('../types').QuestConnection> & ExtractionMeta;
type ThemeCand = Partial<import('../types').WorldTheme> & ExtractionMeta;
type LoreCand = Partial<import('../types').WorldLore> & ExtractionMeta;
type AnnotCand = Partial<import('../types').Annotation> & ExtractionMeta;
type CopyCand = Partial<import('../types').NarrativeCopy> & ExtractionMeta;
type SbCand = Partial<import('../types').Storyboard> & ExtractionMeta;
type AvCand = Partial<import('../types').AVRequirement> & ExtractionMeta;
type ScriptCand = Partial<import('../types').PerformanceScript> & ExtractionMeta;

interface Accumulated {
  characters: CharCand[];
  locations: LocCand[];
  factions: FacCand[];
  items: ItemCand[];
  events: EventCand[];
  quests: QuestCand[];
  questSteps: StepCand[];
  questConnections: ConnCand[];
  themes: ThemeCand[];
  lore: LoreCand[];
  annotations: AnnotCand[];
  narrativeCopy: CopyCand[];
  storyboards: SbCand[];
  avRequirements: AvCand[];
  performanceScripts: ScriptCand[];
  dialogues: Array<{ speaker: string; text: string; context?: string }>;
  relationships: Array<{ source: string; target: string; type: RelationType; note?: string }>;
  keywords: string[];
  chunkSummaries: string[];
  textTypes: string[];
}

function emptyAccumulated(): Accumulated {
  return {
    characters: [], locations: [], factions: [], items: [], events: [], quests: [],
    questSteps: [], questConnections: [], themes: [], lore: [], annotations: [],
    narrativeCopy: [], storyboards: [], avRequirements: [], performanceScripts: [], dialogues: [],
    relationships: [], keywords: [], chunkSummaries: [], textTypes: [],
  };
}

/** 实体名归一化：去空白、引号括号、全角差异，拉丁转小写 */
export function normName(s: any): string {
  return String(s || '')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[【】\[\]（）()《》“”"'「」『』·・.。,，、!！?？:：;；~～*#\-—_]/g, '')
    .toLowerCase();
}

function clampConfidence(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return undefined;
  if (n > 1 && n <= 100) return Math.min(1, Math.max(0, n / 100));
  return Math.min(1, Math.max(0, n));
}

function str(v: any, maxLen = 4000): string {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, maxLen);
}

function strArr(v: any, maxItems = 30): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, 300)).filter(Boolean).slice(0, maxItems);
}

function numVal(v: any): number | undefined {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isNaN(n) ? undefined : n;
}

function enumOf<T extends string>(v: any, allowed: T[], fallback: T): T {
  const s = normName(v);
  if (!s) return fallback;
  const direct = allowed.find((a) => a.toLowerCase() === s);
  if (direct) return direct;
  const loose = allowed.find((a) => normName(a) === s || (s.length >= 2 && (normName(a).includes(s) || s.includes(normName(a)))));
  return loose ?? fallback;
}

function metaOf(raw: any): ExtractionMeta {
  const confidence = clampConfidence(raw?.confidence);
  const sourceSegment = str(raw?.sourceSegment ?? raw?.source ?? raw?.quote, 200);
  let needsReview = raw?.needsReview === true || raw?.needs_review === true;
  if (!needsReview && confidence !== undefined && confidence < 0.55) needsReview = true;
  return {
    confidence: confidence ?? 0.5,
    sourceSegment: sourceSegment || undefined,
    needsReview,
  };
}

/* ============================================================
 * 阶段1：结构理解 —— 本地结构化分块（保留标题结构与上下文摘要）
 * ============================================================ */

interface TextChunk {
  index: number;
  title: string;
  text: string;
  prevTail: string;
}

const HEADER_RE = new RegExp(
  [
    '^#{1,6}\\s+\\S', // markdown 标题
    '^【[^】]{1,48}】', // 【】小节头
    '^第\\s*[0-9一二三四五六七八九十百千两]+\\s*[章節节幕場场回卷部篇]', // 第X章/幕/场
    '^(Scene|场景|场次|幕|CHAPTER|ACT)\\s*[0-9一二三四五六七八九十]+',
    '^(镜头|Shot|分镜)\\s*[0-9A-Za-z\\-_]+',
    '^(步骤|Step|阶段|节点)\\s*[0-9一二三四五六七八九十]+',
    '^[一二三四五六七八九十]{1,3}\\s*[、.]\\s*\\S',
    '^[0-9]{1,3}\\s*[、.]\\s*\\S',
  ].join('|'),
  'i'
);

function splitIntoBlocks(text: string): Array<{ title: string; body: string }> {
  const lines = text.split(/\r?\n/);
  const blocks: Array<{ title: string; body: string }> = [];
  let curTitle = '';
  let curLines: string[] = [];

  const flush = () => {
    const body = curLines.join('\n');
    if (body.trim()) blocks.push({ title: curTitle, body });
    curLines = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (t && t.length <= 80 && HEADER_RE.test(t)) {
      flush();
      curTitle = t.replace(/^#+\s*/, '').replace(/[【】]/g, '').slice(0, 48);
      curLines = [line];
    } else {
      curLines.push(line);
    }
  }
  flush();
  return blocks.length > 0 ? blocks : [{ title: '', body: text }];
}

/** 超长块内部按段落→句子二次切分 */
function splitOversizeBody(body: string, maxChars: number): string[] {
  if (body.length <= maxChars) return [body];
  const parts: string[] = [];
  let buf = '';
  const pushBuf = () => {
    if (buf.trim()) parts.push(buf);
    buf = '';
  };
  const paras = body.split(/\n{2,}/);
  for (const p of paras) {
    if ((buf + '\n\n' + p).length <= maxChars) {
      buf = buf ? buf + '\n\n' + p : p;
      continue;
    }
    pushBuf();
    if (p.length <= maxChars) {
      buf = p;
      continue;
    }
    // 句子级切分
    const sentences = p.split(/(?<=[。！？!?\n])/);
    for (const s of sentences) {
      if ((buf + s).length > maxChars) pushBuf();
      if (s.length > maxChars) {
        for (let i = 0; i < s.length; i += maxChars) parts.push(s.slice(i, i + maxChars));
      } else {
        buf += s;
      }
    }
  }
  pushBuf();
  return parts.filter((x) => x.trim());
}

interface ChunkCtx {
  chunks: TextChunk[];
  truncated: boolean;
}

function chunkText(text: string): ChunkCtx {
  const blocks = splitIntoBlocks(text);
  const pieces: Array<{ title: string; body: string }> = [];
  for (const b of blocks) {
    const parts = splitOversizeBody(b.body, MAX_CHUNK_CHARS);
    parts.forEach((p, i) => {
      pieces.push({ title: parts.length > 1 ? `${b.title || '片段'}(${i + 1}/${parts.length})` : b.title, body: p });
    });
  }

  // 按序打包为块
  const packed: TextChunk[] = [];
  let buf = '';
  let bufTitle = '';
  const flushBuf = () => {
    if (buf.trim()) {
      packed.push({ index: packed.length, title: bufTitle || `片段 ${packed.length + 1}`, text: buf, prevTail: '' });
    }
    buf = '';
    bufTitle = '';
  };
  for (const piece of pieces) {
    if (buf && (buf + '\n\n' + piece.body).length > MAX_CHUNK_CHARS) {
      flushBuf();
    }
    if (!buf) bufTitle = piece.title;
    buf = buf ? buf + '\n\n' + piece.body : piece.body;
    if (buf.length >= MAX_CHUNK_CHARS * 1.5) flushBuf();
  }
  // 极小末块并入前一块
  if (packed.length > 0 && buf.trim() && buf.length < MIN_CHUNK_CHARS) {
    packed[packed.length - 1].text += '\n\n' + buf;
    buf = '';
  }
  flushBuf();

  let truncated = false;
  let final = packed;
  if (final.length > MAX_CHUNKS) {
    truncated = true;
    final = final.slice(0, MAX_CHUNKS);
  }
  const withCtx = final.map((c, i) => ({
    ...c,
    index: i,
    prevTail: i > 0 ? final[i - 1].text.slice(-CONTEXT_TAIL_CHARS) : '',
  }));
  return { chunks: withCtx, truncated };
}

/* ============================================================
 * 阶段2/3：分块抽取（实体 + 生产内容，同次调用按模式聚焦）
 * ============================================================ */

function buildChunkPrompt(chunk: TextChunk, mode: ParseMode, total: number): string {
  return `你是 NARRATIVE OS 的结构化叙事解析引擎。请对以下「文本分块」执行结构化抽取，只输出 JSON。

【解析模式】
${MODE_FOCUS[mode]}

【核心原则（必须严格遵守）】
1. 只抽取本段原文中真实存在的信息，严禁编造原文不存在的剧情、人物、镜头或需求。
2. 无法确定的信息字段留空或空数组，并将该条 needsReview 置为 true。
3. 每条识别结果必须附带：
   - confidence: 0~1 置信度（根据原文表述明确程度评估）
   - sourceSegment: 支撑该结论的原文片段摘录（≤80字，尽量原文照录）
   - needsReview: 布尔值，存在歧义/推断/信息缺失时必须为 true
4. 同一实体在本块中的不同称呼写入 aliases；指代（他/她/它/其）若能明确对应某实体，可作为该实体的 alias 记录，不得臆测。
5. 任务流程连接 questConnections 的 fromStepId/toStepId 必须引用 questSteps 中已列出的步骤标题或序号，不得引用不存在的步骤。
6. 音美需求 avRequirements 必须标注 level（global/shot/step），并尽量给出 questName、stepTitle、shotId。
7. 分镜 storyboards 的 columns 必须根据原文实际字段动态生成，原文没有的字段不要杜撰列。

【输出 JSON 结构（所有数组可为空）】
{
  "textTypes": ["本块包含的文本类型，如 quest_doc / worldbuilding / character_profile / narrative_copy / storyboard / av_spec / dialogue_script / mixed"],
  "summary": "本块内容摘要（60~120字，基于原文）",
  "keywords": ["关键词"],
  "characters": [{ "name": "", "aliases": [], "identity": "", "personality": "", "goals": "", "bio": "", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "locations": [{ "name": "", "type": "", "description": "", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "factions": [{ "name": "", "description": "", "leader": "", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "items": [{ "name": "", "type": "", "description": "", "owner": "", "origin": "", "lore": "", "effects": "", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "events": [{ "name": "", "time": "", "location": "", "characters": [], "description": "", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "quests": [{ "name": "", "description": "", "objectives": [], "characters": [], "locations": [], "events": [], "prerequisites": [], "outcomes": [], "status": "active", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "questSteps": [{ "questName": "", "order": 1, "title": "", "summary": "", "stepType": "normal|start|action|dialogue|branch|choice|puzzle|battle|climax|ending", "location": "", "characters": [], "condition": "", "notes": "", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "questConnections": [{ "questName": "", "fromStepId": "", "toStepId": "", "type": "Next|Branch|Choice|Success|Failure|Ending|Merge|Loop", "label": "", "condition": "", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "narrativeCopy": [{ "type": "item_lore|voice_interactive|pv_trailer|letter|announcement|mail|document|loading_tip|tutorial|ui_copy|system_ui|dialogue|world_lore|skill_desc|activity|atmosphere|other", "title": "", "content": "", "flavorText": "", "characters": [], "questName": "", "relatedItemNames": [], "tags": [], "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "storyboards": [{ "title": "", "description": "", "questName": "", "columns": [{ "id": "", "label": "", "type": "text|number|select|multiline" }], "rows": [{ "shotNumber": "", "cells": { "列id": "内容" } }], "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "avRequirements": [{ "type": "Music|SFX|Voice|Art|VFX|Animation|Other", "title": "", "description": "", "level": "global|shot|step", "questName": "", "stepTitle": "", "shotId": "", "priority": "low|medium|high|urgent", "notes": "", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "performanceScripts": [{ "title": "", "description": "", "questName": "", "stepTitles": [], "status": "draft", "nodes": [{ "id": "n1", "type": "dialogue|narration|scene|action|choice|branch|ending", "speaker": "", "text": "", "side": "left|right|center", "options": [{ "id": "o1", "text": "", "targetNodeId": "", "targetStepTitle": "", "endingLabel": "", "condition": "" }], "targetNodeId": "", "targetStepTitle": "", "endingLabel": "", "condition": "", "orderIndex": 0 }], "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "themes": [{ "name": "", "coreConcept": "", "motif": "", "relatedCharacters": [], "relatedQuests": [], "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "lore": [{ "title": "", "category": "", "content": "", "relatedEntities": [], "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "annotations": [{ "text": "", "type": "Dialogue|Action|Conflict|Reveal|Foreshadowing|Choice|Consequence|Lore|Character Beat|Emotional Beat|Quest Beat|Theme", "note": "", "confidence": 0, "sourceSegment": "", "needsReview": false }],
  "dialogues": [{ "speaker": "", "text": "", "context": "" }],
  "relationships": [{ "source": "角色A", "target": "角色B", "type": "knows|likes|dislikes|trusts|conflicts_with|belongs_to|appears_in|located_in|reveals|foreshadows|causes|depends_on|related_to", "note": "" }]
}

【前文摘要（上一块结尾，仅作上下文参考，不要从中抽取本块不存在的内容）】
${chunk.prevTail || '（本块为开头）'}

【当前分块 ${chunk.index + 1}/${total}】${chunk.title ? `标题：${chunk.title}` : ''}
【待解析文本】
${chunk.text}`;
}

function normalizeCopyType(v: any): NarrativeCopyType {
  const raw = str(v);
  if (!raw) return 'other';
  const direct = COPY_TYPES.find((t) => t.toLowerCase() === raw.toLowerCase());
  if (direct) return direct;
  const key = normName(raw);
  const alias = COPY_TYPE_ALIASES[key] || COPY_TYPE_ALIASES[key.replace(/_/g, '')] || COPY_TYPE_ALIASES[key.replace(/_/g, '')];
  return alias ?? 'other';
}

/** 每块 AI 结果净化：枚举校验、字段裁剪、元数据补全（isLocal=true 时为保守降级） */
function sanitizeChunkResult(parsed: any, isLocal = false): Omit<Accumulated, 'chunkSummaries'> & { summary: string } {
  const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
  const M = (raw: any): ExtractionMeta => {
    const m = metaOf(raw);
    return isLocal ? { confidence: 0.35, needsReview: true, sourceSegment: m.sourceSegment } : m;
  };

  const out: Omit<Accumulated, 'chunkSummaries'> & { summary: string } = {
    characters: [], locations: [], factions: [], items: [], events: [], quests: [],
    questSteps: [], questConnections: [], themes: [], lore: [], annotations: [],
    narrativeCopy: [], storyboards: [], avRequirements: [], performanceScripts: [], dialogues: [],
    relationships: [], keywords: [], textTypes: [], summary: '',
  };

  out.textTypes = strArr(parsed?.textTypes, 12)
    .map((t) => normName(t))
    .filter(Boolean);
  out.summary = str(parsed?.summary, 400);
  out.keywords = strArr(parsed?.keywords, 16);

  out.characters = arr(parsed?.characters)
    .map((raw) => ({ ...raw, name: str(raw?.name, 80) }))
    .filter((raw) => raw.name)
    .map((raw) => ({
      name: raw.name,
      aliases: strArr(raw?.aliases, 12).filter((a) => normName(a) !== normName(raw.name)),
      identity: str(raw?.identity, 200),
      personality: str(raw?.personality, 800),
      goals: str(raw?.goals, 800),
      bio: str(raw?.bio, 2400),
      ...M(raw),
    }));

  out.locations = arr(parsed?.locations)
    .map((raw) => ({ ...raw, name: str(raw?.name, 80) }))
    .filter((raw) => raw.name)
    .map((raw) => ({
      name: raw.name,
      type: str(raw?.type, 80),
      description: str(raw?.description, 1600),
      ...M(raw),
    }));

  out.factions = arr(parsed?.factions)
    .map((raw) => ({ ...raw, name: str(raw?.name, 80) }))
    .filter((raw) => raw.name)
    .map((raw) => ({
      name: raw.name,
      description: str(raw?.description, 1600),
      leader: str(raw?.leader, 80),
      ...M(raw),
    }));

  out.items = arr(parsed?.items)
    .map((raw) => ({ ...raw, name: str(raw?.name, 80) }))
    .filter((raw) => raw.name)
    .map((raw) => ({
      name: raw.name,
      type: str(raw?.type, 80),
      description: str(raw?.description, 1600),
      owner: str(raw?.owner, 80),
      origin: str(raw?.origin, 300),
      lore: str(raw?.lore, 1600),
      effects: str(raw?.effects, 600),
      ...M(raw),
    }));

  out.events = arr(parsed?.events)
    .map((raw) => ({ ...raw, name: str(raw?.name, 120) }))
    .filter((raw) => raw.name)
    .map((raw) => ({
      name: raw.name,
      time: str(raw?.time, 80),
      location: str(raw?.location, 120),
      characters: strArr(raw?.characters, 12),
      description: str(raw?.description, 1600),
      ...M(raw),
    }));

  out.quests = arr(parsed?.quests)
    .map((raw) => ({ ...raw, name: str(raw?.name, 120) }))
    .filter((raw) => raw.name)
    .map((raw) => ({
      name: raw.name,
      description: str(raw?.description, 2400),
      objectives: strArr(raw?.objectives, 12),
      characters: strArr(raw?.characters, 12),
      locations: strArr(raw?.locations, 12),
      events: strArr(raw?.events, 12),
      prerequisites: strArr(raw?.prerequisites, 8),
      outcomes: strArr(raw?.outcomes, 8),
      status: enumOf(raw?.status, ['draft', 'active', 'completed', 'branched'] as const, 'active'),
      ...M(raw),
    }));

  out.questSteps = arr(parsed?.questSteps)
    .map((raw) => ({ ...raw, title: str(raw?.title, 160), summary: str(raw?.summary, 1600) }))
    .filter((raw) => raw.title || raw.summary)
    .map((raw, i) => ({
      title: raw.title || raw.summary.slice(0, 24),
      summary: raw.summary || raw.title,
      questName: str(raw?.questName, 120) || undefined,
      order: numVal(raw?.order) ?? i + 1,
      stepType: enumOf(raw?.stepType, QUEST_STEP_TYPES, 'normal'),
      location: str(raw?.location, 120),
      characters: strArr(raw?.characters, 12),
      condition: str(raw?.condition, 300),
      notes: str(raw?.notes, 600),
      ...M(raw),
    }));

  out.questConnections = arr(parsed?.questConnections)
    .map((raw) => ({
      fromStepId: str(raw?.fromStepId, 160),
      toStepId: str(raw?.toStepId, 160),
      questName: str(raw?.questName, 120),
      type: enumOf(raw?.type, CONNECTION_TYPES, 'Next'),
      label: str(raw?.label, 160),
      condition: str(raw?.condition, 300),
      ...M(raw),
    }))
    .filter((raw) => raw.fromStepId || raw.toStepId);

  out.narrativeCopy = arr(parsed?.narrativeCopy)
    .map((raw) => ({ ...raw, title: str(raw?.title, 160), content: str(raw?.content, 8000) }))
    .filter((raw) => raw.title || raw.content)
    .map((raw) => ({
      title: raw.title || (raw.content ? raw.content.slice(0, 24) : '未命名文案'),
      content: raw.content,
      type: normalizeCopyType(raw?.type),
      flavorText: str(raw?.flavorText, 600),
      characters: strArr(raw?.characters, 12),
      questName: str(raw?.questName, 120) || undefined,
      relatedItemNames: strArr(raw?.relatedItemNames, 12),
      tags: strArr(raw?.tags, 8),
      ...M(raw),
    }));

  out.storyboards = arr(parsed?.storyboards)
    .map((raw) => ({ ...raw, title: str(raw?.title, 160) }))
    .filter((raw) => Array.isArray(raw?.rows) && raw.rows.length > 0)
    .map((raw) => {
      const columns = arr(raw?.columns)
        .map((c) => ({
          id: str(c?.id, 60) || normName(c?.label) || str(c?.label, 60) || 'col',
          label: str(c?.label, 60) || str(c?.id, 60),
          type: enumOf(c?.type, ['text', 'number', 'select', 'multiline'] as const, 'text'),
          width: numVal(c?.width),
        }))
        .filter((c) => c.id);
      const rows = arr(raw?.rows)
        .map((r, rIdx) => ({
          id: str(r?.id, 80) || `row_${rIdx + 1}`,
          shotNumber: str(r?.shotNumber ?? r?.cells?.shotNumber, 40) || String(rIdx + 1),
          cells: (() => {
            const cells: Record<string, string> = {};
            const src = r?.cells && typeof r?.cells === 'object' ? r.cells : r;
            Object.entries(src || {}).forEach(([k, v]) => {
              if (k === 'id' || k === 'shotNumber') return;
              const sv = str(v, 2000);
              if (sv) cells[k] = sv;
            });
            return cells;
          })(),
        }))
        .slice(0, 400);
      return {
        title: raw.title || '分镜脚本',
        description: str(raw?.description, 800),
        questName: str(raw?.questName, 120) || undefined,
        columns,
        rows,
        ...M(raw),
      } as any;
    });

  out.avRequirements = arr(parsed?.avRequirements)
    .map((raw) => ({ ...raw, title: str(raw?.title, 160) }))
    .filter((raw) => raw.title || str(raw?.description))
    .map((raw) => ({
      title: raw.title || str(raw?.description, 40) || '音美需求',
      type: enumOf(raw?.type, AV_TYPES, 'Other'),
      description: str(raw?.description, 2000),
      level: enumOf(raw?.level, AV_LEVELS, 'global'),
      questName: str(raw?.questName, 120) || undefined,
      stepTitle: str(raw?.stepTitle, 160) || undefined,
      shotId: str(raw?.shotId, 60) || undefined,
      priority: enumOf(raw?.priority, ['low', 'medium', 'high', 'urgent'] as const, 'medium'),
      notes: str(raw?.notes, 600),
      ...M(raw),
    }));

  const SCRIPT_NODE_TYPES: string[] = ['dialogue', 'narration', 'scene', 'action', 'choice', 'branch', 'ending'];
  const SCRIPT_STATUSES: string[] = ['draft', 'review', 'final', 'archived'];
  const SCRIPT_SIDES: string[] = ['left', 'right', 'center'];
  out.performanceScripts = arr(parsed?.performanceScripts)
    .map((raw) => ({ ...raw, title: str(raw?.title, 160) }))
    .filter((raw) => raw.title || str(raw?.description) || (Array.isArray(raw?.nodes) && raw.nodes.length > 0))
    .map((raw) => {
      const nodes = arr(raw?.nodes)
        .map((n: any, ni: number) => {
          const nodeType = enumOf(n?.type, SCRIPT_NODE_TYPES, 'dialogue') as ScriptNodeType;
          const options = arr(n?.options)
            .map((o: any, oi: number) => ({
              id: str(o?.id, 40) || `opt_${ni}_${oi}`,
              text: str(o?.text, 600),
              targetNodeId: str(o?.targetNodeId, 60) || undefined,
              targetStepTitle: str(o?.targetStepTitle, 160) || undefined,
              endingLabel: str(o?.endingLabel, 120) || undefined,
              condition: str(o?.condition, 300) || undefined,
            }))
            .filter((o: any) => o.text);
          return {
            id: str(n?.id, 40) || `node_${ni}`,
            type: nodeType,
            speaker: str(n?.speaker, 80) || undefined,
            text: str(n?.text, 4000) || undefined,
            side: (enumOf(n?.side, SCRIPT_SIDES, 'left') as 'left' | 'right' | 'center') || undefined,
            options: nodeType === 'choice' ? options : undefined,
            targetNodeId: str(n?.targetNodeId, 60) || undefined,
            targetStepTitle: str(n?.targetStepTitle, 160) || undefined,
            endingLabel: str(n?.endingLabel, 120) || undefined,
            condition: str(n?.condition, 300) || undefined,
            orderIndex: typeof n?.orderIndex === 'number' ? n.orderIndex : ni,
            meta: str(n?.cue || n?.meta?.cue, 300) ? { cue: str(n?.cue || n?.meta?.cue, 300) } : undefined,
          };
        });
      return {
        title: raw.title || (nodes.length > 0 ? '演出剧本' : '剧本'),
        description: str(raw?.description, 2000),
        questName: str(raw?.questName, 120) || undefined,
        stepTitles: strArr(raw?.stepTitles, 12),
        status: enumOf(raw?.status, SCRIPT_STATUSES, 'draft') as ScriptStatus,
        nodes,
        startNodeId: nodes[0]?.id,
        ...M(raw),
      };
    });

  out.themes = arr(parsed?.themes)
    .map((raw) => ({ ...raw, name: str(raw?.name, 120) }))
    .filter((raw) => raw.name)
    .map((raw) => ({
      name: raw.name,
      coreConcept: str(raw?.coreConcept, 800),
      motif: str(raw?.motif, 300),
      relatedCharacters: strArr(raw?.relatedCharacters, 12),
      relatedQuests: strArr(raw?.relatedQuests, 12),
      ...M(raw),
    }));

  out.lore = arr(parsed?.lore)
    .map((raw) => ({ ...raw, title: str(raw?.title, 160), content: str(raw?.content, 6000) }))
    .filter((raw) => raw.title || raw.content)
    .map((raw) => ({
      title: raw.title || (raw.content ? raw.content.slice(0, 24) : '设定条目'),
      content: raw.content,
      category: str(raw?.category, 80) || '世界观',
      relatedEntities: strArr(raw?.relatedEntities, 16),
      ...M(raw),
    }));

  out.annotations = arr(parsed?.annotations)
    .map((raw) => ({ ...raw, text: str(raw?.text, 600) }))
    .filter((raw) => raw.text)
    .map((raw) => ({
      text: raw.text,
      type: enumOf(raw?.type, ANNOTATION_TYPES, 'Lore'),
      note: str(raw?.note, 800),
      ...M(raw),
    }));

  out.dialogues = arr(parsed?.dialogues)
    .map((raw) => ({
      speaker: str(raw?.speaker, 60),
      text: str(raw?.text, 1200),
      context: str(raw?.context, 300) || undefined,
    }))
    .filter((d) => d.speaker && d.text)
    .slice(0, 60);

  out.relationships = arr(parsed?.relationships)
    .map((raw) => ({
      source: str(raw?.source, 80),
      target: str(raw?.target, 80),
      type: enumOf(raw?.type, RELATION_TYPES, 'related_to'),
      note: str(raw?.note, 300) || undefined,
    }))
    .filter((r) => r.source && r.target);

  return out;
}

/* ============================================================
 * 本地保守降级解析（无 AI / AI 失败时使用，绝不编造内容）
 * ============================================================ */

function localChunkExtract(chunk: TextChunk): ReturnType<typeof sanitizeChunkResult> {
  const lines = chunk.text.split(/\r?\n/).map((l) => l.trim());
  const result = sanitizeChunkResult({}, true);

  const seg = (i: number) => lines.slice(Math.max(0, i - 1), i + 1).join(' / ').slice(0, 120);
  const mkMeta = (i: number): ExtractionMeta => ({ confidence: 0.35, needsReview: true, sourceSegment: seg(i) });

  const copyHeaderRe = /^【([^】]{1,48})】(.*)$/;
  const shotRe = /^(?:【?(?:镜头|Shot|分镜)\s*([0-9A-Za-z\-_]+)】?|#+\s*镜头\s*([0-9A-Za-z\-_]+))\s*[:：]?\s*(.*)$/i;
  const stepRe = /^(?:【?(?:步骤|Step|阶段|节点)\s*([0-9一二三四五六七八九十]+)】?|#+\s*步骤\s*([0-9]+))\s*[:：]?\s*(.*)$/i;
  const avRe = /(?:【?(音效|配乐|BGM|音乐|SFX|配音|Voice|CV|美术|原画|立绘|特效|VFX|动画|环境声|演出)[：:】])\s*(.*)/i;
  const dialogueRe = /^([^\s:：]{1,12})[：:]\s*(.+)$/;

  const copyTypeOf = (tag: string): NarrativeCopyType => normalizeCopyType(tag);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const copyMatch = line.match(copyHeaderRe);
    if (copyMatch) {
      const tag = copyMatch[1];
      const title = copyMatch[2].trim() || tag;
      // 收集后续非小节头内容作为正文
      const bodyLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !copyHeaderRe.test(lines[j]) && !shotRe.test(lines[j]) && !stepRe.test(lines[j])) {
        if (lines[j]) bodyLines.push(lines[j]);
        j++;
      }
      const content = bodyLines.join('\n');
      const type = copyTypeOf(tag);
      if (type === 'world_lore' || tag.includes('设定') || tag.includes('世界观')) {
        result.lore.push({
          title,
          content: content || title,
          category: tag.includes('规则') ? '规则' : '世界观',
          relatedEntities: [],
          ...mkMeta(i),
        });
      } else {
        result.narrativeCopy.push({
          type,
          title,
          content: content || title,
          tags: [tag],
          ...mkMeta(i),
        });
      }
      continue;
    }

    const shotMatch = line.match(shotRe);
    if (shotMatch) {
      const shotNum = shotMatch[1] || shotMatch[2] || String(result.storyboards.length + 1);
      const rest = shotMatch[3] || '';
      let sb = result.storyboards.find((s) => s.title === '本地结构分镜');
      if (!sb) {
        sb = {
          title: '本地结构分镜',
          description: '基于「镜头N」结构的保守提取，字段需人工确认',
          columns: [
            { id: 'shotNumber', label: '镜头编号', type: 'number', width: 90 },
            { id: 'visual', label: '画面/动作', type: 'text', width: 240 },
            { id: 'dialogue', label: '台词/旁白', type: 'text', width: 200 },
          ],
          rows: [],
          ...mkMeta(i),
        } as any;
        result.storyboards.push(sb);
      }
      const cells: Record<string, string> = {};
      const row: any = { id: `shot_${shotNum}`, shotNumber: shotNum, cells };
      if (rest) {
        if (/景别|机位|全景|特写|中景|远景|俯拍|仰拍/.test(rest)) cells.camera = rest;
        else if (/台词|对白|旁白|说|道：/.test(rest)) cells.dialogue = rest;
        else cells.visual = rest;
      }
      sb.rows!.push(row);
      continue;
    }

    const stepMatch = line.match(stepRe);
    if (stepMatch) {
      const stepNum = stepMatch[1] || stepMatch[2] || '';
      const desc = stepMatch[3] || '';
      result.questSteps.push({
        title: `步骤 ${stepNum}: ${desc.slice(0, 20) || '待确认'}`,
        summary: desc || line,
        order: result.questSteps.length + 1,
        stepType: 'normal',
        ...mkMeta(i),
      });
      continue;
    }

    const avMatch = line.match(avRe);
    if (avMatch) {
      const tag = avMatch[1];
      const content = avMatch[2] || line;
      let type: AVReqType = 'SFX';
      if (/BGM|配乐|音乐/.test(tag)) type = 'Music';
      else if (/配音|Voice|CV/.test(tag)) type = 'Voice';
      else if (/美术|原画|立绘/.test(tag)) type = 'Art';
      else if (/特效|VFX/.test(tag)) type = 'VFX';
      else if (/动画|演出/.test(tag)) type = 'Animation';
      let level: AVReqLevel = 'global';
      if (/镜头|Shot/i.test(line)) level = 'shot';
      else if (/步骤|Step/i.test(line)) level = 'step';
      result.avRequirements.push({
        title: `${tag}：${content.slice(0, 26)}`,
        type,
        description: line,
        level,
        ...mkMeta(i),
      });
      continue;
    }

    const dMatch = line.match(dialogueRe);
    if (dMatch && !line.startsWith('#') && !line.includes('http') && dMatch[1].length <= 12) {
      result.dialogues.push({ speaker: dMatch[1], text: dMatch[2] });
      const known = result.characters.find((c) => c.name === dMatch[1]);
      if (!known) {
        result.characters.push({ name: dMatch[1], ...mkMeta(i) });
      }
      continue;
    }
  }

  // 本地提取的相邻步骤按顺序建立 Next 连接
  const steps = result.questSteps;
  for (let i = 0; i + 1 < steps.length; i++) {
    result.questConnections.push({
      fromStepId: steps[i].title,
      toStepId: steps[i + 1].title,
      type: 'Next',
      label: '顺序推进（本地结构推断）',
      confidence: 0.35,
      needsReview: true,
    });
  }

  result.textTypes = ['mixed'];
  result.summary = '';
  result.keywords = [];
  return result;
}

/* ============================================================
 * 阶段4：实体合并与关系校验
 * ============================================================ */

interface MergeResult {
  acc: Accumulated;
  mergedCount: number;
  aliasMerges: Array<{ category: string; canonical: string; aliases: string[] }>;
}

function mergeMeta(a: ExtractionMeta, b: ExtractionMeta): ExtractionMeta {
  return {
    confidence: Math.max(a.confidence ?? 0, b.confidence ?? 0),
    sourceSegment: a.sourceSegment || b.sourceSegment,
    needsReview: !!(a.needsReview || b.needsReview),
  };
}

function unionStrings(a: string[] | undefined, b: string[] | undefined, max = 24): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...(a || []), ...(b || [])]) {
    const k = normName(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** 将 src 合并进 dst（保留更完整的信息，不编造） */
function mergeInto(dst: any, src: any, nameKey: 'name' | 'title'): any {
  dst.confidence = Math.max(dst.confidence ?? 0, src.confidence ?? 0);
  dst.needsReview = !!(dst.needsReview || src.needsReview);
  dst.sourceSegment = dst.sourceSegment || src.sourceSegment;
  for (const key of Object.keys(src)) {
    if (key === nameKey || key === 'confidence' || key === 'needsReview' || key === 'sourceSegment') continue;
    const sv = src[key];
    const dv = dst[key];
    if (sv === undefined || sv === null || sv === '') continue;
    if (Array.isArray(sv)) {
      dst[key] = unionStrings(dv as string[], sv);
    } else if (typeof sv === 'string') {
      if (!dv) dst[key] = sv;
      else if (normName(String(dv)) !== normName(sv) && sv.length > String(dv).length) dst[key] = sv;
    } else if (typeof sv === 'object') {
      // 嵌套对象（如 storyboard columns/rows 由调用方特判）
      if (!dv) dst[key] = sv;
    } else {
      if (dv === undefined || dv === null) dst[key] = sv;
    }
  }
  return dst;
}

function dedupeList<T>(list: T[], nameKey: 'name' | 'title', category: string, mergeResult: MergeResult): T[] {
  const map = new Map<string, T>();
  const order: string[] = [];
  for (const item of list) {
    const key = normName((item as any)[nameKey]);
    const existing = map.get(key);
    if (existing) {
      mergeInto(existing, item, nameKey);
      mergeResult.mergedCount++;
      const aliasEntry = mergeResult.aliasMerges.find((m) => m.category === category && normName(m.canonical) === normName((existing as any)[nameKey]));
      const other = (item as any)[nameKey];
      if (aliasEntry && normName(aliasEntry.canonical) !== normName(other)) {
        if (!aliasEntry.aliases.some((a) => normName(a) === normName(other))) aliasEntry.aliases.push(other);
      }
    } else {
      map.set(key, item);
      order.push(key);
    }
  }
  return order.map((k) => map.get(k)!);
}

function localMerge(acc: Accumulated): MergeResult {
  const mergeResult: MergeResult = { acc, mergedCount: 0, aliasMerges: [] };

  acc.characters = dedupeList(acc.characters, 'name', 'characters', mergeResult);
  acc.locations = dedupeList(acc.locations, 'name', 'locations', mergeResult);
  acc.factions = dedupeList(acc.factions, 'name', 'factions', mergeResult);
  acc.items = dedupeList(acc.items, 'name', 'items', mergeResult);
  acc.events = dedupeList(acc.events, 'name', 'events', mergeResult);
  acc.quests = dedupeList(acc.quests, 'name', 'quests', mergeResult);
  acc.questSteps = dedupeList(acc.questSteps, 'title', 'questSteps', mergeResult);
  acc.themes = dedupeList(acc.themes, 'name', 'themes', mergeResult);
  acc.lore = dedupeList(acc.lore, 'title', 'lore', mergeResult);

  // 叙事连接：同 from+to+type 合并
  {
    const map = new Map<string, ConnCand>();
    const order: string[] = [];
    for (const c of acc.questConnections) {
      const key = `${normName(c.fromStepId)}>${normName(c.toStepId)}>${c.type}`;
      const existing = map.get(key);
      if (existing) {
        mergeInto(existing, c, 'name');
        mergeResult.mergedCount++;
      } else {
        map.set(key, c);
        order.push(key);
      }
    }
    acc.questConnections = order.map((k) => map.get(k)!);
  }

  // 文本包装：同标题合并；正文完全重复的合并
  {
    const map = new Map<string, CopyCand>();
    const order: string[] = [];
    for (const c of acc.narrativeCopy) {
      const key = normName(c.title);
      const existing = map.get(key);
      if (existing) {
        if (normName(existing.content || '') === normName(c.content || '')) {
          mergeInto(existing, c, 'name');
        } else if ((c.content || '').length > (existing.content || '').length) {
          // 同名不同正文：保留更长正文并标记需确认
          mergeInto(c, existing, 'name');
          map.set(key, c);
        } else {
          mergeInto(existing, c, 'name');
        }
        existing.needsReview = true; // 同名多条，需人工确认
        mergeResult.mergedCount++;
      } else {
        map.set(key, c);
        order.push(key);
      }
    }
    acc.narrativeCopy = order.map((k) => map.get(k)!);
  }

  // 分镜：同标题合并（columns 取并集，rows 按 shotNumber 去重合并）
  {
    const map = new Map<string, SbCand>();
    const order: string[] = [];
    for (const sb of acc.storyboards) {
      const key = normName(sb.title);
      const existing = map.get(key);
      if (existing) {
        // 合并动态列
        const colMap = new Map<string, any>();
        for (const c of [...(existing.columns || []), ...(sb.columns || [])]) {
          const cid = normName(c.id || c.label);
          if (!cid || colMap.has(cid)) continue;
          colMap.set(cid, c);
        }
        existing.columns = Array.from(colMap.values());
        // 合并行
        const rowMap = new Map<string, any>();
        for (const r of [...(existing.rows || []), ...(sb.rows || [])]) {
          const rk = normName(r.shotNumber) || r.id;
          if (rowMap.has(rk)) {
            const base = rowMap.get(rk);
            base.cells = { ...base.cells, ...r.cells };
          } else {
            rowMap.set(rk, r);
          }
        }
        existing.rows = Array.from(rowMap.values());
        mergeInto(existing, sb, 'name');
        mergeResult.mergedCount++;
      } else {
        map.set(key, sb);
        order.push(key);
      }
    }
    acc.storyboards = order.map((k) => map.get(k)!);
  }

  // 音美需求：同 title+type 合并
  {
    const map = new Map<string, AvCand>();
    const order: string[] = [];
    for (const av of acc.avRequirements) {
      const key = `${normName(av.title)}|${av.type}`;
      const existing = map.get(key);
      if (existing) {
        mergeInto(existing, av, 'name');
        mergeResult.mergedCount++;
      } else {
        map.set(key, av);
        order.push(key);
      }
    }
    acc.avRequirements = order.map((k) => map.get(k)!);
  }

  // 角色：把其他条目中的别名信息合并进 aliases
  for (const m of mergeResult.aliasMerges) {
    if (m.category !== 'characters') continue;
    const c = acc.characters.find((x) => normName(x.name) === normName(m.canonical));
    if (c) c.aliases = unionStrings(c.aliases, m.aliases);
  }

  // 对白去重
  {
    const seen = new Set<string>();
    acc.dialogues = acc.dialogues.filter((d) => {
      const k = `${normName(d.speaker)}|${normName(d.text)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  return mergeResult;
}

/** AI 合并消歧（别名归并 / 指代消解），失败时静默跳过 */
async function aiMergePass(acc: Accumulated, settings: AISettings): Promise<number> {
  const digest = {
    characters: acc.characters.slice(0, 60).map((c) => ({ name: c.name, aliases: c.aliases?.slice(0, 6), identity: str(c.identity, 40), bio: str(c.bio, 60) })),
    locations: acc.locations.slice(0, 40).map((l) => ({ name: l.name, type: str(l.type, 30) })),
    factions: acc.factions.slice(0, 30).map((f) => ({ name: f.name })),
    items: acc.items.slice(0, 40).map((i) => ({ name: i.name, type: str(i.type, 30) })),
    quests: acc.quests.slice(0, 40).map((q) => ({ name: q.name, description: str(q.description, 60) })),
    events: acc.events.slice(0, 40).map((e) => ({ name: e.name, time: str(e.time, 30) })),
  };

  const prompt = `你是实体消歧引擎。以下是从同一篇长文本不同分块中抽取的实体列表（JSON）。请找出：
1. merges: 指同一实体的不同抽取条目（重复/变体命名），给出归并方案。
2. aliases: 某实体的别名/简称/称呼（含可确定的代词归属），补充到该实体。
只能基于给定信息判断，不得猜测不确定的合并；若无则返回空数组。

【输入】
${JSON.stringify(digest)}

【输出 JSON】
{
  "merges": [{ "category": "characters|locations|factions|items|quests|events", "keep": "保留条目名", "merge": ["被合并条目名"] }],
  "aliases": [{ "category": "characters|locations|factions|items|quests|events", "name": "实体名", "add": ["别名1", "别名2"] }]
}`;

  let parsed: any;
  try {
    parsed = await callQwenJSON(prompt, settings, { temperature: 0.1, timeoutMs: 90000 });
  } catch {
    return 0; // 静默跳过，本地合并已保证可用性
  }

  let applied = 0;
  const findEntry = (category: string, name: string): any => {
    const list = (acc as any)[category] as any[] | undefined;
    if (!list) return undefined;
    const key = normName(name);
    return list.find((x) => normName(x.name) === key || normName(x.title) === key);
  };

  for (const m of Array.isArray(parsed?.merges) ? parsed.merges : []) {
    const category = str(m?.category);
    if (!['characters', 'locations', 'factions', 'items', 'quests', 'events'].includes(category)) continue;
    const list = (acc as any)[category] as any[];
    const keep = findEntry(category, str(m?.keep));
    if (!keep) continue;
    for (const mergeName of strArr(m?.merge, 10)) {
      const src = findEntry(category, mergeName);
      if (!src || src === keep) continue;
      mergeInto(keep, src, 'name');
      const idx = list.indexOf(src);
      if (idx >= 0) list.splice(idx, 1);
      applied++;
    }
  }

  for (const a of Array.isArray(parsed?.aliases) ? parsed.aliases : []) {
    const category = str(a?.category);
    const entry = findEntry(category, str(a?.name));
    if (!entry) continue;
    const additions = strArr(a?.add, 10).filter((x) => normName(x) !== normName(entry.name));
    if (additions.length === 0) continue;
    entry.aliases = unionStrings(entry.aliases, additions);
    applied++;
  }

  return applied;
}

interface ValidateResult {
  warnings: string[];
  flaggedCount: number;
}

function validateAndFlag(acc: Accumulated): ValidateResult {
  const warnings: string[] = [];
  let flaggedCount = 0;
  const flag = () => flaggedCount++;

  // —— 任务流程校验 ——
  const stepTitleKeys = new Set<string>();
  acc.questSteps.forEach((s) => {
    stepTitleKeys.add(normName(s.title));
  });
  // 补充：标题去掉「步骤N:」前缀后的 key
  acc.questSteps.forEach((s) => {
    const stripped = normName(String(s.title || '').replace(/^步骤[^:：]*[:：]/, ''));
    if (stripped) stepTitleKeys.add(stripped);
  });
  const questNameKeys = new Set(acc.quests.map((q) => normName(q.name)).filter(Boolean));

  // 步骤归属校验：questName 无法对应 → 仅一个任务时自动归属，否则标记需确认
  for (const s of acc.questSteps) {
    const qn = normName((s as any).questName);
    if (qn && !questNameKeys.has(qn)) {
      if (acc.quests.length === 1) {
        (s as any).questName = acc.quests[0].name;
      } else {
        s.needsReview = true;
        flag();
      }
    } else if (!qn && acc.quests.length > 0) {
      s.needsReview = true;
      flag();
    }
  }

  // 连接端点校验
  const keptConnections: ConnCand[] = [];
  for (const c of acc.questConnections) {
    const from = normName(c.fromStepId);
    const to = normName(c.toStepId);
    if ((from || to) && from === to) {
      warnings.push(`已剔除自环连接「${c.fromStepId} → ${c.toStepId}」`);
      continue;
    }
    if (from && !stepTitleKeys.has(from)) {
      const fuzzy = acc.questSteps.find((s) => {
        const t = normName(s.title);
        return t && (t.includes(from) || from.includes(t));
      });
      if (fuzzy) c.fromStepId = fuzzy.title;
      else {
        c.needsReview = true;
        flag();
        warnings.push(`连接起点「${c.fromStepId}」未能匹配任何任务步骤，已标记需确认`);
      }
    }
    if (to && !stepTitleKeys.has(to)) {
      const fuzzy = acc.questSteps.find((s) => {
        const t = normName(s.title);
        return t && (t.includes(to) || to.includes(t));
      });
      if (fuzzy) c.toStepId = fuzzy.title;
      else {
        c.needsReview = true;
        flag();
        warnings.push(`连接终点「${c.toStepId}」未能匹配任何任务步骤，已标记需确认`);
      }
    }
    keptConnections.push(c);
  }
  acc.questConnections = keptConnections;

  // 孤立步骤检测（多于1步时才判定）
  if (acc.questSteps.length > 1) {
    const referenced = new Set<string>();
    acc.questConnections.forEach((c) => {
      referenced.add(normName(c.fromStepId));
      referenced.add(normName(c.toStepId));
    });
    for (const s of acc.questSteps) {
      const linked = referenced.has(normName(s.title)) || acc.questSteps.some((_, i) => false);
      if (!linked) {
        s.needsReview = true;
        flag();
      }
    }
  }

  // —— 关系校验 ——
  const charKeys = new Set<string>();
  acc.characters.forEach((c) => {
    charKeys.add(normName(c.name));
    (c.aliases || []).forEach((a) => charKeys.add(normName(a)));
  });
  acc.relationships = acc.relationships.filter((r) => {
    if (!charKeys.has(normName(r.source))) {
      warnings.push(`关系来源「${r.source}」未匹配到角色，已丢弃该条关系`);
      return false;
    }
    if (!charKeys.has(normName(r.target))) {
      warnings.push(`关系目标「${r.target}」未匹配到角色，已保留但标记需确认`);
      const c = acc.characters.find((x) => normName(x.name) === normName(r.source));
      if (c) {
        c.needsReview = true;
        flag();
      }
    }
    return true;
  });

  // —— 低置信度兜底标记 ——
  const flagLow = (list: any[]) => {
    for (const item of list) {
      const conf = item.confidence ?? 0.5;
      if (conf < 0.55 && !item.needsReview) {
        item.needsReview = true;
        flag();
      }
    }
  };
  [acc.characters, acc.locations, acc.factions, acc.items, acc.events, acc.quests, acc.questSteps, acc.questConnections, acc.themes, acc.lore, acc.annotations, acc.narrativeCopy, acc.storyboards, acc.avRequirements]
    .forEach(flagLow);

  return { warnings, flaggedCount };
}

/* ============================================================
 * 阶段5：结果整理
 * ============================================================ */

function finalize(acc: Accumulated, report: ParseReport): EntityExtractionResult {
  const summary =
    acc.chunkSummaries.filter(Boolean).slice(0, 3).join('；').slice(0, 360) ||
    '（AI 未能生成摘要，请结合各条目来源片段审阅）';

  return {
    summary,
    keywords: Array.from(new Set(acc.keywords)).slice(0, 12),
    characters: acc.characters,
    locations: acc.locations,
    factions: acc.factions,
    items: acc.items,
    events: acc.events,
    quests: acc.quests,
    questSteps: acc.questSteps,
    questConnections: acc.questConnections,
    themes: acc.themes,
    lore: acc.lore,
    annotations: acc.annotations,
    narrativeCopy: acc.narrativeCopy,
    storyboards: acc.storyboards,
    avRequirements: acc.avRequirements,
    performanceScripts: acc.performanceScripts,
    dialogues: acc.dialogues,
    choices: [],
    relationships: acc.relationships,
    report,
  };
}

/* ============================================================
 * 主入口：五阶段解析管线
 * ============================================================ */

export async function runNarrativeParsing(
  text: string,
  settings: AISettings,
  mode: ParseMode = 'smart',
  onProgress?: (msg: string) => void
): Promise<EntityExtractionResult> {
  const startedAt = Date.now();
  if (!text || !text.trim()) throw new Error('待解析文本为空。');
  const modeLabel = PARSE_MODE_OPTIONS.find((m) => m.id === mode)?.label || '智能综合解析';

  const stages: ParseReport['stages'] = [];
  const warnings: string[] = [];
  let aiCalls = 0;
  let fallbackChunks = 0;
  const logStage = (stage: string, detail: string) => {
    stages.push({ stage, detail, at: Date.now() - startedAt });
  };

  // —— 阶段1：结构理解 ——
  onProgress?.('阶段1/5：结构理解 · 正在按标题/章节/场景智能分块...');
  const { chunks, truncated } = chunkText(text);
  if (truncated) warnings.push(`文本过长，仅解析前 ${MAX_CHUNKS} 个分块（约 ${(text.length / 1).toFixed(0)} 字符中的一部分），其余内容未解析。`);
  logStage('阶段1 结构理解', `切分为 ${chunks.length} 个分块，保留块间上下文摘要`);
  onProgress?.(`阶段1/5：完成分块，共 ${chunks.length} 块`);

  const acc = emptyAccumulated();
  const useAI = settings.provider === 'qwen' && !!settings.qwenApiKey?.trim();

  // —— 阶段2/3：分块抽取 ——
  for (const chunk of chunks) {
    onProgress?.(`阶段2/5 · 实体与生产内容抽取：分块 ${chunk.index + 1}/${chunks.length}（${modeLabel}）`);
    if (useAI) {
      let parsed: any = null;
      try {
        parsed = await callQwenJSON(buildChunkPrompt(chunk, mode, chunks.length), settings, { temperature: 0.1, timeoutMs: 150000 });
        aiCalls++;
      } catch (err: any) {
        // 重试一次（截短分块以降低负载）
        try {
          const shortened = { ...chunk, text: chunk.text.slice(0, Math.ceil(chunk.text.length * 0.6)) };
          parsed = await callQwenJSON(buildChunkPrompt(shortened, mode, chunks.length), settings, { temperature: 0.1, timeoutMs: 120000 });
          aiCalls++;
          warnings.push(`分块 ${chunk.index + 1} 首次解析失败，已用截短文本重试成功`);
        } catch (retryErr: any) {
          fallbackChunks++;
          warnings.push(`分块 ${chunk.index + 1} AI 解析失败（${String(retryErr?.message || retryErr).slice(0, 120)}），已用本地保守提取替代`);
        }
      }
      if (parsed) {
        const sanitized = sanitizeChunkResult(parsed);
        accumulateChunk(acc, sanitized);
      } else {
        const local = localChunkExtract(chunk);
        accumulateChunk(acc, local);
      }
    } else {
      const local = localChunkExtract(chunk);
      accumulateChunk(acc, local);
      fallbackChunks++;
    }
  }
  logStage('阶段2/3 实体与生产内容抽取', `AI 调用 ${aiCalls} 次，本地降级 ${fallbackChunks} 块`);

  // —— 阶段4：合并与校验 ——
  onProgress?.('阶段4/5：实体合并 · 别名归并与指代消歧...');
  const { mergedCount, aliasMerges } = localMerge(acc);

  let aiMerged = 0;
  if (useAI && aiCalls > 0) {
    onProgress?.('阶段4/5：AI 语义消歧 · 跨分块实体归并...');
    aiMerged = await aiMergePass(acc, settings);
    if (aiMerged > 0) aiCalls++;
    // AI 合并后再次本地去重（合并可能产生重复别名键）
    localMerge(acc);
  }
  logStage('阶段4 合并与校验', `本地合并 ${mergedCount} 处，AI 消歧 ${aiMerged} 处`);

  onProgress?.('阶段4/5：关系校验 · 检查流程连接与孤立步骤...');
  const { warnings: vWarnings, flaggedCount } = validateAndFlag(acc);
  warnings.push(...vWarnings);
  logStage('阶段4 关系校验', `标记 ${flaggedCount} 条待确认，${vWarnings.length} 条警告`);

  // —— 阶段5：结果整理 ——
  onProgress?.('阶段5/5：结果整理 · 生成结构化预览...');
  const report: ParseReport = {
    mode,
    modeLabel,
    detectedTypes: Array.from(new Set(acc.textTypes)).slice(0, 10),
    chunks: chunks.map((c) => ({ index: c.index, title: c.title, chars: c.text.length })),
    stages,
    warnings,
    aliasMerges,
    stats: {
      chunkCount: chunks.length,
      aiCalls,
      mergedCount: mergedCount + aiMerged,
      flaggedCount,
      fallbackChunks,
      durationMs: Date.now() - startedAt,
    },
  };
  const result = finalize(acc, report);
  logStage('阶段5 结果整理', `共 ${countTotal(result)} 条候选结果，等待用户确认`);
  result.report = report;

  return result;
}

function accumulateChunk(acc: Accumulated, chunk: ReturnType<typeof sanitizeChunkResult>) {
  acc.characters.push(...(chunk.characters as CharCand[]));
  acc.locations.push(...(chunk.locations as LocCand[]));
  acc.factions.push(...(chunk.factions as FacCand[]));
  acc.items.push(...(chunk.items as ItemCand[]));
  acc.events.push(...(chunk.events as EventCand[]));
  acc.quests.push(...(chunk.quests as QuestCand[]));
  acc.questSteps.push(...(chunk.questSteps as StepCand[]));
  acc.questConnections.push(...(chunk.questConnections as ConnCand[]));
  acc.themes.push(...(chunk.themes as ThemeCand[]));
  acc.lore.push(...(chunk.lore as LoreCand[]));
  acc.annotations.push(...(chunk.annotations as AnnotCand[]));
  acc.narrativeCopy.push(...(chunk.narrativeCopy as CopyCand[]));
  acc.storyboards.push(...(chunk.storyboards as SbCand[]));
  acc.avRequirements.push(...(chunk.avRequirements as AvCand[]));
  acc.performanceScripts.push(...(chunk.performanceScripts as ScriptCand[]));
  acc.dialogues.push(...chunk.dialogues);
  acc.relationships.push(...chunk.relationships);
  acc.keywords.push(...chunk.keywords);
  acc.textTypes.push(...chunk.textTypes);
  if (chunk.summary) acc.chunkSummaries.push(chunk.summary);
}

function countTotal(result: EntityExtractionResult): number {
  return (
    result.characters.length + result.locations.length + result.factions.length + result.items.length +
    result.events.length + result.quests.length + (result.questSteps?.length || 0) + (result.questConnections?.length || 0) +
    result.themes.length + result.lore.length + (result.annotations?.length || 0) + (result.narrativeCopy?.length || 0) +
    (result.storyboards?.length || 0) + (result.avRequirements?.length || 0) +
    (result.performanceScripts?.length || 0)
  );
}

/* ============================================================
 * 保存前自动关联上下文（供 LabView 在入库时解析名称 → 预生成 ID）
 * 仅建立可确定的关联；无法确定时返回空字符串，不做猜测。
 * ============================================================ */

export interface LabAssociationContext {
  plannedIds: {
    characters: string[]; quests: string[]; questSteps: string[]; questConnections: string[];
    narrativeCopy: string[]; storyboards: string[]; avRequirements: string[]; performanceScripts: string[]; lore: string[];
    locations: string[]; factions: string[]; items: string[]; events: string[]; themes: string[]; annotations: string[];
  };
  characterIdByName: Record<string, string>;
  questIdByName: Record<string, string>;
  eventIdByName: Record<string, string>;
  stepIdByTitle: Record<string, string>;
  questIdByStepTitle: Record<string, string>;
  locationIdByName: Record<string, string>;
  factionIdByName: Record<string, string>;
  itemIdByName: Record<string, string>;
  copyIdByTitle: Record<string, string>;
  storyboardIdByTitle: Record<string, string>;
  buildCharacterRelations: (name?: string) => CharacterRelation[];
  resolveStepIdRef: (ref?: string) => string;
  resolveQuestIdByName: (name?: string) => string;
  resolveQuestIdForStep: (raw: any, index: number) => string;
  resolveQuestIdForConnection: (raw: any) => string;
  resolveQuestIdForStoryboard: (raw: any, index: number) => string;
  resolveScriptLinks: (raw: any) => { questId: string; stepIds: string[] };
  resolveCharacterIds: (names?: string[]) => string[];
  resolveItemIds: (names?: string[]) => string[];
  resolveEventIds: (names?: string[]) => string[];
  resolveLocationIds: (names?: string[]) => string[];
  resolveAvLinks: (raw: any) => { questId: string; stepId: string; shotId: string };
  resolveAnnotationEntity: (raw: any) => string;
}

/** 名称 → 实体下标（含别名匹配），唯一命中才返回 */
function matchIndexByName(names: string[], key: string): number {
  const k = normName(key);
  if (!k) return -1;
  const exact = names.findIndex((n) => normName(n) === k);
  if (exact >= 0) return exact;
  const contains = names.filter((n) => {
    const t = normName(n);
    return t && (t.includes(k) || k.includes(t));
  });
  return contains.length === 1 ? names.indexOf(contains[0]) : -1;
}

/** 每类实体在「保存前」可确定性建立的关联补丁（按下标对齐；无法确定的关联留空，不猜测） */
export interface SaveAssociationPatches {
  characters: Array<{ relationships: CharacterRelation[]; quests: string[]; locations: string[]; events: string[]; themes: string[] }>;
  quests: Array<{ characters: string[]; locations: string[]; events: string[] }>;
  questSteps: Array<{ questId: string; characters: string[]; locationId: string }>;
  questConnections: Array<{ questId: string; fromStepId: string; toStepId: string }>;
  narrativeCopy: Array<{ questId: string; characters: string[]; relatedItemIds: string[] }>;
  storyboards: Array<{ questId: string }>;
  avRequirements: Array<{ questId: string; stepId: string; shotId: string }>;
  performanceScripts: Array<{ questId: string; stepIds: string[] }>;
  annotations: Array<{ relatedEntityId: string }>;
  locations: Array<{ events: string[] }>;
  events: Array<{ characters: string[]; locationId: string }>;
}

/**
 * 计算保存时应用的关联补丁。
 * @param willSave (category, index) => boolean —— 仅向「本次将被保存」的实体建立关联，避免悬空引用
 */
export function computeAssociationPatches(
  result: EntityExtractionResult,
  assoc: LabAssociationContext,
  willSave: (category: string, index: number) => boolean
): SaveAssociationPatches {
  const { plannedIds } = assoc;

  // —— 辅助：名称（含别名）是否命中某实体的名字集合 ——
  const charNameLists = (result.characters || []).map((c) => [c.name, ...(c.aliases || [])].filter(Boolean));
  const locationNames = (result.locations || []).map((l) => l.name);
  const themeCharLists = (result.themes || []).map((th) => th.relatedCharacters || []);

  const charMatches = (idx: number, name: string) => charNameLists[idx]?.some((n) => normName(n) === normName(name)) ?? false;
  const charReferencedBy = (names: string[] | undefined): number[] => {
    const out: number[] = [];
    (names || []).forEach((n) => {
      const i = matchIndexByName((result.characters || []).map((c) => c.name), n) >= 0
        ? matchIndexByName((result.characters || []).map((c) => c.name), n)
        : charNameLists.findIndex((list) => list.some((x) => normName(x) === normName(n)));
      if (i >= 0 && !out.includes(i)) out.push(i);
    });
    return out;
  };

  const patches: SaveAssociationPatches = {
    characters: [], quests: [], questSteps: [], questConnections: [],
    narrativeCopy: [], storyboards: [], avRequirements: [], performanceScripts: [], annotations: [],
    locations: [], events: [],
  };

  // —— 角色 ↔ 任务 / 事件 / 主题 / 地点（由任务/事件/主题/步骤中明确出现的角色名推导）——
  (result.characters || []).forEach((c, i) => {
    const relationships = assoc
      .buildCharacterRelations(c.name)
      .filter((r) => {
        if (!r.targetId) return false;
        const tIdx = plannedIds.characters.indexOf(r.targetId);
        return tIdx >= 0 && willSave('characters', tIdx);
      });
    const questIds = (result.quests || [])
      .map((q, qi) => ({ q, qi }))
      .filter(({ q, qi }) => willSave('quests', qi) && (q.characters || []).some((n) => charMatches(i, n)))
      .map(({ qi }) => plannedIds.quests[qi]);
    const eventIds = (result.events || [])
      .map((e, ei) => ({ e, ei }))
      .filter(({ e, ei }) => willSave('events', ei) && (e.characters || []).some((n) => charMatches(i, n)))
      .map(({ ei }) => plannedIds.events[ei]);
    const themeIds = (result.themes || [])
      .map((th, ti) => ({ th, ti }))
      .filter(({ ti }) => willSave('themes', ti) && (themeCharLists[ti] || []).some((n) => charMatches(i, n)))
      .map(({ ti }) => plannedIds.themes[ti]);
    const locIdSet = new Set<string>();
    (result.events || []).forEach((e, ei) => {
      if (!willSave('events', ei)) return;
      const li = matchIndexByName(locationNames, e.location || '');
      if (li >= 0 && willSave('locations', li) && (e.characters || []).some((n) => charMatches(i, n))) locIdSet.add(plannedIds.locations[li]);
    });
    (result.questSteps || []).forEach((s, si) => {
      if (!willSave('questSteps', si)) return;
      const li = matchIndexByName(locationNames, (s as any).location || '');
      if (li >= 0 && willSave('locations', li) && (s.characters || []).some((n) => charMatches(i, n))) locIdSet.add(plannedIds.locations[li]);
    });
    patches.characters.push({ relationships, quests: questIds, events: eventIds, themes: themeIds, locations: Array.from(locIdSet) });
  });

  // —— 任务 ↔ 角色 / 地点 / 事件 ——
  (result.quests || []).forEach((q, i) => {
    const charIds = assoc.resolveCharacterIds(q.characters).filter((id) => {
      const ci = plannedIds.characters.indexOf(id);
      return ci >= 0 && willSave('characters', ci);
    });
    const locIds = assoc.resolveLocationIds(q.locations).filter((id) => {
      const li = plannedIds.locations.indexOf(id);
      return li >= 0 && willSave('locations', li);
    });
    const evIds = assoc.resolveEventIds(q.events).filter((id) => {
      const ei = plannedIds.events.indexOf(id);
      return ei >= 0 && willSave('events', ei);
    });
    patches.quests.push({ characters: charIds, locations: locIds, events: evIds });
  });

  // —— 步骤 ↔ 任务 / 角色 / 地点 ——
  (result.questSteps || []).forEach((s, i) => {
    const questId = assoc.resolveQuestIdForStep(s, i);
    patches.questSteps.push({
      questId: questId && willSave('quests', plannedIds.quests.indexOf(questId)) ? questId : '',
      characters: assoc.resolveCharacterIds(s.characters).filter((id) => {
        const ci = plannedIds.characters.indexOf(id);
        return ci >= 0 && willSave('characters', ci);
      }),
      locationId: (() => {
        const li = matchIndexByName(locationNames, (s as any).location || '');
        return li >= 0 && willSave('locations', li) ? plannedIds.locations[li] : '';
      })(),
    });
  });

  // —— 步骤连接 ↔ 步骤（解析「之后/然后/如果/否则/成功/失败」等流程引用）——
  (result.questConnections || []).forEach((cn, i) => {
    const fromId = assoc.resolveStepIdRef((cn as any).fromStepId);
    const toId = assoc.resolveStepIdRef((cn as any).toStepId);
    const fromOk = fromId && willSave('questSteps', plannedIds.questSteps.indexOf(fromId));
    const toOk = toId && willSave('questSteps', plannedIds.questSteps.indexOf(toId));
    let questId = assoc.resolveQuestIdForConnection(cn);
    if (questId && !willSave('quests', plannedIds.quests.indexOf(questId))) questId = '';
    patches.questConnections.push({ questId, fromStepId: fromOk ? fromId : '', toStepId: toOk ? toId : '' });
  });

  // —— 文本包装 ↔ 任务 / 角色 / 物品 ——
  (result.narrativeCopy || []).forEach((cp, i) => {
    let questId = assoc.resolveQuestIdByName((cp as any).questName);
    if (questId && !willSave('quests', plannedIds.quests.indexOf(questId))) questId = '';
    patches.narrativeCopy.push({
      questId,
      characters: assoc.resolveCharacterIds(cp.characters).filter((id) => {
        const ci = plannedIds.characters.indexOf(id);
        return ci >= 0 && willSave('characters', ci);
      }),
      relatedItemIds: assoc.resolveItemIds((cp as any).relatedItemNames).filter((id) => {
        const ii = plannedIds.items.indexOf(id);
        return ii >= 0 && willSave('items', ii);
      }),
    });
  });

  // —— 分镜 ↔ 任务 ——
  (result.storyboards || []).forEach((sb, i) => {
    let questId = assoc.resolveQuestIdForStoryboard(sb, i);
    if (questId && !willSave('quests', plannedIds.quests.indexOf(questId))) questId = '';
    patches.storyboards.push({ questId });
  });

  // —— 音美需求 ↔ 任务 / 步骤 / 镜头 ——
  (result.avRequirements || []).forEach((av, i) => {
    const links = assoc.resolveAvLinks(av);
    const questId = links.questId && willSave('quests', plannedIds.quests.indexOf(links.questId)) ? links.questId : '';
    const stepId = links.stepId && willSave('questSteps', plannedIds.questSteps.indexOf(links.stepId)) ? links.stepId : '';
    patches.avRequirements.push({ questId, stepId, shotId: links.shotId || '' });
  });

  // —— 演出剧本 ↔ 任务 / 步骤 ——
  (result.performanceScripts || []).forEach((ps, i) => {
    const links = assoc.resolveScriptLinks(ps);
    const questId = links.questId && willSave('quests', plannedIds.quests.indexOf(links.questId)) ? links.questId : '';
    const stepIds = (links.stepIds || []).filter((id) => {
      const si = plannedIds.questSteps.indexOf(id);
      return si >= 0 && willSave('questSteps', si);
    });
    patches.performanceScripts.push({ questId, stepIds });
  });

  // —— 叙事标注 ↔ 实体 ——
  (result.annotations || []).forEach((an, i) => {
    const entityId = assoc.resolveAnnotationEntity(an);
    patches.annotations.push({
      relatedEntityId: entityId && willSave('characters', plannedIds.characters.indexOf(entityId)) ? entityId : '',
    });
  });

  // —— 地点 ↔ 事件 ——
  (result.locations || []).forEach((loc, i) => {
    const evIds = (result.events || [])
      .map((e, ei) => ({ e, ei }))
      .filter(({ e, ei }) => willSave('events', ei) && matchIndexByName(locationNames, e.location || '') === i)
      .map(({ ei }) => plannedIds.events[ei]);
    patches.locations.push({ events: evIds });
  });

  // —— 事件 ↔ 角色 / 地点 ——
  (result.events || []).forEach((e, i) => {
    const li = matchIndexByName(locationNames, e.location || '');
    patches.events.push({
      characters: charReferencedBy(e.characters)
        .filter((ci) => willSave('characters', ci))
        .map((ci) => plannedIds.characters[ci]),
      locationId: li >= 0 && willSave('locations', li) ? plannedIds.locations[li] : '',
    });
  });

  return patches;
}

export function buildLabAssociationContext(result: EntityExtractionResult, now: number): LabAssociationContext {
  const rid = (prefix: string, i: number) => `${prefix}_${now}_${i}_${Math.random().toString(36).slice(2, 5)}`;

  const plannedIds = {
    characters: (result.characters || []).map((_, i) => rid('char', i)),
    quests: (result.quests || []).map((_, i) => rid('quest', i)),
    questSteps: (result.questSteps || []).map((_, i) => rid('step', i)),
    questConnections: (result.questConnections || []).map((_, i) => rid('conn', i)),
    narrativeCopy: (result.narrativeCopy || []).map((_, i) => rid('copy', i)),
    storyboards: (result.storyboards || []).map((_, i) => rid('sb', i)),
    avRequirements: (result.avRequirements || []).map((_, i) => rid('av', i)),
    performanceScripts: (result.performanceScripts || []).map((_, i) => rid('pscript', i)),
    lore: (result.lore || []).map((_, i) => rid('lore', i)),
    locations: (result.locations || []).map((_, i) => rid('loc', i)),
    factions: (result.factions || []).map((_, i) => rid('fac', i)),
    items: (result.items || []).map((_, i) => rid('item', i)),
    events: (result.events || []).map((_, i) => rid('time', i)),
    themes: (result.themes || []).map((_, i) => rid('theme', i)),
    annotations: (result.annotations || []).map((_, i) => rid('annot', i)),
  };

  const characterIdByName: Record<string, string> = {};
  (result.characters || []).forEach((c, i) => {
    characterIdByName[normName(c.name)] = plannedIds.characters[i];
    (c.aliases || []).forEach((a) => {
      const k = normName(a);
      if (k && !characterIdByName[k]) characterIdByName[k] = plannedIds.characters[i];
    });
  });

  const questIdByName: Record<string, string> = {};
  (result.quests || []).forEach((q, i) => {
    questIdByName[normName(q.name)] = plannedIds.quests[i];
  });

  const eventIdByName: Record<string, string> = {};
  (result.events || []).forEach((e, i) => {
    eventIdByName[normName(e.name)] = plannedIds.events[i];
  });

  const stepIdByTitle: Record<string, string> = {};
  const questIdByStepTitle: Record<string, string> = {};
  (result.questSteps || []).forEach((s, i) => {
    const stepQuestId = normName((s as any).questName) ? questIdByName[normName((s as any).questName)] || '' : '';
    const register = (key: string) => {
      if (!key) return;
      if (!stepIdByTitle[key]) stepIdByTitle[key] = plannedIds.questSteps[i];
      if (stepQuestId && !questIdByStepTitle[key]) questIdByStepTitle[key] = stepQuestId;
    };
    register(normName(s.title));
    register(normName(String(s.title || '').replace(/^步骤[^:：]*[:：]/, '')));
    ((s as any).aliases || []).forEach((a: string) => register(normName(a)));
  });

  const locationIdByName: Record<string, string> = {};
  (result.locations || []).forEach((l, i) => { locationIdByName[normName(l.name)] = plannedIds.locations[i]; });
  const factionIdByName: Record<string, string> = {};
  (result.factions || []).forEach((f, i) => { factionIdByName[normName(f.name)] = plannedIds.factions[i]; });
  const itemIdByName: Record<string, string> = {};
  (result.items || []).forEach((it, i) => {
    itemIdByName[normName(it.name)] = plannedIds.items[i];
    // 道具的别名包含包装文案标题时也可关联（叙事包装 ↔ 物品）
  });
  const copyIdByTitle: Record<string, string> = {};
  (result.narrativeCopy || []).forEach((c, i) => {
    copyIdByTitle[normName(c.title)] = plannedIds.narrativeCopy[i];
    // 物品 ↔ 文本包装：包装文案标题与物品名相同时建立映射
    if (c.type === 'item_lore') {
      ((c as any).relatedItemNames || []).forEach((n: string) => {
        const iid = itemIdByName[normName(n)];
        // 物品上的关联在 LabView 保存 items 时通过 copyIdByTitle 使用
      });
    }
  });
  const storyboardIdByTitle: Record<string, string> = {};
  (result.storyboards || []).forEach((sb, i) => { storyboardIdByTitle[normName(sb.title)] = plannedIds.storyboards[i]; });

  const resolveStepIdRef = (ref?: string): string => {
    const key = normName(ref);
    if (!key) return '';
    if (stepIdByTitle[key]) return stepIdByTitle[key];
    // 去掉「步骤N:」前缀再匹配
    const stripped = normName(String(ref || '').replace(/^步骤[^:：]*[:：]/, ''));
    if (stripped && stepIdByTitle[stripped]) return stepIdByTitle[stripped];
    // 纯数字 → 按顺序匹配第 N 步
    const numMatch = String(ref || '').match(/(\d+)\s*$/);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < plannedIds.questSteps.length) return plannedIds.questSteps[idx];
    }
    // 包含关系匹配（唯一命中才关联，避免猜测）
    const contains = (result.questSteps || []).filter((s) => {
      const t = normName(s.title);
      return t && (t.includes(key) || key.includes(t));
    });
    if (contains.length === 1) {
      const idx = (result.questSteps || []).indexOf(contains[0]);
      return plannedIds.questSteps[idx];
    }
    return '';
  };

  const resolveQuestIdByName = (name?: string): string => {
    const key = normName(name);
    if (!key) return '';
    if (questIdByName[key]) return questIdByName[key];
    const contains = (result.quests || []).filter((q) => {
      const t = normName(q.name);
      return t && (t.includes(key) || key.includes(t));
    });
    return contains.length === 1 ? plannedIds.quests[(result.quests || []).indexOf(contains[0])] : '';
  };

  const buildCharacterRelations = (name?: string): CharacterRelation[] => {
    const key = normName(name);
    if (!key) return [];
    return (result.relationships || [])
      .filter((r) => normName(r.source) === key)
      .map((r) => ({
        targetId: characterIdByName[normName(r.target)] || '',
        targetName: r.target,
        type: RELATION_TYPES.includes(r.type) ? r.type : 'related_to',
        description: r.note,
        weight: 3,
      }));
  };

  const resolveCharacterIds = (names?: string[]): string[] => {
    const out: string[] = [];
    (names || []).forEach((n) => {
      const id = characterIdByName[normName(n)];
      if (id && !out.includes(id)) out.push(id);
    });
    return out;
  };

  const resolveItemIds = (names?: string[]): string[] => {
    const out: string[] = [];
    (names || []).forEach((n) => {
      const id = itemIdByName[normName(n)];
      if (id && !out.includes(id)) out.push(id);
    });
    return out;
  };

  const resolveQuestIdForStep = (raw: any, index: number): string => {
    const byName = resolveQuestIdByName((raw as any)?.questName);
    if (byName) return byName;
    return questIdByStepTitle[normName((result.questSteps || [])[index]?.title)] || '';
  };

  const resolveQuestIdForConnection = (raw: any): string => {
    const byName = resolveQuestIdByName((raw as any)?.questName);
    if (byName) return byName;
    // 由 fromStep 反查所属任务
    const fromId = resolveStepIdRef((raw as any)?.fromStepId);
    const entry = Object.entries(stepIdByTitle).find(([, v]) => v === fromId);
    if (entry) return questIdByStepTitle[entry[0]] || '';
    return '';
  };

  const resolveEventIds = (names?: string[]): string[] => {
    const out: string[] = [];
    (names || []).forEach((n) => {
      const id = eventIdByName[normName(n)];
      if (id && !out.includes(id)) out.push(id);
    });
    return out;
  };

  const resolveLocationIds = (names?: string[]): string[] => {
    const out: string[] = [];
    (names || []).forEach((n) => {
      const key = normName(n);
      if (!key) return;
      const id = locationIdByName[key];
      if (id) {
        if (!out.includes(id)) out.push(id);
        return;
      }
      // 包含关系匹配（唯一命中才关联，避免猜测）
      const hits = (result.locations || []).filter((l) => {
        const t = normName(l.name);
        return t && (t.includes(key) || key.includes(t));
      });
      if (hits.length === 1) {
        const idx = (result.locations || []).indexOf(hits[0]);
        if (!out.includes(plannedIds.locations[idx])) out.push(plannedIds.locations[idx]);
      }
    });
    return out;
  };

  const resolveQuestIdForStoryboard = (raw: any, index: number): string => {
    const byName = resolveQuestIdByName((raw as any)?.questName);
    if (byName) return byName;
    // 分镜标题包含任务名时建立关联（唯一命中才关联）
    const sbTitle = normName((result.storyboards || [])[index]?.title);
    if (!sbTitle) return '';
    const hits = (result.quests || []).filter((q) => {
      const t = normName(q.name);
      return t && (sbTitle.includes(t) || t.includes(sbTitle));
    });
    return hits.length === 1 ? plannedIds.quests[(result.quests || []).indexOf(hits[0])] : '';
  };

  const resolveAvLinks = (raw: any): { questId: string; stepId: string; shotId: string } => {
    const level: AVReqLevel = raw?.level || 'global';
    let questId = resolveQuestIdByName(raw?.questName);
    let stepId = '';
    let shotId = str(raw?.shotId, 60);
    if (level === 'step') {
      stepId = resolveStepIdRef(raw?.stepTitle || raw?.targetName);
      if (!questId && stepId) questId = questIdByStepTitle[Object.keys(stepIdByTitle).find((k) => stepIdByTitle[k] === stepId) || ''] || '';
    }
    if (level === 'shot') {
      if (!questId && (raw as any)?.questName) questId = '';
      // shotId 保留镜头编号字符串，由分镜表按 shotNumber 匹配
    }
    return { questId, stepId, shotId };
  };

  const resolveAnnotationEntity = (raw: any): string => {
    const hay = normName(`${raw?.text || ''} ${raw?.note || ''}`);
    for (const c of result.characters || []) {
      const names = [c.name, ...(c.aliases || [])].map(normName).filter(Boolean);
      if (names.some((n) => n.length >= 2 && hay.includes(n))) {
        const idx = (result.characters || []).indexOf(c);
        return plannedIds.characters[idx];
      }
    }
    return '';
  };

  const resolveScriptLinks = (raw: any): { questId: string; stepIds: string[] } => {
    const questId = resolveQuestIdByName(raw?.questName);
    const stepIds: string[] = [];
    const titles: any[] = Array.isArray(raw?.stepTitles) ? raw.stepTitles : [];
    titles.forEach((t: any) => {
      const id = resolveStepIdRef(t);
      if (id && !stepIds.includes(id)) stepIds.push(id);
    });
    return { questId, stepIds };
  };

  return {
    plannedIds,
    characterIdByName,
    questIdByName,
    eventIdByName,
    stepIdByTitle,
    questIdByStepTitle,
    locationIdByName,
    factionIdByName,
    itemIdByName,
    copyIdByTitle,
    storyboardIdByTitle,
    buildCharacterRelations,
    resolveStepIdRef,
    resolveQuestIdByName,
    resolveQuestIdForStep,
    resolveQuestIdForConnection,
    resolveQuestIdForStoryboard,
    resolveScriptLinks,
    resolveCharacterIds,
    resolveItemIds,
    resolveEventIds,
    resolveLocationIds,
    resolveAvLinks,
    resolveAnnotationEntity,
  };
}
