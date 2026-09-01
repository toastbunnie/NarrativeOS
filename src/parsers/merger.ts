// 实体合并与关系校验（Stage4）
// 使用 embedding 相似度（若可用）+ 文本相似度回退
import { BaseEntity, ParseResult, Segment, QuestStep } from './types';
import { getEmbeddings } from './llmClient';

function simpleStringSimilarity(a: string, b: string) {
  if (!a || !b) return 0;
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 1;
  // Jaccard on word sets
  const as = new Set(a.split(/\W+/).filter(Boolean));
  const bs = new Set(b.split(/\W+/).filter(Boolean));
  const inter = new Set([...as].filter(x => bs.has(x)));
  const union = new Set([...as, ...bs]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

async function embeddingsSimilarityMatrix(texts: string[]) {
  try {
    const embeddings = await getEmbeddings(texts);
    const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
    const norm = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const mat: number[][] = [];
    for (let i = 0; i < embeddings.length; i++) {
      mat[i] = [];
      for (let j = 0; j < embeddings.length; j++) {
        const sim = dot(embeddings[i], embeddings[j]) / (norm(embeddings[i]) * norm(embeddings[j]) + 1e-12);
        mat[i][j] = sim;
      }
    }
    return mat;
  } catch (e) {
    return null;
  }
}

export async function mergeEntitiesAndSteps(segments: Segment[], rawEntitiesBySegment: BaseEntity[][], rawStepsBySegment: QuestStep[][]) {
  // 平铺所有实体与步骤
  const allEntities = rawEntitiesBySegment.flat();
  const allSteps = rawStepsBySegment.flat();

  // 基本合并策略：
  // 1) 用 name 相似度（字符串+embedding）合并
  // 2) 若 name 为空但 description 高度相似且来源段落有交集，尝试合并并标 needsReview
  // 3) 对 steps 做类似处理；同时检查孤立步骤（没有任务关联）并在 warnings 中提示

  // 构造比较文本
  const texts = allEntities.map(e => (e.name || '') + ' ||| ' + (e.description || '')).filter(Boolean);
  const simMat = await embeddingsSimilarityMatrix(texts);

  const merged: BaseEntity[] = [];
  const used = new Array(allEntities.length).fill(false);
  for (let i = 0; i < allEntities.length; i++) {
    if (used[i]) continue;
    const base = { ...allEntities[i], sourceSegmentIds: [...allEntities[i].sourceSegmentIds] } as BaseEntity;
    used[i] = true;
    for (let j = i + 1; j < allEntities.length; j++) {
      if (used[j]) continue;
      let sim = 0;
      if (simMat) {
        sim = simMat[i]?.[j] ?? 0;
      } else {
        sim = simpleStringSimilarity(allEntities[i].name || allEntities[i].description || '', allEntities[j].name || allEntities[j].description || '');
      }
      // 阈值：如果 embedding 相似度 > 0.86 或字符串相似度 > 0.7 视为同一实体（阈值可调）
      const threshold = simMat ? 0.86 : 0.7;
      if (sim >= threshold) {
        // 合并 j 到 base
        base.aliases = Array.from(new Set([...(base.aliases || []), ...(allEntities[j].aliases || []), allEntities[j].name || ''].filter(Boolean)));
        base.description = (base.description || '') + '\n' + (allEntities[j].description || '');
        base.sourceSegmentIds = Array.from(new Set([...base.sourceSegmentIds, ...allEntities[j].sourceSegmentIds]));
        base.confidence = Math.max(base.confidence || 0, allEntities[j].confidence || 0) * 0.9; // 保守
        base.needsReview = (base.needsReview || false) || (allEntities[j].needsReview || false);
        used[j] = true;
      }
    }
    merged.push(base);
  }

  // Steps：简单合并相似步骤（order, description相似）
  const mergedSteps: QuestStep[] = [];
  const usedStep = new Array(allSteps.length).fill(false);
  for (let i = 0; i < allSteps.length; i++) {
    if (usedStep[i]) continue;
    const sbase = { ...allSteps[i], sourceSegmentIds: [...allSteps[i].sourceSegmentIds] } as QuestStep;
    usedStep[i] = true;
    for (let j = i + 1; j < allSteps.length; j++) {
      if (usedStep[j]) continue;
      const sim = simpleStringSimilarity((sbase.title || '') + ' ' + (sbase.description || ''), (allSteps[j].title || '') + ' ' + (allSteps[j].description || ''));
      if (sim > 0.6) {
        sbase.description = (sbase.description || '') + '\n' + (allSteps[j].description || '');
        sbase.sourceSegmentIds = Array.from(new Set([...sbase.sourceSegmentIds, ...allSteps[j].sourceSegmentIds]));
        sbase.confidence = Math.max(sbase.confidence || 0, allSteps[j].confidence || 0) * 0.95;
        sbase.needsReview = (sbase.needsReview || false) || (allSteps[j].needsReview || false);
        usedStep[j] = true;
      }
    }
    mergedSteps.push(sbase);
  }

  // 关系校验：简单检查 steps referencing entity names and produce warnings for isolated steps
  const warnings: string[] = [];
  const stepHasAssociation = new Array(mergedSteps.length).fill(false);
  for (let si = 0; si < mergedSteps.length; si++) {
    const s = mergedSteps[si];
    for (const e of merged) {
      if ((e.name && s.description && s.description.includes(e.name)) || (e.aliases?.some(a => s.description?.includes(a)))) {
        stepHasAssociation[si] = true;
        break;
      }
    }
    if (!stepHasAssociation[si]) {
      warnings.push(`孤立步骤: ${s.id}（可能未识别到相关角色/地点/任务，需确认）`);
      s.needsReview = true;
    }
  }

  return { mergedEntities: merged, mergedSteps, warnings };
}
