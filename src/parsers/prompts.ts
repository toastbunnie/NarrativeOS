// 各阶段的 prompt 模板（中英文注释），原则：禁止编造、保留原文信息、遇到不确定标注 needReview
export function stage2EntityPrompt(segmentText: string, mode: string) {
  return `阶段2：实体抽取（仅从给定文本中抽取，不允许编造）
模式: ${mode}
任务:
1) 识别以下类别（若无则返回空数组）: Characters, Locations, Factions, Items, Events, Quests, Lore, Themes。
2) 对每个实体输出 JSON 条目: { "type":"Character", "name":"xxx", "aliases":[], "description":"原文相关描述（原句或摘要）", "sourceText":"原文片段/所在句子", "confidence":0.0, "needsReview": false }
3) 不要合并同名实体（合并留给 Stage4）。
4) 如果信息不明确，请把 name 设为空，把可能的名字放进 aliases 并标注 needsReview=true。
5) 输出整体为 JSON 数组。

仅分析下面文本（不要使用文本外信息）：
----------------
${segmentText}
----------------

注意：绝对不要在输出中加入任何未在原文提到的新人物/事件/地点/任务；若无法确定请留空并标注 needsReview。`;
}

export function stage3ProductionPrompt(segmentText: string, modes: string[]) {
  return `阶段3：生产内容抽取（从文本片段中提取可直接变成生产资料的信息）
目标类型示例：Quest Steps, Quest Connections, Narrative Copy（文本包装）、Storyboard（分镜）、AV Requirements（音美）。
请以 JSON 输出一个对象，结构:
{
  "questSteps": [ { "title": "", "description":"", "order": null, "sourceText":"...", "confidence":0.0, "needsReview": false } ],
  "questConnections": [ { "from":null, "to":null, "condition":"", "type":"", "confidence":0.0, "needsReview": false } ],
  "narrativeCopy": [ { "type":"Letter|UI|Flavor|Loading|Doc", "text":"...", "sourceText":"...", "confidence":0.0, "needsReview": false } ],
  "storyboard": [ { "notes":"自由字段，保留原句", "sourceText":"...", "confidence":0.0 } ],
  "av": [ { "range":"Global|Shot|Step", "description":"如音乐/音效/配音/环境/美术/动画", "sourceText":"...", "confidence":0.0 } ]
}

仅分析下面文本（不要使用文本外信息）：
----------------
${segmentText}
----------------

规则：禁止编造，不要合并实体或步骤（合并留给 Stage4），当不确定字段写 needsReview=true 且可将 name/描述留空或给出候选。`;
}
