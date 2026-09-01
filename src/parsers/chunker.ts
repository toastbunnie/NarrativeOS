// 文本切块与阶段1（结构理解）实现
import { Segment } from './types';
import crypto from 'crypto';
import { callLLM } from './llmClient';
const DEFAULT_CHUNK_SIZE = 1200; // 字符，大文本分片阈值，可调整

function idFor(text: string) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

export async function chunkAndDescribe(text: string): Promise<Segment[]> {
  // 简单基于换行和长度分割为块，保留标题/章节（粗略）
  const paragraphs = text.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const p of paragraphs) {
    if (p.length <= DEFAULT_CHUNK_SIZE) {
      const s: Segment = { id: idFor(`${cursor}:${p.length}`), text: p, start: cursor, end: cursor + p.length };
      segments.push(s);
      cursor += p.length + 2;
    } else {
      // 对超长段落再按句号或逗号切分（防止一次发太多)
      const approxPieces = Math.ceil(p.length / DEFAULT_CHUNK_SIZE);
      const pieceLen = Math.ceil(p.length / approxPieces);
      for (let i = 0; i < approxPieces; i++) {
        const piece = p.slice(i * pieceLen, (i + 1) * pieceLen);
        const s: Segment = { id: idFor(`${cursor}:${i}:${piece.length}`), text: piece, start: cursor, end: cursor + piece.length };
        segments.push(s);
        cursor += piece.length;
      }
      cursor += 2;
    }
  }

  // 对每个 segment 请求一个短摘要（阶段1保留上下文摘要）
  // 为节省成本，这里对较短的段落只生成 very short summary
  await Promise.all(
    segments.map(async seg => {
      const prompt = `请为下面文本生成一两句中文摘要（保留关键要素、实体与类型），不要添加任何原文中没有的内容。输出 JSON: {"summary":"..."}。\n\n文本：\n${seg.text}\n\n注意：如果信息不确定请写空字符串。`;
      try {
        const resp = await callLLM(prompt, { temperature: 0, maxTokens: 200 });
        // 尝试解析模型返回的 JSON，否则用原文前120字符作为摘要
        try {
          const j = JSON.parse(resp);
          seg.summary = j.summary ?? '';
        } catch {
          seg.summary = resp.trim().slice(0, 200);
        }
      } catch (e) {
        seg.summary = '';
      }
    })
  );

  return segments;
}
