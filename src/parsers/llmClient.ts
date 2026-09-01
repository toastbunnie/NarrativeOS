// 抽象 LLM client：项目里若已有 LLM 调用封装，请用该封装替换此文件的实现。
// 目标：提供 callLLM(prompt, options) 和 getEmbeddings(text[])（可选）
import fetch from 'node-fetch';

export type LLMOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // 其它 provider-specific fields...
};

export async function callLLM(prompt: string, opts?: LLMOptions): Promise<string> {
  // 示例：对接 OpenAI API（需在项目中用现有 key 替换）
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const body = {
    model: opts?.model || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: opts?.temperature ?? 0,
    max_tokens: opts?.maxTokens ?? 800,
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`LLM call failed: ${res.status} ${txt}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  return content;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  // 示例：OpenAI embeddings；如果项目没有 embedding 使用可改为 simple string-similarity.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
  });
  if (!res.ok) throw new Error('Embeddings request failed');
  const json = await res.json();
  return json.data.map((d: any) => d.embedding as number[]);
}
