// 顶层解析器：实现五阶段流水线，暴露 parseDocument(text, options)
import { chunkAndDescribe } from './chunker';
import { stage2EntityPrompt, stage3ProductionPrompt } from './prompts';
import { callLLM } from './llmClient';
import { mergeEntitiesAndSteps } from './merger';
import { ParseResult, Segment, BaseEntity, QuestStep } from './types';
import crypto from 'crypto';

function makeId(prefix = '') {
  return prefix + crypto.randomBytes(6).toString('hex');
}

type ParseOptions = {
  mode?: 'auto' | 'task' | 'world' | 'character' | 'packaging' | 'storyboard' | 'av';
  // 未来可加入并行/并发控制、model config 等
};

export async function parseDocument(text: string, opts?: ParseOptions): Promise<ParseResult> {
  const mode = opts?.mode || 'auto';
  const segments = await chunkAndDescribe(text);

  // Stage2: per-segment entity extraction
  const rawEntitiesBySegment: BaseEntity[][] = [];
  const rawStepsBySegment: QuestStep[][] = [];

  for (const seg of segments) {
    const p2 = stage2EntityPrompt(seg.text, mode);
    try {
      const resp = await callLLM(p2, { temperature: 0, maxTokens: 600 });
      let arr: any[] = [];
      try {
        arr = JSON.parse(resp);
      } catch {
        // 容错：尝试从非严格 JSON 中抽取（简单回退）
        // 若解析失败，标记为空数组并添加 warning
        arr = [];
      }
      // 将 LLM 返回的每个实体转换为 BaseEntity，保留 sourceSegment
      const parsedEntities: BaseEntity[] = arr.map((e: any, idx: number) => ({
        id: makeId('ent_'),
        type: e.type || 'Unknown',
        name: e.name || '',
        aliases: e.aliases || [],
        description: e.description || '',
        sourceSegmentIds: [seg.id],
        confidence: typeof e.confidence === 'number' ? Math.min(1, Math.max(0, e.confidence)) : 0.6,
        needsReview: !!e.needsReview,
        metadata: e.metadata || {},
      }));
      rawEntitiesBySegment.push(parsedEntities);
    } catch (e) {
      rawEntitiesBySegment.push([]);
    }

    // Stage3: production extraction (quest steps, storyboard, av, text packaging)
    const p3 = stage3ProductionPrompt(seg.text, [mode]);
    try {
      const resp3 = await callLLM(p3, { temperature: 0, maxTokens: 1000 });
      let j: any = {};
      try {
        j = JSON.parse(resp3);
      } catch {
        j = {};
      }
      // normalize questSteps array
      const steps: QuestStep[] = (j.questSteps || []).map((s: any) => ({
        id: makeId('step_'),
        title: s.title || '',
        description: s.description || s.text || '',
        order: typeof s.order === 'number' ? s.order : null,
        prerequisites: s.prerequisites || [],
        successConditions: s.successConditions || [],
        failureConditions: s.failureConditions || [],
        choices: s.choices || [],
        avRequirements: s.avRequirements || [],
        storyboardIds: s.storyboardIds || [],
        sourceSegmentIds: [seg.id],
        confidence: typeof s.confidence === 'number' ? Math.min(1, Math.max(0, s.confidence)) : 0.6,
        needsReview: !!s.needsReview,
      }));
      rawStepsBySegment.push(steps);
      // (Narrative copy / storyboard / av 返回也应当被保存到 entities 中 — 这里我们只把 steps 交给 merger)
    } catch (e) {
      rawStepsBySegment.push([]);
    }
  }

  // Stage4: 合并实体与关系校验
  const { mergedEntities, mergedSteps, warnings } = await mergeEntitiesAndSteps(segments, rawEntitiesBySegment, rawStepsBySegment);

  // Stage5: 结果整理（不用保存，只返回给调用方）
  const result: ParseResult = {
    documentId: makeId('doc_'),
    segments,
    entities: mergedEntities,
    quests: [], // 复杂任务识别可在后期增加：将 merged entities 中 type=Quest 的条目填充 steps & connections
    questSteps: mergedSteps,
    storyboard: [], // 如果你需要，可在 Stage3/Stage4 拿到并填入
    av: [], // 同上
    annotations: [],
    warnings,
    generatedAt: new Date().toISOString(),
  };

  return result;
}
