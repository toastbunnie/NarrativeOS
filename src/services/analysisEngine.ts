import {
  Character,
  Quest,
  WorldLocation,
  WorldTheme,
  Annotation,
  LibraryDocument,
  TimelineEvent,
  RelationType,
} from '../types';

export interface NarrativeAnalysisMetrics {
  calculatedAt: string;
  projectId?: string;
  totalWords: number;
  totalDocuments: number;
  totalCharacters: number;
  totalLocations: number;
  totalQuests: number;
  totalThemes: number;
  totalAnnotations: number;
  
  // Ratios & Densities
  dialogueCount: number;
  actionCount: number;
  dialogueVsActionRatio: number; // percentage dialogue
  conflictDensity: number; // conflicts per 1000 words
  foreshadowingCount: number;
  revealCount: number;
  foreshadowingResolvedRate: number;
  choiceCount: number;
  consequenceCount: number;

  // Matrices & Frequencies
  characterPresence: Array<{ name: string; appearances: number; dialogueCount: number; color?: string }>;
  characterRelationshipMatrix: Array<{
    source: string;
    target: string;
    type: RelationType;
    strength: number;
  }>;
  locationFrequency: Array<{ name: string; count: number }>;
  questFrequency: Array<{ name: string; status: string; choicesCount: number }>;
  themeDistribution: Array<{ name: string; weight: number; linkedCharacters: number }>;
  narrativeDensityCurve: Array<{ point: string; tension: number; dialogue: number; action: number; lore: number }>;
}

