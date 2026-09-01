import { EntityExtractionResult, RelationType, AISettings, Character, Quest, WorldLocation } from '../types';

export const DEFAULT_AI_API_KEY = 'sk-ws-H.EXXYXXY.3Z51.MEQCH1xDvvJXRGVl85NgFMDCdqdaZeMNhzUgrK6Mh7qw_wUCIQDbDAM4s4a_oUEARRyEQlDhBShGNgYq4EvGaAVSLwkY9A';
export const DEFAULT_QWEN_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
export const DEFAULT_QWEN_MODEL = 'qwen-plus';

export const AI_CONFIG_STORAGE_KEY = 'narrative_os_ai_settings';

export function getStoredAISettings(): AISettings {
  const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider || 'qwen',
        qwenApiKey: parsed.qwenApiKey?.trim() || DEFAULT_AI_API_KEY,
        qwenModel: parsed.qwenModel || DEFAULT_QWEN_MODEL,
        qwenEndpoint: parsed.qwenEndpoint || DEFAULT_QWEN_ENDPOINT,
        localModel: parsed.localModel || 'Xenova/Qwen1.5-0.5B-Chat',
        localDevice: parsed.localDevice || 'webgpu',
      };
    } catch (e) {}
  }
  return {
    provider: 'qwen',
    qwenApiKey: DEFAULT_AI_API_KEY,
    qwenModel: DEFAULT_QWEN_MODEL,
    qwenEndpoint: DEFAULT_QWEN_ENDPOINT,
    localModel: 'Xenova/Qwen1.5-0.5B-Chat',
    localDevice: 'webgpu',
  };
}

export function saveAISettings(settings: AISettings) {
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(settings));
}

export async function testQwenConnection(
  apiKey: string,
  endpoint: string,
  model: string
): Promise<{ success: boolean; message: string; latency?: number }> {
  const startTime = Date.now();
  const url = endpoint.trim() || DEFAULT_QWEN_ENDPOINT;
  const key = apiKey.trim() || DEFAULT_AI_API_KEY;

  if (!key) {
    return { success: false, message: '请先填写 API Key。' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model || DEFAULT_QWEN_MODEL,
        messages: [
          { role: 'system', content: 'You are a narrative analysis engine. Return JSON {"status": "ok"}.' },
          { role: 'user', content: 'Ping connection test' },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    const latency = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      let msg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errJson = JSON.parse(errText);
        msg = errJson.error?.message || errJson.message || msg;
      } catch (e) {}
      return { success: false, message: `连通测试失败: ${msg}` };
    }

    const data = await res.json();
    if (data.choices && data.choices.length > 0) {
      return {
        success: true,
        message: `API 连接成功！响应延迟: ${latency}ms (模型: ${model || DEFAULT_QWEN_MODEL})`,
        latency,
      };
    }
    return { success: true, message: `接口返回正常响应 (${latency}ms)` };
  } catch (error: any) {
    return { success: false, message: `网络连接异常: ${error.message || String(error)}` };
  }
}

export async function extractNarrativeEntities(
  text: string,
  settings: AISettings,
  onProgress?: (msg: string) => void
): Promise<EntityExtractionResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('待解析文本为空。');
  }

  const apiKey = settings.qwenApiKey?.trim() || DEFAULT_AI_API_KEY;

  if (settings.provider === 'qwen' && apiKey) {
    onProgress?.('正在通过通义千问 API 深度解析文本结构与叙事实体...');
    try {
      return await extractWithQwenAPI(text, { ...settings, qwenApiKey: apiKey });
    } catch (err: any) {
      console.warn('Qwen API failed, falling back to local extractor:', err);
      onProgress?.('API 请求受限，正在回退至本地智能 NLP 解析引擎...');
      return extractWithLocalEngine(text);
    }
  } else {
    onProgress?.('正在使用本地端侧 NLP 引擎解析实体与叙事节拍...');
    return extractWithLocalEngine(text);
  }
}

/** 宽松解析 AI 返回的 JSON（兼容 ```json 代码围栏与前后杂讯） */
export function parseJSONLoose(raw: string): any {
  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  // 截取首个 { 到最后一个 } 之间的内容，容忍模型输出的前后说明文字
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace > 0 || (lastBrace >= 0 && lastBrace < cleaned.length - 1)) {
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(cleaned);
}

/**
 * 通用「Qwen 兼容接口 JSON 调用」辅助：供五阶段叙事解析器等模块复用。
 * 返回解析后的 JSON 对象；失败时抛出异常（由调用方决定降级策略）。
 */
export async function callQwenJSON(
  userPrompt: string,
  settings: AISettings,
  options?: { system?: string; temperature?: number; timeoutMs?: number }
): Promise<any> {
  const url = settings.qwenEndpoint?.trim() || DEFAULT_QWEN_ENDPOINT;
  const key = settings.qwenApiKey?.trim() || DEFAULT_AI_API_KEY;
  const model = settings.qwenModel || DEFAULT_QWEN_MODEL;

  if (settings.provider !== 'qwen' || !key) {
    throw new Error('当前未配置 Qwen API，无法执行 AI 解析。');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs || 120000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: options?.system || 'You are a professional narrative extraction AI. You must return valid JSON only.',
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: options?.temperature ?? 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`AI 接口报错 (${res.status}): ${errorText.slice(0, 300)}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    if (!rawContent) throw new Error('AI 返回内容为空。');
    return parseJSONLoose(rawContent);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('AI 请求超时，已中止本次调用。');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function extractWithQwenAPI(text: string, settings: AISettings): Promise<EntityExtractionResult> {
  const url = settings.qwenEndpoint?.trim() || DEFAULT_QWEN_ENDPOINT;
  const key = settings.qwenApiKey?.trim() || DEFAULT_AI_API_KEY;
  const model = settings.qwenModel || DEFAULT_QWEN_MODEL;

  const prompt = `
你是一位顶级游戏文案策划、叙事总监与音美导演。请对以下导入的文本进行全流程深度结构化剖析与解析提取。

【核心原则与严格限制】：
1. 只能从用户输入的原文中提取真实存在的信息，严禁编造或推测原文不存在的情节或实体。
2. 无法确定的信息字段留空或空数组，切勿胡乱揣测。
3. 一次解析需同时识别所有符合条件的叙事知识与文案生产内容：
   - 角色设定 (characters)
   - 任务线 (quests)
   - 任务步骤/剧情方块节点 (questSteps)
   - 剧情分支/流向连线 (questConnections)
   - 文本包装 (narrativeCopy: 包含道具包装 item_lore, 语音/点击对话文本 voice_interactive, PV文案 pv_trailer, 书信 letter, 公告 announcement, 邮件 mail, 游戏文档 document, 教学引导 tutorial, UI文案 ui_copy, Loading文本 loading_tip, 氛围文案 atmosphere, 其他 other)
   - 分镜脚本 (storyboards: 识别镜头、机位、景别、画面、动作、对白、旁白、表演、时长等，根据原文实际结构动态生成 columns 列名与 rows 镜头行，不要强制固定列名)
   - 音美需求 (avRequirements: 识别音乐 Music, 音效 SFX, 配音 Voice, 美术 Art, 特效 VFX, 动画 Animation, 范围 Scope[global/shot/step], 镜头 Shot ID, 步骤 Quest Step, 备注)
   - 世界观设定条目 (lore)
   - 地点场景 (locations)
   - 阵营势力 (factions)
   - 关键物品道具 (items)
   - 时序事件 (events)
   - 核心主题 (themes)
   - 叙事标注 (annotations)
4. 关系类型必须使用以下枚举之一：
   ["knows", "likes", "dislikes", "trusts", "conflicts_with", "belongs_to", "appears_in", "located_in", "reveals", "foreshadows", "causes", "depends_on", "related_to"]

【输出 JSON 模式定义】：
{
  "summary": "故事梗概与核心要旨（基于原文，80-150字）",
  "keywords": ["关键词1", "关键词2"],
  "characters": [
    {
      "name": "角色名",
      "aliases": ["别名"],
      "identity": "身份/职业/阵营",
      "personality": "性格特点",
      "goals": "核心欲望或目标",
      "bio": "基于原文的生平简述"
    }
  ],
  "quests": [
    {
      "name": "任务/剧情目标名称",
      "description": "任务始末与核心矛盾",
      "objectives": ["目标1", "目标2"],
      "characters": ["涉及角色"],
      "status": "active"
    }
  ],
  "questSteps": [
    {
      "title": "步骤标题",
      "summary": "步骤剧情与行动描述",
      "stepType": "normal | start | action | dialogue | branch | choice | puzzle | battle | climax | ending",
      "location": "发生地点",
      "characters": ["登场角色"],
      "notes": "步骤备注"
    }
  ],
  "questConnections": [
    {
      "fromStepId": "起点步骤标题或序号",
      "toStepId": "目标步骤标题或序号",
      "type": "Next | Branch | Choice | Success | Failure | Ending | Merge | Loop",
      "label": "流向说明或条件标签",
      "condition": "触发条件"
    }
  ],
  "narrativeCopy": [
    {
      "type": "item_lore | voice_interactive | pv_trailer | letter | announcement | mail | document | loading_tip | tutorial | ui_copy | atmosphere | other",
      "title": "文案标题",
      "content": "文案正文内容",
      "flavorText": "说明或氛围补充",
      "characters": ["关联角色"],
      "questId": "关联任务名",
      "tags": ["标签1"]
    }
  ],
  "storyboards": [
    {
      "title": "分镜剧本标题",
      "description": "分镜情境描述",
      "columns": [
        { "id": "shotNumber", "label": "镜头编号", "type": "number" },
        { "id": "camera", "label": "景别与机位", "type": "text" },
        { "id": "visual", "label": "画面与动作", "type": "text" },
        { "id": "dialogue", "label": "台词与对白", "type": "text" },
        { "id": "duration", "label": "时长与运动", "type": "text" }
      ],
      "rows": [
        {
          "shotNumber": "1",
          "cells": {
            "shotNumber": "1",
            "camera": "全景 / 俯拍",
            "visual": "主角站在暴雨中的城墙",
            "dialogue": "旁白：终局将至...",
            "duration": "3s"
          }
        }
      ]
    }
  ],
  "avRequirements": [
    {
      "type": "Music | SFX | Voice | Art | VFX | Animation | Other",
      "title": "音美制作需求标题",
      "description": "需求详细描述",
      "level": "global | shot | step",
      "shotId": "关联镜头编号（如有）",
      "targetName": "关联任务步骤或情境（如有）",
      "notes": "制作参考或备注"
    }
  ],
  "locations": [
    { "name": "地点名", "type": "场景类型", "description": "场景特征与描述" }
  ],
  "factions": [
    { "name": "势力/阵营名", "description": "势力主张与背景", "leader": "领袖名" }
  ],
  "items": [
    { "name": "物品/道具名", "type": "道具类型", "description": "功能与特征", "owner": "持有者" }
  ],
  "events": [
    { "name": "时序事件名", "time": "发生时点", "location": "地点", "characters": ["角色名"], "description": "事件经过" }
  ],
  "themes": [
    { "name": "主题概念", "coreConcept": "核心意涵", "motif": "意象符号" }
  ],
  "lore": [
    { "title": "设定条目标题", "category": "设定分类", "content": "规则或世界观背景" }
  ],
  "annotations": [
    { "text": "原文标注文本片段", "type": "Dialogue | Action | Conflict | Reveal | Foreshadowing | Choice | Consequence | Lore | Theme", "note": "分析注释" }
  ],
  "dialogues": [
    { "speaker": "说话者", "text": "台词原文", "context": "情境" }
  ],
  "relationships": [
    { "source": "角色A", "target": "角色B", "type": "conflicts_with", "note": "关系说明" }
  ]
}

【待分析文本内容】：
${text.slice(0, 14000)}
`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: 'You are a professional narrative extraction AI. You must return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`通义千问 API 报错 (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content || '{}';
  return sanitizeAndValidateExtraction(rawContent, text);
}

export function extractWithLocalEngine(text: string): EntityExtractionResult {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const dialogues: Array<{ speaker: string; text: string; context?: string }> = [];
  const foundNames = new Set<string>();

  const dialogueRegex1 = /^([^\s:：]{1,10})[：:](.+)$/;
  const dialogueRegex2 = /^([^\s“「]{1,10})[说道问答喊道悄声道吼道]?[：:]?[“「]([^”」]+)[”」]$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match = line.match(dialogueRegex2);
    if (match) {
      const speaker = match[1].trim();
      const speech = match[2].trim();
      foundNames.add(speaker);
      dialogues.push({ speaker, text: speech, context: lines[Math.max(0, i - 1)] !== line ? lines[Math.max(0, i - 1)] : undefined });
      continue;
    }

    match = line.match(dialogueRegex1);
    if (match) {
      const speaker = match[1].trim();
      const speech = match[2].trim();
      if (!speaker.startsWith('#') && speaker.length <= 12 && !speaker.includes('http') && !speaker.includes('【') && !speaker.includes('镜头') && !speaker.includes('Step')) {
        foundNames.add(speaker);
        dialogues.push({ speaker, text: speech });
      }
    }
  }

  const locKeywords = ['城', '港', '殿', '堡', '镇', '村', '塔', '森林', '谷', '岛', '星区', '实验室', '遗迹', '神庙', '基地', '市', '街道', '营地'];
  const factionKeywords = ['团', '军', '宗', '盟', '教会', '派', '协会', '帝国', '联邦', '议会', '帮', '集团', '王朝', '工会'];
  const itemKeywords = ['剑', '石', '晶', '枪', '卷轴', '徽章', '钥匙', '芯片', '圣物', '之书', '药剂', '机甲', '神器', '信件', '日记', '手记', '护符'];

  const extractedLocations = new Set<string>();
  const extractedFactions = new Set<string>();
  const extractedItems = new Set<string>();
  const extractedCopy: any[] = [];
  const extractedStoryboards: any[] = [];
  const extractedAVReqs: any[] = [];
  const extractedQuestSteps: any[] = [];
  const extractedQuestConnections: any[] = [];
  const extractedLore: any[] = [];
  const extractedAnnotations: any[] = [];

  // Parse structured blocks like 【xxx】 or headers
  let currentBlockType = '';
  let currentBlockTitle = '';
  let currentBlockContent: string[] = [];

  const flushBlock = () => {
    if (!currentBlockTitle && currentBlockContent.length === 0) return;
    const blockText = currentBlockContent.join('\n').trim();
    const title = currentBlockTitle || '未命名条目';

    if (currentBlockType.includes('道具') || currentBlockType.includes('物品')) {
      extractedCopy.push({
        type: 'item_lore',
        title: title,
        content: blockText || title,
        flavorText: '从原文结构中提取的道具包装文案',
        tags: ['道具包装'],
      });
      extractedItems.add(title);
    } else if (currentBlockType.includes('书信') || currentBlockType.includes('信件') || currentBlockType.includes('信')) {
      extractedCopy.push({
        type: 'letter',
        title: title,
        content: blockText || title,
        flavorText: '游戏内书信文本',
        tags: ['书信'],
      });
    } else if (currentBlockType.includes('公告')) {
      extractedCopy.push({
        type: 'announcement',
        title: title,
        content: blockText || title,
        tags: ['公告'],
      });
    } else if (currentBlockType.includes('邮件')) {
      extractedCopy.push({
        type: 'mail',
        title: title,
        content: blockText || title,
        tags: ['邮件'],
      });
    } else if (currentBlockType.includes('文档') || currentBlockType.includes('日志') || currentBlockType.includes('手记')) {
      extractedCopy.push({
        type: 'document',
        title: title,
        content: blockText || title,
        tags: ['文档'],
      });
    } else if (currentBlockType.includes('教学') || currentBlockType.includes('引导') || currentBlockType.includes('教程')) {
      extractedCopy.push({
        type: 'tutorial',
        title: title,
        content: blockText || title,
        tags: ['教学'],
      });
    } else if (currentBlockType.includes('语音') || currentBlockType.includes('点击对话') || currentBlockType.includes('互动语音') || currentBlockType.includes('看板') || currentBlockType.includes('台词')) {
      extractedCopy.push({
        type: 'voice_interactive',
        title: title,
        content: blockText || title,
        flavorText: '角色互动/点击/场景语音台词',
        tags: ['语音', '点击对话'],
      });
    } else if (currentBlockType.includes('PV') || currentBlockType.includes('pv') || currentBlockType.includes('预告') || currentBlockType.includes('宣发') || currentBlockType.includes('先导')) {
      extractedCopy.push({
        type: 'pv_trailer',
        title: title,
        content: blockText || title,
        flavorText: '宣发预告/版本PV文案',
        tags: ['PV文案', '宣发'],
      });
    } else if (currentBlockType.includes('UI') || currentBlockType.includes('界面') || currentBlockType.includes('提示')) {
      extractedCopy.push({
        type: 'ui_copy',
        title: title,
        content: blockText || title,
        tags: ['UI文案'],
      });
    } else if (currentBlockType.includes('加载') || currentBlockType.includes('loading')) {
      extractedCopy.push({
        type: 'loading_tip',
        title: title,
        content: blockText || title,
        tags: ['Loading'],
      });
    } else if (currentBlockType.includes('设定') || currentBlockType.includes('世界观')) {
      extractedLore.push({
        title: title,
        category: '世界观',
        content: blockText || title,
        tags: ['世界观'],
      });
    }

    currentBlockType = '';
    currentBlockTitle = '';
    currentBlockContent = [];
  };

  // Scan line by line for Narrative Copy, Storyboard, AV Req, Steps
  const shotRegex = /^(?:【?(?:镜头|Shot)\s*(\d+|[A-Za-z0-9_-]+)】?|[#]{1,3}\s*镜头\s*(\d+)|镜头\s*(\d+)[:：])(.*)$/i;
  const avReqRegex = /(?:【?(?:音效|配乐|BGM|SFX|Voice|配音|美术|特效|VFX|动画|需求)[：:】]|\[(?:BGM|SFX|Voice|VFX)\])(.*)/i;
  const stepRegex = /^(?:【?(?:步骤|Step|节点)\s*(\d+|[A-Za-z0-9_-]+)】?|[#]{1,3}\s*步骤\s*(\d+)|步骤\s*(\d+)[:：])(.*)$/i;

  const currentStoryboardRows: any[] = [];
  const detectedColumnsMap: Record<string, { label: string; type: 'text' | 'number' }> = {
    shotNumber: { label: '镜头编号', type: 'number' },
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect bracket section header
    const bracketHeader = line.match(/^【([^】]+)】(.*)$/);
    if (bracketHeader) {
      flushBlock();
      const tag = bracketHeader[1].trim();
      const rest = bracketHeader[2].trim();
      currentBlockType = tag;
      currentBlockTitle = rest || tag;
      if (rest) currentBlockContent.push(rest);
      continue;
    }

    // Detect Storyboard Shot
    const shotMatch = line.match(shotRegex);
    if (shotMatch) {
      const shotNum = shotMatch[1] || shotMatch[2] || shotMatch[3] || String(currentStoryboardRows.length + 1);
      const rest = (shotMatch[4] || '').trim();
      
      const cells: Record<string, string> = { shotNumber: shotNum };

      // Parse sub-fields if present in line or following lines
      if (rest) {
        if (rest.includes('景别') || rest.includes('机位') || rest.includes('全景') || rest.includes('特写') || rest.includes('中景')) {
          detectedColumnsMap['camera'] = { label: '景别/机位', type: 'text' };
          cells['camera'] = rest;
        } else if (rest.includes('对白') || rest.includes('台词') || rest.includes('旁白')) {
          detectedColumnsMap['dialogue'] = { label: '台词/对白', type: 'text' };
          cells['dialogue'] = rest;
        } else {
          detectedColumnsMap['visual'] = { label: '画面/动作', type: 'text' };
          cells['visual'] = rest;
        }
      }

      currentStoryboardRows.push({
        id: `shot_${shotNum}_${i}`,
        shotNumber: shotNum,
        cells,
      });
      continue;
    }

    // Detect AV Requirement
    const avMatch = line.match(avReqRegex);
    if (avMatch) {
      const content = avMatch[1].trim() || line;
      let avType: 'Music' | 'SFX' | 'Voice' | 'Art' | 'VFX' | 'Animation' | 'Other' = 'SFX';
      if (line.includes('BGM') || line.includes('配乐') || line.includes('音乐')) avType = 'Music';
      else if (line.includes('配音') || line.includes('Voice') || line.includes('CV')) avType = 'Voice';
      else if (line.includes('美术') || line.includes('立绘') || line.includes('原画')) avType = 'Art';
      else if (line.includes('特效') || line.includes('VFX')) avType = 'VFX';
      else if (line.includes('动画') || line.includes('演出')) avType = 'Animation';

      let scope: 'global' | 'shot' | 'step' = 'global';
      if (line.includes('镜头') || line.includes('Shot')) scope = 'shot';
      else if (line.includes('步骤') || line.includes('Step')) scope = 'step';

      extractedAVReqs.push({
        type: avType,
        title: content.slice(0, 30) || `${avType}制作需求`,
        description: line,
        level: scope,
        notes: '从剧本/文案中自动提取',
      });
      continue;
    }

    // Detect Quest Step
    const stepMatch = line.match(stepRegex);
    if (stepMatch) {
      const stepNum = stepMatch[1] || stepMatch[2] || stepMatch[3] || String(extractedQuestSteps.length + 1);
      const stepDesc = (stepMatch[4] || '').trim();
      extractedQuestSteps.push({
        title: `步骤 ${stepNum}: ${stepDesc.slice(0, 20) || '阶段推进'}`,
        summary: stepDesc || line,
        stepType: stepDesc.includes('战') ? 'battle' : stepDesc.includes('抉择') ? 'choice' : 'normal',
        orderIndex: extractedQuestSteps.length,
      });
      continue;
    }

    if (currentBlockType) {
      currentBlockContent.push(line);
    }
  }
  flushBlock();

  // If storyboard rows were found, build storyboard structure
  if (currentStoryboardRows.length > 0) {
    if (!detectedColumnsMap['visual']) detectedColumnsMap['visual'] = { label: '画面与动作', type: 'text' };
    if (!detectedColumnsMap['dialogue']) detectedColumnsMap['dialogue'] = { label: '台词与旁白', type: 'text' };
    if (!detectedColumnsMap['duration']) detectedColumnsMap['duration'] = { label: '时长与备注', type: 'text' };

    const dynamicCols = Object.entries(detectedColumnsMap).map(([id, col]) => ({
      id,
      label: col.label,
      type: col.type,
      width: id === 'shotNumber' ? 90 : 180,
    }));

    extractedStoryboards.push({
      title: '文本提取分镜脚本',
      description: `共识别到 ${currentStoryboardRows.length} 个镜头行`,
      columns: dynamicCols,
      rows: currentStoryboardRows,
    });
  }

  // If steps were found, build sequential connections
  if (extractedQuestSteps.length >= 2) {
    for (let i = 0; i < extractedQuestSteps.length - 1; i++) {
      extractedQuestConnections.push({
        fromStepId: extractedQuestSteps[i].title,
        toStepId: extractedQuestSteps[i + 1].title,
        type: 'Next',
        label: '顺承推进',
      });
    }
  }

  // Scan words for locations, factions, items
  const words = text.split(/[\s,，.。!！?？"“”'‘’\n]+/);
  for (const w of words) {
    if (w.length >= 2 && w.length <= 8) {
      if (locKeywords.some(k => w.endsWith(k)) && !foundNames.has(w)) {
        extractedLocations.add(w);
      } else if (factionKeywords.some(k => w.endsWith(k)) && !foundNames.has(w)) {
        extractedFactions.add(w);
      } else if (itemKeywords.some(k => w.endsWith(k)) && !foundNames.has(w)) {
        extractedItems.add(w);
      }
    }
  }

  // Generate annotations from dialogues and highlights
  dialogues.slice(0, 10).forEach(d => {
    extractedAnnotations.push({
      text: `${d.speaker}: ${d.text}`,
      type: 'Dialogue',
      note: d.context || '人物对白台词',
    });
  });

  const charactersList = Array.from(foundNames).slice(0, 10).map(name => ({
    name,
    aliases: [],
    identity: '登场角色',
    personality: '',
    goals: '',
    bio: `在文本中登场`,
  }));

  const locationsList = Array.from(extractedLocations).slice(0, 6).map(name => ({
    name,
    type: '场景地标',
    description: `剧本核心场景【${name}】。`,
  }));

  const factionsList = Array.from(extractedFactions).slice(0, 4).map(name => ({
    name,
    description: `活跃于文本中的组织势力【${name}】。`,
    leader: '',
  }));

  const itemsList = Array.from(extractedItems).slice(0, 6).map(name => ({
    name,
    type: '关键道具',
    description: `情节涉及的关键道具【${name}】。`,
  }));

  const relationships: Array<{ source: string; target: string; type: RelationType; note?: string }> = [];
  const charArray = Array.from(foundNames);
  if (charArray.length >= 2) {
    for (let i = 0; i < charArray.length - 1; i++) {
      relationships.push({
        source: charArray[i],
        target: charArray[i + 1],
        type: 'knows',
        note: '在相同场景中登场对话',
      });
    }
  }

  const summary = text.slice(0, 180).replace(/\n+/g, ' ') + (text.length > 180 ? '...' : '');

  return {
    summary,
    keywords: Array.from(new Set([...foundNames, ...extractedLocations, ...extractedItems])).slice(0, 8),
    characters: charactersList,
    locations: locationsList,
    factions: factionsList,
    items: itemsList,
    events: [
      {
        name: '文本核心剧情节点',
        time: '剧情当下',
        location: locationsList[0]?.name || '',
        characters: charArray.slice(0, 4),
        description: summary,
      },
    ],
    quests: [
      {
        name: '推进核心主支线',
        description: summary,
        objectives: ['查明事件始末', '完成阶段推进'],
        characters: charArray.slice(0, 3),
        status: 'active' as const,
      },
    ],
    questSteps: extractedQuestSteps,
    questConnections: extractedQuestConnections,
    narrativeCopy: extractedCopy,
    storyboards: extractedStoryboards,
    avRequirements: extractedAVReqs,
    themes: [
      {
        name: '抉择与宿命',
        coreConcept: '角色在局势中的抉择与代价',
        motif: '对白交锋',
      },
    ],
    lore: extractedLore,
    annotations: extractedAnnotations,
    dialogues: dialogues.slice(0, 15),
    choices: [],
    relationships,
  };
}

function sanitizeAndValidateExtraction(rawJson: string, originalText: string): EntityExtractionResult {
  try {
    let cleaned = rawJson.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    return {
      summary: parsed.summary || originalText.slice(0, 150),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      factions: Array.isArray(parsed.factions) ? parsed.factions : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      quests: Array.isArray(parsed.quests) ? parsed.quests : [],
      questSteps: Array.isArray(parsed.questSteps) ? parsed.questSteps : [],
      questConnections: Array.isArray(parsed.questConnections) ? parsed.questConnections : [],
      narrativeCopy: Array.isArray(parsed.narrativeCopy) ? parsed.narrativeCopy : [],
      storyboards: Array.isArray(parsed.storyboards) ? parsed.storyboards : [],
      avRequirements: Array.isArray(parsed.avRequirements) ? parsed.avRequirements : [],
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      lore: Array.isArray(parsed.lore) ? parsed.lore : [],
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
      dialogues: Array.isArray(parsed.dialogues) ? parsed.dialogues : [],
      choices: Array.isArray(parsed.choices) ? parsed.choices : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    };
  } catch (err) {
    console.warn('Failed to parse AI JSON, falling back to rule extraction:', err);
    return extractWithLocalEngine(originalText);
  }
}

// Interactive AI Narrative Copilot
export async function chatWithNarrativeAI(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  settings: AISettings,
  contextData?: {
    projectName?: string;
    characters?: Character[];
    quests?: Quest[];
    locations?: WorldLocation[];
  }
): Promise<string> {
  const url = settings.qwenEndpoint?.trim() || DEFAULT_QWEN_ENDPOINT;
  const key = settings.qwenApiKey?.trim() || DEFAULT_AI_API_KEY;
  const model = settings.qwenModel || DEFAULT_QWEN_MODEL;

  const systemContext = `
你是一位专业的叙事总监、游戏剧本大师与世界观架构师 (Narrative OS AI Copilot)。
当前项目信息：
- 项目名称: ${contextData?.projectName || '未命名项目'}
- 已建立角色: ${contextData?.characters?.map(c => c.name).join(', ') || '暂无'}
- 当前剧情线: ${contextData?.quests?.map(q => q.name).join(', ') || '暂无'}
- 世界场景: ${contextData?.locations?.map(l => l.name).join(', ') || '暂无'}

你的职责：
1. 协助作者拓展情节分支、撰写高张力对白剧本、丰满人物小传与世界观设定。
2. 保持逻辑严密与人物动机一致性，提供富有创意且符合世界观风格的建议。
3. 语言精炼，排版美观，使用 Markdown 格式输出。
`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemContext },
          ...messages,
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI 请求失败 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '抱歉，未能获取生成结果。';
  } catch (err: any) {
    throw new Error(`AI 服务异常: ${err.message}`);
  }
}