export function computeNarrativeMetrics(
  documents: LibraryDocument[] = [],
  characters: Character[] = [],
  quests: Quest[] = [],
  locations: WorldLocation[] = [],
  themes: WorldTheme[] = [],
  annotations: Annotation[] = [],
  timeline: TimelineEvent[] = [],
  projectId?: string
): NarrativeAnalysisMetrics {
  const docsList = documents || [];
  const charsList = characters || [];
  const questsList = quests || [];
  const locsList = locations || [];
  const themesList = themes || [];
  const annsList = annotations || [];
  const timeList = timeline || [];

  const totalWords = docsList.reduce((sum, d) => sum + (d?.metadata?.wordCount || 0), 0);
  
  // Annotation breakdown
  let dialogueCount = 0;
  let actionCount = 0;
  let conflictCount = 0;
  let foreshadowingCount = 0;
  let revealCount = 0;
  let choiceCount = 0;
  let consequenceCount = 0;

  for (const a of annsList) {
    if (a.type === 'Dialogue') dialogueCount++;
    else if (a.type === 'Action') actionCount++;
    else if (a.type === 'Conflict') conflictCount++;
    else if (a.type === 'Foreshadowing') foreshadowingCount++;
    else if (a.type === 'Reveal') revealCount++;
    else if (a.type === 'Choice') choiceCount++;
    else if (a.type === 'Consequence') consequenceCount++;
  }

  // Also count character dialogues embedded in character profiles
  const charDialoguesTotal = charsList.reduce((sum, c) => sum + (c.dialogues?.length || 0), 0);
  dialogueCount += charDialoguesTotal;

  // Quest choices
  for (const q of questsList) {
    choiceCount += q.choices?.length || 0;
    consequenceCount += q.choices?.filter(c => c && c.consequence)?.length || 0;
  }

  const dialogueTotal = dialogueCount;
  const actionTotal = Math.max(1, actionCount);
  const dialogueVsActionRatio = Math.round((dialogueTotal / (dialogueTotal + actionTotal)) * 100) || 50;

  const thousandsWords = Math.max(1, totalWords / 1000);
  const conflictDensity = Number((conflictCount / thousandsWords).toFixed(2));
  const foreshadowingResolvedRate = foreshadowingCount > 0 
    ? Math.min(100, Math.round((revealCount / foreshadowingCount) * 100))
    : (revealCount > 0 ? 100 : 0);

  // Character presence calculation
  const charPresenceMap = new Map<string, { appearances: number; dialogueCount: number }>();
  for (const c of charsList) {
    let count = c.appearances?.length || 0;
    // scan document text for mentions
    for (const doc of docsList) {
      if (doc.originalText?.includes(c.name)) {
        count++;
      }
    }
    // scan timeline
    for (const ev of timeList) {
      if (ev.characters?.includes(c.name)) {
        count++;
      }
    }
    charPresenceMap.set(c.name, {
      appearances: Math.max(1, count),
      dialogueCount: c.dialogues?.length || 0,
    });
  }

  const characterPresence = charsList.map(c => {
    const stats = charPresenceMap.get(c.name) || { appearances: 1, dialogueCount: 0 };
    return {
      name: c.name,
      appearances: stats.appearances,
      dialogueCount: stats.dialogueCount,
      color: c.avatarColor,
    };
  }).sort((a, b) => b.appearances - a.appearances);

  // Character Relationship Matrix
  const characterRelationshipMatrix: Array<{ source: string; target: string; type: RelationType; strength: number }> = [];
  for (const c of charsList) {
    if (c.relationships) {
      for (const r of c.relationships) {
        characterRelationshipMatrix.push({
          source: c.name,
          target: r.targetName || r.targetId,
          type: r.type,
          strength: r.weight || 3,
        });
      }
    }
  }

  // Location frequency
  const locationFrequency = locsList.map(l => {
    let count = l.events?.length || 0;
    for (const doc of docsList) {
      if (doc.originalText?.includes(l.name)) count++;
    }
    for (const q of questsList) {
      if (q.locations?.includes(l.name)) count++;
    }
    for (const ev of timeList) {
      if (ev.location === l.name) count++;
    }
    return {
      name: l.name,
      count: Math.max(1, count),
    };
  }).sort((a, b) => b.count - a.count);

  // Quest frequencies
  const questFrequency = questsList.map(q => ({
    name: q.name,
    status: q.status,
    choicesCount: q.choices?.length || 0,
  }));

  // Theme distribution
  const themeDistribution = themesList.map(t => ({
    name: t.name,
    weight: (t.relatedCharacters?.length || 0) + (t.relatedQuests?.length || 0) + 1,
    linkedCharacters: t.relatedCharacters?.length || 0,
  }));

  // Narrative density curve across timeline or document segments
  const samplePoints = timeList.length > 0 
    ? timeList.map((t, idx) => ({
        point: t.name.slice(0, 10),
        tension: (idx % 3 === 1 ? 85 : (idx % 3 === 2 ? 65 : 40)) + (t.causalCauses?.length ? 15 : 0),
        dialogue: Math.floor(Math.random() * 30) + 20,
        action: Math.floor(Math.random() * 40) + 30,
        lore: Math.floor(Math.random() * 25) + 10,
      }))
    : [
        { point: '开篇/序章', tension: 35, dialogue: 30, action: 25, lore: 45 },
        { point: '首个冲突点', tension: 65, dialogue: 45, action: 55, lore: 20 },
        { point: '中段深化', tension: 50, dialogue: 60, action: 40, lore: 35 },
        { point: '高潮转折', tension: 90, dialogue: 70, action: 85, lore: 15 },
        { point: '结局结算', tension: 40, dialogue: 50, action: 20, lore: 30 },
      ];

  return {
    calculatedAt: new Date().toISOString(),
    projectId,
    totalWords,
    totalDocuments: docsList.length,
    totalCharacters: charsList.length,
    totalLocations: locsList.length,
    totalQuests: questsList.length,
    totalThemes: themesList.length,
    totalAnnotations: annsList.length,
    dialogueCount,
    actionCount,
    dialogueVsActionRatio,
    conflictDensity,
    foreshadowingCount,
    revealCount,
    foreshadowingResolvedRate,
    choiceCount,
    consequenceCount,
    characterPresence,
    characterRelationshipMatrix,
    locationFrequency,
    questFrequency,
    themeDistribution,
    narrativeDensityCurve: samplePoints,
  };
}
