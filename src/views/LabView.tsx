import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FlaskConical,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Compass,
  MapPin,
  Clock,
  Save,
  ArrowRight,
  RefreshCw,
  Cpu,
  Bot,
  Send,
  BookOpen,
  Wand2,
  Trash2,
  Copy,
  Upload,
  Layers,
  Film,
  Music,
  Tag,
  Shield,
  Package,
  FileCode,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FolderOpen,
  SlidersHorizontal,
  Eye,
  CheckSquare,
  Square,
  Filter,
  Zap,
  CheckCheck,
  Sparkle,
  Sliders,
  ListFilter,
  Maximize2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { extractNarrativeEntities, getStoredAISettings, chatWithNarrativeAI } from '../services/aiService';
import { putToStore, logActivity } from '../services/db';
import { parseFile } from '../services/fileParser';
import {
  Character,
  Quest,
  QuestStep,
  QuestConnection,
  NarrativeCopy,
  Storyboard,
  AVRequirement,
  WorldLocation,
  WorldFaction,
  WorldItem,
  WorldLore,
  WorldTheme,
  WorldEvent,
  TimelineEvent,
  Annotation,
  EntityExtractionResult,
  LibraryDocument,
  Project,
  NarrativeCopyType,
  AVType,
  AVLevel,
  QuestStepType,
  QuestConnectionType,
  RelationType,
} from '../types';

export const LabView: React.FC = () => {
  const {
    t,
    documents,
    characters,
    quests,
    locations,
    activeProjectId,
    projects,
    selectedDocForLab,
    refreshData,
    showToast,
    setActiveProjectId,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'extract' | 'copilot'>('extract');

  // Extraction input states
  const [rawText, setRawText] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [result, setResult] = useState<EntityExtractionResult | null>(null);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);

  // Target Project Configuration
  const [projectTargetMode, setProjectTargetMode] = useState<'existing' | 'new'>('existing');
  const [targetProjectId, setTargetProjectId] = useState<string>(activeProjectId || (projects[0]?.id || ''));
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectType, setNewProjectType] = useState<'game_script' | 'novel' | 'worldbuilding' | 'interactive_fiction'>('game_script');

  // Preview Category Filter
  const [previewCategory, setPreviewCategory] = useState<string>('all');

  // Workflow Mode: 'readonly' (只读解析) vs 'smart_correction' (智能修正模式)
  const [workflowMode, setWorkflowMode] = useState<'readonly' | 'smart_correction'>('readonly');
  const [viewDensity, setViewDensity] = useState<'comfortable' | 'compact'>('comfortable');

  // Selection states for batch saving
  const [selectedItems, setSelectedItems] = useState<{
    characters: Record<number, boolean>;
    quests: Record<number, boolean>;
    questSteps: Record<number, boolean>;
    questConnections: Record<number, boolean>;
    narrativeCopy: Record<number, boolean>;
    storyboards: Record<number, boolean>;
    avRequirements: Record<number, boolean>;
    lore: Record<number, boolean>;
    locations: Record<number, boolean>;
    factions: Record<number, boolean>;
    items: Record<number, boolean>;
    events: Record<number, boolean>;
    themes: Record<number, boolean>;
    annotations: Record<number, boolean>;
  }>({
    characters: {},
    quests: {},
    questSteps: {},
    questConnections: {},
    narrativeCopy: {},
    storyboards: {},
    avRequirements: {},
    lore: {},
    locations: {},
    factions: {},
    items: {},
    events: {},
    themes: {},
    annotations: {},
  });

  // Edit item modal state
  const [editingItem, setEditingItem] = useState<{
    category: string;
    index: number;
    data: any;
  } | null>(null);

  // AI Copilot states
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'system' | 'user' | 'assistant'; content: string; id: string }>>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的 AI 叙事架构师。你可以让我帮你编写角色高张力对白、生成支线剧情分支、推演剧情冲突、或者检查剧情世界观的一致性。',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Keep targetProjectId in sync if activeProjectId changes
  useEffect(() => {
    if (activeProjectId && !targetProjectId) {
      setTargetProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  // If navigated with a pre-selected document from Library
  useEffect(() => {
    if (selectedDocForLab) {
      setSelectedDocId(selectedDocForLab.id);
      setRawText(selectedDocForLab.originalText);
    }
  }, [selectedDocForLab]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isGenerating]);

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    if (!docId) {
      setRawText('');
      return;
    }
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      setRawText(doc.originalText);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingFile(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.error) {
        showToast(parsed.error, 'error');
      } else {
        setRawText(parsed.text);
        showToast(`已成功解析文件「${file.name}」（共 ${parsed.wordCount} 字）`, 'success');
      }
    } catch (err: any) {
      showToast(`文件解析失败: ${err.message || String(err)}`, 'error');
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunExtraction = async () => {
    if (!rawText.trim()) {
      showToast('请输入或加载文本后再执行结构化提取', 'error');
      return;
    }

    setIsProcessing(true);
    setProgressMsg('正在全方位剖析剧本文本与生产文案...');
    try {
      const currentAISettings = getStoredAISettings();
      const res = await extractNarrativeEntities(rawText, currentAISettings, (msg) => {
        setProgressMsg(msg);
      });
      setResult(res);

      // Select all recognized items by default
      const charMap: Record<number, boolean> = {};
      (res.characters || []).forEach((_, i) => (charMap[i] = true));

      const questMap: Record<number, boolean> = {};
      (res.quests || []).forEach((_, i) => (questMap[i] = true));

      const stepMap: Record<number, boolean> = {};
      (res.questSteps || []).forEach((_, i) => (stepMap[i] = true));

      const connMap: Record<number, boolean> = {};
      (res.questConnections || []).forEach((_, i) => (connMap[i] = true));

      const copyMap: Record<number, boolean> = {};
      (res.narrativeCopy || []).forEach((_, i) => (copyMap[i] = true));

      const sbMap: Record<number, boolean> = {};
      (res.storyboards || []).forEach((_, i) => (sbMap[i] = true));

      const avMap: Record<number, boolean> = {};
      (res.avRequirements || []).forEach((_, i) => (avMap[i] = true));

      const loreMap: Record<number, boolean> = {};
      (res.lore || []).forEach((_, i) => (loreMap[i] = true));

      const locMap: Record<number, boolean> = {};
      (res.locations || []).forEach((_, i) => (locMap[i] = true));

      const factionMap: Record<number, boolean> = {};
      (res.factions || []).forEach((_, i) => (factionMap[i] = true));

      const itemMap: Record<number, boolean> = {};
      (res.items || []).forEach((_, i) => (itemMap[i] = true));

      const eventMap: Record<number, boolean> = {};
      (res.events || []).forEach((_, i) => (eventMap[i] = true));

      const themeMap: Record<number, boolean> = {};
      (res.themes || []).forEach((_, i) => (themeMap[i] = true));

      const annotMap: Record<number, boolean> = {};
      (res.annotations || []).forEach((_, i) => (annotMap[i] = true));

      setSelectedItems({
        characters: charMap,
        quests: questMap,
        questSteps: stepMap,
        questConnections: connMap,
        narrativeCopy: copyMap,
        storyboards: sbMap,
        avRequirements: avMap,
        lore: loreMap,
        locations: locMap,
        factions: factionMap,
        items: itemMap,
        events: eventMap,
        themes: themeMap,
        annotations: annotMap,
      });

      // Default new project name recommendation
      if (!newProjectName) {
        setNewProjectName(
          res.summary
            ? res.summary.slice(0, 16) + ' 剧情提取'
            : `解析项目 ${new Date().toLocaleDateString()}`
        );
      }

      showToast('文本解析完成！已进入「识别结果预览」，请确认后保存。', 'success');
    } catch (err: any) {
      showToast(`提取失败: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Resolve target projectId for saving
  const resolveTargetProjectId = async (): Promise<string> => {
    const now = Date.now();
    if (projectTargetMode === 'new') {
      const pId = 'proj_' + now + '_' + Math.random().toString(36).slice(2, 6);
      const newProj: Project = {
        id: pId,
        name: newProjectName.trim() || `解析项目 ${new Date().toLocaleDateString()}`,
        description: newProjectDesc.trim() || (result?.summary ? result.summary.slice(0, 100) : '通过文本解析实验区自动生成的项目'),
        type: newProjectType,
        status: 'planning',
        tags: ['解析生成'],
        createdAt: now,
        updatedAt: now,
      };
      await putToStore('projects', newProj);
      setActiveProjectId(pId);
      setTargetProjectId(pId);
      setProjectTargetMode('existing');
      return pId;
    } else {
      if (targetProjectId) return targetProjectId;
      if (activeProjectId) return activeProjectId;
      if (projects.length > 0) return projects[0].id;
      // Fallback create default
      const pId = 'proj_' + now;
      const defaultProj: Project = {
        id: pId,
        name: '默认剧本工程',
        description: '自动创建的剧本工程',
        type: 'game_script',
        status: 'planning',
        tags: ['系统生成'],
        createdAt: now,
        updatedAt: now,
      };
      await putToStore('projects', defaultProj);
      setActiveProjectId(pId);
      return pId;
    }
  };

  // Save selected items across all or single category
  const handleSaveItems = async (categoryFilter?: string, singleItemIndex?: { category: string; index: number }) => {
    if (!result) return;
    const now = Date.now();
    const targetPId = await resolveTargetProjectId();
    let savedCount = 0;

    try {
      // 1. Characters
      if (!categoryFilter || categoryFilter === 'characters') {
        const charList = result.characters || [];
        for (let i = 0; i < charList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'characters' && singleItemIndex.index === i) : selectedItems.characters[i]) {
            const raw = charList[i];
            const charObj: Character = {
              id: 'char_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              name: raw.name || '未命名角色',
              aliases: raw.aliases || [],
              identity: raw.identity || '',
              personality: raw.personality || '',
              goals: raw.goals || '',
              bio: raw.bio || '',
              relationships: [],
              appearances: [],
              dialogues: [],
              events: [],
              locations: [],
              quests: [],
              themes: [],
              tags: ['AI提取'],
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('characters', charObj);
            savedCount++;
          }
        }
      }

      // 2. Quests
      if (!categoryFilter || categoryFilter === 'quests') {
        const questList = result.quests || [];
        for (let i = 0; i < questList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'quests' && singleItemIndex.index === i) : selectedItems.quests[i]) {
            const raw = questList[i];
            const questObj: Quest = {
              id: 'quest_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              name: raw.name || '未命名任务',
              description: raw.description || '',
              objectives: raw.objectives || [],
              characters: raw.characters || [],
              locations: [],
              events: [],
              prerequisites: [],
              choices: [],
              outcomes: [],
              status: 'active',
              tags: ['AI提取'],
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('quests', questObj);
            savedCount++;
          }
        }
      }

      // 3. Quest Steps
      if (!categoryFilter || categoryFilter === 'questSteps') {
        const stepList = result.questSteps || [];
        for (let i = 0; i < stepList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'questSteps' && singleItemIndex.index === i) : selectedItems.questSteps[i]) {
            const raw = stepList[i];
            const stepObj: QuestStep = {
              id: 'step_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              questId: raw.questId || '',
              title: raw.title || `步骤 ${i + 1}`,
              summary: raw.summary || '',
              stepType: (raw.stepType as QuestStepType) || 'normal',
              location: raw.location || '',
              characters: raw.characters || [],
              notes: raw.notes || '',
              orderIndex: i,
              position: { x: 50 + (i % 4) * 220, y: 50 + Math.floor(i / 4) * 220 },
              tags: ['AI提取'],
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('quest_steps', stepObj);
            savedCount++;
          }
        }
      }

      // 4. Quest Connections
      if (!categoryFilter || categoryFilter === 'questConnections') {
        const connList = result.questConnections || [];
        for (let i = 0; i < connList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'questConnections' && singleItemIndex.index === i) : selectedItems.questConnections[i]) {
            const raw = connList[i];
            const connObj: QuestConnection = {
              id: 'conn_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              questId: raw.questId || '',
              fromStepId: raw.fromStepId || '',
              toStepId: raw.toStepId || '',
              type: (raw.type as QuestConnectionType) || 'Next',
              label: raw.label || '',
              condition: raw.condition || '',
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('quest_connections', connObj);
            savedCount++;
          }
        }
      }

      // 5. Narrative Copy
      if (!categoryFilter || categoryFilter === 'narrativeCopy') {
        const copyList = result.narrativeCopy || [];
        for (let i = 0; i < copyList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'narrativeCopy' && singleItemIndex.index === i) : selectedItems.narrativeCopy[i]) {
            const raw = copyList[i];
            const contentText = raw.content || '';
            const copyObj: NarrativeCopy = {
              id: 'copy_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              questId: raw.questId || '',
              type: (raw.type as NarrativeCopyType) || 'other',
              title: raw.title || '未命名文本包装',
              content: contentText,
              flavorText: raw.flavorText || raw.description || '',
              characters: raw.characters || [],
              relatedItemIds: raw.relatedItemIds || [],
              tags: raw.tags || ['AI提取'],
              status: 'draft',
              version: '1.0',
              wordCount: contentText.length,
              notes: raw.notes || '',
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('narrative_copy', copyObj);
            savedCount++;
          }
        }
      }

      // 6. Storyboards
      if (!categoryFilter || categoryFilter === 'storyboards') {
        const sbList = result.storyboards || [];
        for (let i = 0; i < sbList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'storyboards' && singleItemIndex.index === i) : selectedItems.storyboards[i]) {
            const raw = sbList[i];
            const sbObj: Storyboard = {
              id: 'sb_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              questId: raw.questId || '',
              title: raw.title || '文本分镜脚本',
              description: raw.description || '',
              columns: raw.columns && raw.columns.length > 0 ? raw.columns : [
                { id: 'shotNumber', label: '镜头序号', type: 'number', width: 90 },
                { id: 'camera', label: '景别与机位', type: 'text', width: 140 },
                { id: 'visual', label: '画面与动作', type: 'text', width: 240 },
                { id: 'dialogue', label: '台词与对白', type: 'text', width: 200 },
                { id: 'duration', label: '时长与备注', type: 'text', width: 120 },
              ],
              rows: (raw.rows || []).map((r, rIdx) => ({
                id: r.id || `row_${now}_${rIdx}`,
                shotNumber: r.shotNumber || String(rIdx + 1),
                cells: r.cells || {},
              })),
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('storyboards', sbObj);
            savedCount++;
          }
        }
      }

      // 7. AV Requirements
      if (!categoryFilter || categoryFilter === 'avRequirements') {
        const avList = result.avRequirements || [];
        for (let i = 0; i < avList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'avRequirements' && singleItemIndex.index === i) : selectedItems.avRequirements[i]) {
            const raw = avList[i];
            const avObj: AVRequirement = {
              id: 'av_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              questId: raw.questId || '',
              stepId: raw.stepId || '',
              shotId: raw.shotId || '',
              title: raw.title || '未命名音美需求',
              type: (raw.type as AVType) || 'SFX',
              level: (raw.level as AVLevel) || 'global',
              status: 'pending',
              priority: 'medium',
              description: raw.description || '',
              tags: raw.tags || ['AI提取'],
              notes: raw.notes || '',
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('av_requirements', avObj);
            savedCount++;
          }
        }
      }

      // 8. World Lore
      if (!categoryFilter || categoryFilter === 'lore') {
        const loreList = result.lore || [];
        for (let i = 0; i < loreList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'lore' && singleItemIndex.index === i) : selectedItems.lore[i]) {
            const raw = loreList[i];
            const loreObj: WorldLore = {
              id: 'lore_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              title: raw.title || '设定条目',
              category: raw.category || '世界观',
              content: raw.content || '',
              relatedEntities: raw.relatedEntities || [],
              tags: raw.tags || ['AI提取'],
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('lore', loreObj);
            savedCount++;
          }
        }
      }

      // 9. Locations
      if (!categoryFilter || categoryFilter === 'locations') {
        const locList = result.locations || [];
        for (let i = 0; i < locList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'locations' && singleItemIndex.index === i) : selectedItems.locations[i]) {
            const raw = locList[i];
            const locObj: WorldLocation = {
              id: 'loc_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              name: raw.name || '未命名场景',
              type: raw.type || '空间场景',
              description: raw.description || '',
              factions: [],
              lore: '',
              events: [],
              tags: ['AI提取'],
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('locations', locObj);
            savedCount++;
          }
        }
      }

      // 10. Factions
      if (!categoryFilter || categoryFilter === 'factions') {
        const facList = result.factions || [];
        for (let i = 0; i < facList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'factions' && singleItemIndex.index === i) : selectedItems.factions[i]) {
            const raw = facList[i];
            const facObj: WorldFaction = {
              id: 'fac_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              name: raw.name || '未命名势力',
              description: raw.description || '',
              leader: raw.leader || '',
              allies: [],
              rivals: [],
              members: [],
              lore: '',
              tags: ['AI提取'],
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('factions', facObj);
            savedCount++;
          }
        }
      }

      // 11. Items
      if (!categoryFilter || categoryFilter === 'items') {
        const itemList = result.items || [];
        for (let i = 0; i < itemList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'items' && singleItemIndex.index === i) : selectedItems.items[i]) {
            const raw = itemList[i];
            const itemObj: WorldItem = {
              id: 'item_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              name: raw.name || '未命名道具',
              type: raw.type || '关键道具',
              description: raw.description || '',
              owner: raw.owner || '',
              origin: raw.origin || '',
              lore: raw.lore || '',
              effects: raw.effects || '',
              tags: ['AI提取'],
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('items', itemObj);
            savedCount++;
          }
        }
      }

      // 12. Events
      if (!categoryFilter || categoryFilter === 'events') {
        const evList = result.events || [];
        for (let i = 0; i < evList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'events' && singleItemIndex.index === i) : selectedItems.events[i]) {
            const raw = evList[i];
            const evObj: TimelineEvent = {
              id: 'time_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              name: raw.name || '时序事件',
              time: raw.time || '剧本时序',
              orderIndex: i,
              description: raw.description || '',
              location: raw.location || '',
              characters: raw.characters || [],
              causalCauses: [],
              causalDependsOn: [],
              tags: ['AI提取'],
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('timeline', evObj);
            savedCount++;
          }
        }
      }

      // 13. Themes
      if (!categoryFilter || categoryFilter === 'themes') {
        const themeList = result.themes || [];
        for (let i = 0; i < themeList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'themes' && singleItemIndex.index === i) : selectedItems.themes[i]) {
            const raw = themeList[i];
            const themeObj: WorldTheme = {
              id: 'theme_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              name: raw.name || '核心主题',
              coreConcept: raw.coreConcept || '',
              motif: raw.motif || '',
              relatedCharacters: raw.relatedCharacters || [],
              relatedQuests: raw.relatedQuests || [],
              tags: ['AI提取'],
              createdAt: now,
              updatedAt: now,
            };
            await putToStore('themes', themeObj);
            savedCount++;
          }
        }
      }

      // 14. Annotations
      if (!categoryFilter || categoryFilter === 'annotations') {
        const annotList = result.annotations || [];
        for (let i = 0; i < annotList.length; i++) {
          if (singleItemIndex ? (singleItemIndex.category === 'annotations' && singleItemIndex.index === i) : selectedItems.annotations[i]) {
            const raw = annotList[i];
            const annotText = raw.text || '';
            const annotObj: Annotation = {
              id: 'annot_' + now + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
              projectId: targetPId,
              sourceId: selectedDocId || 'lab_extract',
              type: (raw.type as any) || 'Dialogue',
              text: annotText,
              start: 0,
              end: annotText.length,
              note: raw.note || '',
              createdAt: now,
            };
            await putToStore('annotations', annotObj);
            savedCount++;
          }
        }
      }

      await logActivity('AI_EXTRACT_COMMIT', 'lab', `保存 ${savedCount} 项结构化实体到工程`, targetPId);
      showToast(`已成功保存 ${savedCount} 项条目到目标项目！`, 'success');
      await refreshData();
    } catch (e: any) {
      showToast(`保存失败: ${e.message}`, 'error');
    }
  };

  // Toggle selection helper
  const handleToggleItem = (category: keyof typeof selectedItems, index: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [index]: !prev[category][index],
      },
    }));
  };

  // Toggle category select-all
  const handleToggleCategoryAll = (category: keyof typeof selectedItems, targetState?: boolean) => {
    if (!result) return;
    const list = (result[category as keyof EntityExtractionResult] as any[]) || [];
    const current = selectedItems[category] || {};
    const allChecked = list.length > 0 && list.every((_, idx) => current[idx]);
    const nextState = targetState !== undefined ? targetState : !allChecked;

    const newMap: Record<number, boolean> = {};
    list.forEach((_, idx) => {
      newMap[idx] = nextState;
    });

    setSelectedItems((prev) => ({
      ...prev,
      [category]: newMap,
    }));
  };

  // Delete an item from result preview
  const handleDeletePreviewItem = (category: string, index: number) => {
    if (!result) return;
    const updated = { ...result };
    const list = [...((updated as any)[category] || [])];
    list.splice(index, 1);
    (updated as any)[category] = list;
    setResult(updated);

    // Rebuild selection map for category
    const newMap: Record<number, boolean> = {};
    list.forEach((_, idx) => {
      newMap[idx] = true;
    });
    setSelectedItems((prev) => ({
      ...prev,
      [category]: newMap,
    }));
    showToast('已从识别候选列表中移除', 'info');
  };

  // Save edited item
  const handleSaveEditedItem = () => {
    if (!editingItem || !result) return;
    const { category, index, data } = editingItem;
    const updated = { ...result };
    const list = [...((updated as any)[category] || [])];
    list[index] = data;
    (updated as any)[category] = list;
    setResult(updated);
    setEditingItem(null);
    showToast('已更新候选条目', 'success');
  };

  // Calculate totals
  const getTotalRecognizedCount = () => {
    if (!result) return 0;
    return (
      (result.characters?.length || 0) +
      (result.quests?.length || 0) +
      (result.questSteps?.length || 0) +
      (result.questConnections?.length || 0) +
      (result.narrativeCopy?.length || 0) +
      (result.storyboards?.length || 0) +
      (result.avRequirements?.length || 0) +
      (result.lore?.length || 0) +
      (result.locations?.length || 0) +
      (result.factions?.length || 0) +
      (result.items?.length || 0) +
      (result.events?.length || 0) +
      (result.themes?.length || 0) +
      (result.annotations?.length || 0)
    );
  };

  const getSelectedTotalCount = () => {
    if (!result) return 0;
    let count = 0;
    Object.entries(selectedItems).forEach(([catKey, map]) => {
      const list = (result as any)[catKey] || [];
      list.forEach((_: any, idx: number) => {
        if (map[idx]) count++;
      });
    });
    return count;
  };

  // Toggle select all / deselect all across all categories
  const handleToggleAllCategories = (targetState?: boolean) => {
    if (!result) return;
    const currentTotal = getSelectedTotalCount();
    const maxTotal = getTotalRecognizedCount();
    const shouldSelect = targetState !== undefined ? targetState : currentTotal < maxTotal;

    const newSelection: any = {};
    (Object.keys(selectedItems) as Array<keyof typeof selectedItems>).forEach((catKey) => {
      const list = (result as any)[catKey] || [];
      const map: Record<number, boolean> = {};
      list.forEach((_: any, idx: number) => {
        map[idx] = shouldSelect;
      });
      newSelection[catKey] = map;
    });
    setSelectedItems(newSelection);
    showToast(shouldSelect ? `已全选所有 ${maxTotal} 项候选条目` : '已取消全部勾选', 'info');
  };

  // AI / Local Smart Correction & Polish Engine for Candidates
  const handleSmartPolishCandidates = () => {
    if (!result) {
      showToast('暂无待修正的识别结果', 'info');
      return;
    }

    let polishedCount = 0;
    const updated: EntityExtractionResult = JSON.parse(JSON.stringify(result));

    // Polish characters
    if (updated.characters) {
      updated.characters.forEach((c) => {
        if (c.name) {
          const old = c.name;
          c.name = c.name.trim().replace(/^[“"「『【]|["”」』】]$/g, '');
          if (c.personality) c.personality = c.personality.trim();
          if (c.goals) c.goals = c.goals.trim();
          if (c.bio) c.bio = c.bio.trim();
          if (old !== c.name) polishedCount++;
        }
      });
    }

    // Polish quests
    if (updated.quests) {
      updated.quests.forEach((q) => {
        if (q.name) {
          q.name = q.name.trim().replace(/^[“"「『【]|["”」』】]$/g, '');
          if (q.description) q.description = q.description.trim();
          if (q.objectives) q.objectives = q.objectives.map((o) => o.trim()).filter(Boolean);
          polishedCount++;
        }
      });
    }

    // Polish quest steps
    if (updated.questSteps) {
      updated.questSteps.forEach((s) => {
        if (s.title) s.title = s.title.trim();
        if (s.summary) s.summary = s.summary.trim();
        if (s.location) s.location = s.location.trim();
        polishedCount++;
      });
    }

    // Polish narrativeCopy
    if (updated.narrativeCopy) {
      updated.narrativeCopy.forEach((nc) => {
        if (nc.title) nc.title = nc.title.trim().replace(/^[“"「『【]|["”」』】]$/g, '');
        if (nc.content) nc.content = nc.content.trim();
        if (nc.flavorText) nc.flavorText = nc.flavorText.trim();
        polishedCount++;
      });
    }

    // Polish lore
    if (updated.lore) {
      updated.lore.forEach((l) => {
        if (l.title) l.title = l.title.trim().replace(/^[“"「『【]|["”」』】]$/g, '');
        if (l.content) l.content = l.content.trim();
        polishedCount++;
      });
    }

    // Polish locations
    if (updated.locations) {
      updated.locations.forEach((loc) => {
        if (loc.name) loc.name = loc.name.trim();
        if (loc.description) loc.description = loc.description.trim();
        polishedCount++;
      });
    }

    // Polish factions
    if (updated.factions) {
      updated.factions.forEach((f) => {
        if (f.name) f.name = f.name.trim();
        if (f.description) f.description = f.description.trim();
        polishedCount++;
      });
    }

    // Polish items
    if (updated.items) {
      updated.items.forEach((it) => {
        if (it.name) it.name = it.name.trim();
        if (it.description) it.description = it.description.trim();
        polishedCount++;
      });
    }

    setResult(updated);
    showToast(`已完成智能规范化修正，优化了 ${polishedCount} 处候选字段！`, 'success');
  };

  // Filter empty / low confidence items
  const handlePruneInvalidCandidates = () => {
    if (!result) return;
    const updated: EntityExtractionResult = JSON.parse(JSON.stringify(result));
    let removedCount = 0;

    if (updated.characters) {
      const before = updated.characters.length;
      updated.characters = updated.characters.filter((c) => c.name && c.name.trim().length >= 1);
      removedCount += before - updated.characters.length;
    }
    if (updated.quests) {
      const before = updated.quests.length;
      updated.quests = updated.quests.filter((q) => q.name && q.name.trim().length >= 1);
      removedCount += before - updated.quests.length;
    }
    if (updated.narrativeCopy) {
      const before = updated.narrativeCopy.length;
      updated.narrativeCopy = updated.narrativeCopy.filter(
        (nc) => (nc.title && nc.title.trim().length >= 1) || (nc.content && nc.content.trim().length >= 2)
      );
      removedCount += before - updated.narrativeCopy.length;
    }
    if (updated.lore) {
      const before = updated.lore.length;
      updated.lore = updated.lore.filter((l) => (l.title && l.title.trim().length >= 1) || (l.content && l.content.trim().length >= 2));
      removedCount += before - updated.lore.length;
    }

    setResult(updated);
    if (removedCount > 0) {
      showToast(`已过滤清除 ${removedCount} 个残缺/空字段候选条目`, 'success');
    } else {
      showToast('所有候选项均结构完整，无需过滤', 'info');
    }
  };

  // Copilot message sending
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputPrompt;
    if (!textToSend.trim() || isGenerating) return;

    const userMsg = {
      id: 'msg_' + Date.now(),
      role: 'user' as const,
      content: textToSend.trim(),
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setInputPrompt('');
    setIsGenerating(true);

    try {
      const currentAISettings = getStoredAISettings();
      const reply = await chatWithNarrativeAI(
        newHistory.map((m) => ({ role: m.role, content: m.content })),
        currentAISettings,
        {
          projectName: activeProject?.name,
          characters,
          quests,
          locations,
        }
      );

      setChatMessages((prev) => [
        ...prev,
        {
          id: 'msg_' + Date.now() + '_ai',
          role: 'assistant',
          content: reply,
        },
      ]);
    } catch (err: any) {
      showToast(`生成失败: ${err.message}`, 'error');
      setChatMessages((prev) => [
        ...prev,
        {
          id: 'msg_' + Date.now() + '_err',
          role: 'assistant',
          content: `⚠️ 生成遇到问题: ${err.message}`,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveOutputAsDocument = async (content: string, title = 'AI 生成剧本文档') => {
    const now = Date.now();
    const docId = 'doc_' + now + '_' + Math.random().toString(36).slice(2, 6);
    const newDoc: LibraryDocument = {
      id: docId,
      projectId: activeProjectId || '',
      title: `${title} (${new Date().toLocaleTimeString()})`,
      fileType: 'TXT',
      category: 'script',
      originalText: content,
      segments: [],
      summary: content.slice(0, 120),
      tags: ['AI生成'],
      metadata: {
        wordCount: content.length,
        importedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    await putToStore('documents', newDoc);
    await logActivity('CREATE_DOCUMENT', 'document', newDoc.title, activeProjectId || undefined);
    showToast('已保存为项目资料文档！', 'success');
    await refreshData();
  };

  const quickPrompts = [
    { label: '🎭 生成高张力对手戏对白', prompt: '请基于当前已有的角色设定，为他们构思一段充满潜台词、理念碰撞与伏笔的高张力剧情对白。' },
    { label: '⚔️ 设计多分支任务抉择', prompt: '请为主角设计一个充满道德困境或利益权衡的支线任务，包含 3 个具有不可逆后果的分支选项。' },
    { label: '🏰 拓展世界观神话秘闻', prompt: '请为当前世界观补充一段失落文明的禁忌秘闻与一件具有代价的神秘圣物设定。' },
    { label: '🔍 剧情一致性与暗线体检', prompt: '请审查当前的角色动机和剧情发展，指出可能存在的逻辑漏洞、人设崩塌点或值得深挖的伏笔。' },
  ];

  // Category navigation items
  const categoryDefs = [
    { id: 'all', label: '全部类别', icon: Layers, count: getTotalRecognizedCount() },
    { id: 'characters', label: '角色设定', icon: Users, count: result?.characters?.length || 0 },
    { id: 'quests', label: '任务目标', icon: Compass, count: result?.quests?.length || 0 },
    { id: 'questSteps', label: '任务步骤', icon: Layers, count: result?.questSteps?.length || 0 },
    { id: 'questConnections', label: '流向连线', icon: ArrowRight, count: result?.questConnections?.length || 0 },
    { id: 'narrativeCopy', label: '文本包装', icon: FileText, count: result?.narrativeCopy?.length || 0 },
    { id: 'storyboards', label: '分镜脚本', icon: Film, count: result?.storyboards?.length || 0 },
    { id: 'avRequirements', label: '音美需求', icon: Music, count: result?.avRequirements?.length || 0 },
    { id: 'lore', label: '世界设定', icon: BookOpen, count: result?.lore?.length || 0 },
    { id: 'locations', label: '场景地标', icon: MapPin, count: result?.locations?.length || 0 },
    { id: 'factions', label: '势力组织', icon: Shield, count: result?.factions?.length || 0 },
    { id: 'items', label: '关键道具', icon: Package, count: result?.items?.length || 0 },
    { id: 'events', label: '时序事件', icon: Clock, count: result?.events?.length || 0 },
    { id: 'themes', label: '核心主题', icon: Sparkles, count: result?.themes?.length || 0 },
    { id: 'annotations', label: '叙事标注', icon: Tag, count: result?.annotations?.length || 0 },
  ];

  return (
    <div id="lab-view-container" className="space-y-6 pb-16" style={{ color: 'var(--text-primary)' }}>
      {/* Top Header */}
      <div className="glass-card p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div
            className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-bold mb-2 border"
            style={{
              background: 'var(--theme-secondary-bg)',
              color: 'var(--theme-secondary-text)',
              borderColor: 'var(--theme-secondary-border)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
            <span>NARRATIVE PARSING & AI LAB</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <FlaskConical className="w-6 h-6" style={{ color: 'var(--theme-primary)' }} />
            <span>文本解析实验区</span>
          </h2>
          <p className="text-xs opacity-75 mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
            导入文本自动全维识别叙事知识、文本包装、动态分镜与音美需求，确认后精准归档入库
          </p>
        </div>

        {/* SubTab Switcher - Responsive with spring sliding pill */}
        <div
          className="relative grid grid-cols-2 sm:flex sm:items-center p-1 rounded-2xl border shadow-inner w-full sm:w-auto"
          style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <button
            id="lab-tab-extract-btn"
            type="button"
            onClick={() => setActiveSubTab('extract')}
            className={`relative z-10 flex items-center justify-center space-x-1.5 px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-colors min-h-[40px] sm:min-h-[36px] ${
              activeSubTab === 'extract' ? 'text-white' : 'opacity-70 hover:opacity-100'
            }`}
          >
            {activeSubTab === 'extract' && (
              <motion.div
                layoutId="lab-subtab-pill"
                className="absolute inset-0 rounded-xl theme-btn-primary -z-10 shadow-sm"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <Cpu className="w-3.5 h-3.5" />
            <span>结构化解析实验</span>
          </button>

          <button
            id="lab-tab-copilot-btn"
            type="button"
            onClick={() => setActiveSubTab('copilot')}
            className={`relative z-10 flex items-center justify-center space-x-1.5 px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-colors min-h-[40px] sm:min-h-[36px] ${
              activeSubTab === 'copilot' ? 'text-white' : 'opacity-70 hover:opacity-100'
            }`}
          >
            {activeSubTab === 'copilot' && (
              <motion.div
                layoutId="lab-subtab-pill"
                className="absolute inset-0 rounded-xl theme-btn-primary -z-10 shadow-sm"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <Bot className="w-3.5 h-3.5" />
            <span>AI 叙事工坊与推演</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'extract' ? (
        <div className="space-y-6">
          {/* Top Sticky Floating Quick Bar (悬浮快捷工作流栏) */}
          <div
            id="lab-workflow-floating-bar"
            className="sticky top-2 z-30 p-2.5 sm:p-3.5 rounded-2xl glass-card border shadow-lg backdrop-blur-xl transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3"
            style={{
              borderColor: workflowMode === 'smart_correction' ? 'var(--theme-primary)' : 'var(--border-subtle)',
            }}
          >
            {/* Left: Mode Switcher & Dynamic Badge */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full">
              {/* Workflow Mode Pill Switcher with spring animation */}
              <div
                className="relative inline-flex p-1 rounded-xl border shadow-inner items-center flex-shrink-0"
                style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  id="lab-mode-readonly-btn"
                  type="button"
                  onClick={() => {
                    setWorkflowMode('readonly');
                    showToast('已切换至「只读解析模式」：防误触安全浏览，专注于海量文本高速审阅与批量归档', 'info');
                  }}
                  className={`relative z-10 flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors min-h-[36px] ${
                    workflowMode === 'readonly'
                      ? 'text-white'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {workflowMode === 'readonly' && (
                    <motion.div
                      layoutId="lab-workflow-pill"
                      className="absolute inset-0 rounded-lg theme-btn-primary -z-10 shadow-sm"
                      transition={{ type: 'spring', stiffness: 480, damping: 35 }}
                    />
                  )}
                  <Eye className="w-3.5 h-3.5" />
                  <span>只读解析</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  id="lab-mode-correction-btn"
                  type="button"
                  onClick={() => {
                    setWorkflowMode('smart_correction');
                    showToast('已切换至「智能修正模式」：已激活智能规范校正、空缺提示与内联编辑工具', 'success');
                  }}
                  className={`relative z-10 flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors min-h-[36px] ${
                    workflowMode === 'smart_correction'
                      ? 'text-white'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {workflowMode === 'smart_correction' && (
                    <motion.div
                      layoutId="lab-workflow-pill"
                      className="absolute inset-0 rounded-lg theme-btn-primary -z-10 shadow-sm"
                      transition={{ type: 'spring', stiffness: 480, damping: 35 }}
                    />
                  )}
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>智能修正模式</span>
                </motion.button>
              </div>

              {/* Mode Description Badge with smooth crossfade */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={workflowMode}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                  className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-medium flex-shrink-0"
                  style={{
                    background: workflowMode === 'smart_correction' ? 'var(--theme-secondary-bg)' : 'var(--bg-surface)',
                    borderColor: workflowMode === 'smart_correction' ? 'var(--theme-secondary-border)' : 'var(--border-subtle)',
                    color: workflowMode === 'smart_correction' ? 'var(--theme-secondary-text)' : 'var(--text-secondary)',
                  }}
                >
                  {workflowMode === 'readonly' ? (
                    <>
                      <Eye className="w-3.5 h-3.5 opacity-80" />
                      <span>只读解析：纯览防误触，支持全选/反选与排版切换，专注高效批审</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" style={{ color: 'var(--theme-primary)' }} />
                      <span>智能修正：激活格式规范、残缺项过滤与内联候选字段修正</span>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right: Quick Action Controls based on Mode (Scrollable on mobile) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 justify-start md:justify-end max-w-full">
              {/* Target Project Info Badge */}
              <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono opacity-85 flex-shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <FolderOpen className="w-3.5 h-3.5 opacity-70" style={{ color: 'var(--theme-primary)' }} />
                <span className="truncate max-w-[110px] sm:max-w-[130px] font-bold">
                  {projects.find(p => p.id === targetProjectId)?.name || '目标项目'}
                </span>
              </div>

              {/* Candidate Counter */}
              {result && (
                <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold flex-shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  <span className="opacity-60">候选项:</span>
                  <span style={{ color: 'var(--theme-primary)' }}>
                    {getSelectedTotalCount()}/{getTotalRecognizedCount()}
                  </span>
                </div>
              )}

              {/* Mode specific action tools */}
              {workflowMode === 'readonly' ? (
                <>
                  {/* Readonly Quick Actions */}
                  {result && (
                    <>
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        whileHover={{ scale: 1.02 }}
                        type="button"
                        onClick={() => handleToggleAllCategories()}
                        className="inline-flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold opacity-80 hover:opacity-100 active:scale-95 transition-all flex-shrink-0 min-h-[36px]"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                        title="切换全选 / 全不选"
                      >
                        {getSelectedTotalCount() === getTotalRecognizedCount() && getTotalRecognizedCount() > 0 ? (
                          <>
                            <Square className="w-3.5 h-3.5" />
                            <span>取消全选</span>
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>全选所有</span>
                          </>
                        )}
                      </motion.button>

                      {/* Density switch */}
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        whileHover={{ scale: 1.02 }}
                        type="button"
                        onClick={() => setViewDensity(prev => prev === 'comfortable' ? 'compact' : 'comfortable')}
                        className="inline-flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold opacity-80 hover:opacity-100 active:scale-95 transition-all flex-shrink-0 min-h-[36px]"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                        title="切换紧凑 / 舒适排版"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{viewDensity === 'compact' ? '紧凑' : '舒适'}</span>
                      </motion.button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* Smart Correction Quick Actions */}
                  {result && (
                    <>
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        whileHover={{ scale: 1.02 }}
                        type="button"
                        onClick={handleSmartPolishCandidates}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs hover:opacity-90 active:scale-95 flex-shrink-0 min-h-[36px]"
                        style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-secondary-text)', borderColor: 'var(--theme-secondary-border)' }}
                        title="自动清理空格、符号与格式"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>智能规范</span>
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        whileHover={{ scale: 1.02 }}
                        type="button"
                        onClick={handlePruneInvalidCandidates}
                        className="inline-flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold opacity-80 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 active:scale-95 transition-all flex-shrink-0 min-h-[36px]"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                        title="清除名称为空或残缺的候选条目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>过滤残缺</span>
                      </motion.button>
                    </>
                  )}
                </>
              )}

              {/* Universal Save Button on floating bar when results exist */}
              {result && (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.03 }}
                  type="button"
                  onClick={() => handleSaveItems()}
                  disabled={getSelectedTotalCount() === 0}
                  className="inline-flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-40 theme-btn-primary flex-shrink-0 min-h-[36px]"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>一键归档 ({getSelectedTotalCount()})</span>
                </motion.button>
              )}
            </div>
          </div>

          {/* Top Source Ingestion & Target Project Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Text Input & Ingestion */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-5 sm:p-6 rounded-3xl glass-card shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <FileText className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                    <span>剧本文案源文本</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {/* Document Selector */}
                    {documents.length > 0 && (
                      <select
                        value={selectedDocId}
                        onChange={(e) => handleSelectDoc(e.target.value)}
                        className="px-3 py-1.5 rounded-xl glass-input text-xs font-medium max-w-[160px] sm:max-w-[200px] truncate min-h-[36px]"
                      >
                        <option value="">-- 从资料库载入 --</option>
                        {documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Direct File Upload */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".txt,.md,.pdf,.doc,.docx,.json,.csv"
                      className="hidden"
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isParsingFile}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:opacity-90 min-h-[36px]"
                      style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                    >
                      <Upload className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                      <span>{isParsingFile ? '解析中...' : '导入文件'}</span>
                    </motion.button>
                  </div>
                </div>

                <textarea
                  rows={9}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="在此粘贴小说章节、游戏剧本、任务流程、分镜大纲、音美需求标签（如 [BGM]/[SFX]）或道具文案包装。系统将一次性自动多维识别..."
                  className="w-full px-4 py-3 rounded-2xl glass-input text-xs font-serif leading-relaxed resize-none focus:outline-none focus:ring-2 shadow-inner"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center space-x-3 text-[11px] opacity-70 font-mono">
                    <span>字符数: {rawText.length}</span>
                    <span className="hidden sm:inline">支持: TXT/MD/PDF/DOC/DOCX/JSON/CSV</span>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ scale: 1.02 }}
                    id="lab-start-extract-btn"
                    onClick={handleRunExtraction}
                    disabled={isProcessing || !rawText.trim()}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-full font-bold text-xs shadow-lg transition-all disabled:opacity-50 theme-btn-primary min-h-[42px]"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{progressMsg || '深度解析中...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>开始多维结构化解析</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Right: Project Assignment Controls */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 sm:p-6 rounded-3xl glass-card shadow-sm space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <FolderOpen className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                  <h3 className="font-bold text-xs uppercase tracking-wider font-mono" style={{ color: 'var(--text-primary)' }}>
                    解析归属工程配置
                  </h3>
                </div>

                {/* Target Mode Selector with Spring Sliding Pill */}
                <div
                  className="relative grid grid-cols-2 p-1 rounded-2xl border shadow-inner overflow-hidden"
                  style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  <button
                    type="button"
                    onClick={() => setProjectTargetMode('existing')}
                    className={`relative z-10 flex items-center justify-center space-x-1.5 p-2.5 rounded-xl text-xs font-bold transition-colors min-h-[38px] ${
                      projectTargetMode === 'existing'
                        ? 'text-white'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {projectTargetMode === 'existing' && (
                      <motion.div
                        layoutId="lab-target-mode-pill"
                        className="absolute inset-0 rounded-xl theme-btn-primary -z-10 shadow-sm"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>保存到已有项目</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectTargetMode('new')}
                    className={`relative z-10 flex items-center justify-center space-x-1.5 p-2.5 rounded-xl text-xs font-bold transition-colors min-h-[38px] ${
                      projectTargetMode === 'new'
                        ? 'text-white'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {projectTargetMode === 'new' && (
                      <motion.div
                        layoutId="lab-target-mode-pill"
                        className="absolute inset-0 rounded-xl theme-btn-primary -z-10 shadow-sm"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>新建项目</span>
                  </button>
                </div>

                {projectTargetMode === 'existing' ? (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold block opacity-80">选择目标工程：</label>
                    <select
                      value={targetProjectId}
                      onChange={(e) => setTargetProjectId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl glass-input text-xs font-medium"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.id === activeProjectId ? ' (当前)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] opacity-60">
                      所有确认保存的实体、文案与分镜将自动关联至所选工程。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold block opacity-80 mb-1">新项目名称：</label>
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="例如：主线剧本第一幕"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold block opacity-80 mb-1">项目简介/世界观概述：</label>
                      <input
                        type="text"
                        value={newProjectDesc}
                        onChange={(e) => setNewProjectDesc(e.target.value)}
                        placeholder="关于该项目的设定与背景说明"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold block opacity-80 mb-1">项目类型：</label>
                      <select
                        value={newProjectType}
                        onChange={(e) => setNewProjectType(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
                      >
                        <option value="game_script">游戏叙事剧本 (Game Script)</option>
                        <option value="novel">长篇小说 / 设定 (Novel)</option>
                        <option value="worldbuilding">世界观总集 (Worldbuilding)</option>
                        <option value="interactive_fiction">互动小说 / 抉择树 (Interactive Fiction)</option>
                      </select>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="text-xs">
                      <span className="opacity-70">已选候选项: </span>
                      <span className="font-bold font-mono" style={{ color: 'var(--theme-primary)' }}>
                        {getSelectedTotalCount()} / {getTotalRecognizedCount()}
                      </span>
                    </div>

                    <button
                      id="lab-save-all-btn"
                      onClick={() => handleSaveItems()}
                      disabled={getSelectedTotalCount() === 0}
                      className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 theme-btn-primary"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>全部确认保存</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom: Recognition Result Preview Area */}
          <LabWorkflowContext.Provider value={{ workflowMode, density: viewDensity }}>
            <div className="p-6 rounded-3xl glass-card shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider font-mono" style={{ color: 'var(--text-primary)' }}>
                    识别结果预览 (Recognition Result Preview)
                  </h3>
                  <p className="text-[11px] opacity-70">
                    解析结果已进入暂存预览，不会自动写入数据库。您可在此逐项查阅、编辑、勾选或取消后再执行入库。
                  </p>
                </div>
              </div>

              {result && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setResult(null);
                      showToast('已清空识别结果', 'info');
                    }}
                    className="px-3 py-1.5 rounded-xl border text-xs font-bold opacity-70 hover:opacity-100 transition-all"
                    style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                  >
                    清空结果
                  </button>
                  <button
                    onClick={() => handleSaveItems()}
                    disabled={getSelectedTotalCount() === 0}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 theme-btn-primary"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>保存所选 ({getSelectedTotalCount()})</span>
                  </button>
                </div>
              )}
            </div>

            {!result ? (
              <div className="py-20 text-center opacity-50 space-y-2">
                <FlaskConical className="w-12 h-12 mx-auto opacity-40" />
                <p className="text-xs font-bold">暂无待预览的识别结果</p>
                <p className="text-[11px] max-w-sm mx-auto">
                  请在上方输入剧本或文案文本，点击「开始多维结构化解析」后，提取结果将在此处分门别类列出。
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Story Summary Card */}
                {result.summary && (
                  <div className="p-4 rounded-2xl border flex flex-col md:flex-row items-start justify-between gap-4" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
                    <div className="space-y-1">
                      <span className="text-[10px] opacity-60 font-mono font-bold block">故事梗概与核心要旨</span>
                      <p className="text-xs font-serif leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {result.summary}
                      </p>
                    </div>
                    {result.keywords && result.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {result.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold"
                            style={{
                              background: 'var(--theme-secondary-bg)',
                              color: 'var(--theme-secondary-text)',
                              borderColor: 'var(--theme-secondary-border)',
                            }}
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Category Filter Chips Carousel on Mobile & Desktop with Spring Sliding Pill */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5 -mx-1 sm:mx-0">
                  {categoryDefs.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = previewCategory === cat.id;
                    return (
                      <motion.button
                        key={cat.id}
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.03 }}
                        type="button"
                        onClick={() => setPreviewCategory(cat.id)}
                        className={`relative z-10 whitespace-nowrap flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex-shrink-0 min-h-[36px] ${
                          isActive
                            ? 'text-white border-transparent'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={!isActive ? { background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' } : undefined}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="lab-category-filter-pill"
                            className="absolute inset-0 rounded-xl theme-btn-primary -z-10 shadow-sm"
                            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                          />
                        )}
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                        <span className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-black/10 dark:bg-white/10'}`}>
                          {cat.count}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Render Each Category Section */}
                <div className="space-y-6 text-xs">
                  {/* 1. Characters */}
                  {(previewCategory === 'all' || previewCategory === 'characters') && result.characters && result.characters.length > 0 && (
                    <CategorySection
                      title="角色设定"
                      categoryKey="characters"
                      count={result.characters.length}
                      icon={Users}
                      selectedCount={Object.values(selectedItems.characters).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('characters', checked)}
                      onSaveCategory={() => handleSaveItems('characters')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {result.characters.map((c, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.characters[idx]}
                            onToggle={() => handleToggleItem('characters', idx)}
                            onEdit={() => setEditingItem({ category: 'characters', index: idx, data: { ...c } })}
                            onDelete={() => handleDeletePreviewItem('characters', idx)}
                            onSaveSingle={() => handleSaveItems('characters', { category: 'characters', index: idx })}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                                {c.identity && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border font-bold" style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-secondary-text)', borderColor: 'var(--theme-secondary-border)' }}>
                                    {c.identity}
                                  </span>
                                )}
                              </div>
                              {c.personality && <p className="text-[11px] opacity-80"><strong>性格:</strong> {c.personality}</p>}
                              {c.goals && <p className="text-[11px] opacity-80"><strong>动机:</strong> {c.goals}</p>}
                              {c.bio && <p className="text-[11px] opacity-70 line-clamp-2">{c.bio}</p>}
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 2. Quests */}
                  {(previewCategory === 'all' || previewCategory === 'quests') && result.quests && result.quests.length > 0 && (
                    <CategorySection
                      title="任务与剧情线"
                      categoryKey="quests"
                      count={result.quests.length}
                      icon={Compass}
                      selectedCount={Object.values(selectedItems.quests).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('quests', checked)}
                      onSaveCategory={() => handleSaveItems('quests')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {result.quests.map((q, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.quests[idx]}
                            onToggle={() => handleToggleItem('quests', idx)}
                            onEdit={() => setEditingItem({ category: 'quests', index: idx, data: { ...q } })}
                            onDelete={() => handleDeletePreviewItem('quests', idx)}
                            onSaveSingle={() => handleSaveItems('quests', { category: 'quests', index: idx })}
                          >
                            <div className="space-y-1.5">
                              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{q.name}</span>
                              <p className="text-[11px] opacity-80 leading-relaxed">{q.description}</p>
                              {q.objectives && q.objectives.length > 0 && (
                                <div className="space-y-0.5 pt-1">
                                  <span className="text-[10px] opacity-60 font-mono font-bold">任务目标：</span>
                                  <ul className="list-disc list-inside text-[11px] opacity-80">
                                    {q.objectives.map((obj, oIdx) => (
                                      <li key={oIdx}>{obj}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 3. Quest Steps */}
                  {(previewCategory === 'all' || previewCategory === 'questSteps') && result.questSteps && result.questSteps.length > 0 && (
                    <CategorySection
                      title="任务步骤 (剧情节点)"
                      categoryKey="questSteps"
                      count={result.questSteps.length}
                      icon={Layers}
                      selectedCount={Object.values(selectedItems.questSteps).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('questSteps', checked)}
                      onSaveCategory={() => handleSaveItems('questSteps')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {result.questSteps.map((step, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.questSteps[idx]}
                            onToggle={() => handleToggleItem('questSteps', idx)}
                            onEdit={() => setEditingItem({ category: 'questSteps', index: idx, data: { ...step } })}
                            onDelete={() => handleDeletePreviewItem('questSteps', idx)}
                            onSaveSingle={() => handleSaveItems('questSteps', { category: 'questSteps', index: idx })}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{step.title}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded border uppercase" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                                  {step.stepType || 'normal'}
                                </span>
                              </div>
                              <p className="text-[11px] opacity-80">{step.summary}</p>
                              {step.location && <p className="text-[10px] opacity-60">📍 发生地点: {step.location}</p>}
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 4. Quest Connections */}
                  {(previewCategory === 'all' || previewCategory === 'questConnections') && result.questConnections && result.questConnections.length > 0 && (
                    <CategorySection
                      title="剧情流向与分支连线"
                      categoryKey="questConnections"
                      count={result.questConnections.length}
                      icon={ArrowRight}
                      selectedCount={Object.values(selectedItems.questConnections).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('questConnections', checked)}
                      onSaveCategory={() => handleSaveItems('questConnections')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {result.questConnections.map((conn, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.questConnections[idx]}
                            onToggle={() => handleToggleItem('questConnections', idx)}
                            onEdit={() => setEditingItem({ category: 'questConnections', index: idx, data: { ...conn } })}
                            onDelete={() => handleDeletePreviewItem('questConnections', idx)}
                            onSaveSingle={() => handleSaveItems('questConnections', { category: 'questConnections', index: idx })}
                          >
                            <div className="space-y-1 font-mono text-[11px]">
                              <div className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--text-primary)' }}>
                                <span>{conn.fromStepId || '起点'}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{conn.toStepId || '终点'}</span>
                              </div>
                              <div className="text-[10px] opacity-75">
                                <span className="font-bold">类型:</span> {conn.type} {conn.label ? `· ${conn.label}` : ''}
                              </div>
                              {conn.condition && <div className="text-[10px] opacity-60">条件: {conn.condition}</div>}
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 5. Narrative Copy */}
                  {(previewCategory === 'all' || previewCategory === 'narrativeCopy') && result.narrativeCopy && result.narrativeCopy.length > 0 && (
                    <CategorySection
                      title="文本包装 / Narrative Copy"
                      categoryKey="narrativeCopy"
                      count={result.narrativeCopy.length}
                      icon={FileText}
                      selectedCount={Object.values(selectedItems.narrativeCopy).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('narrativeCopy', checked)}
                      onSaveCategory={() => handleSaveItems('narrativeCopy')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {result.narrativeCopy.map((copy, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.narrativeCopy[idx]}
                            onToggle={() => handleToggleItem('narrativeCopy', idx)}
                            onEdit={() => setEditingItem({ category: 'narrativeCopy', index: idx, data: { ...copy } })}
                            onDelete={() => handleDeletePreviewItem('narrativeCopy', idx)}
                            onSaveSingle={() => handleSaveItems('narrativeCopy', { category: 'narrativeCopy', index: idx })}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{copy.title}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded border font-bold flex items-center gap-1" style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-secondary-text)', borderColor: 'var(--theme-secondary-border)' }}>
                                  <span>
                                    {copy.type === 'voice_interactive' ? '🎙️ 语音/点击对话' :
                                     copy.type === 'pv_trailer' ? '🎬 PV文案' :
                                     copy.type === 'item_lore' ? '🗡️ 道具包装' :
                                     copy.type === 'letter' ? '✉️ 游戏书信' :
                                     copy.type === 'announcement' ? '📢 游戏公告' :
                                     copy.type === 'mail' ? '📬 游戏邮件' :
                                     copy.type === 'document' ? '📁 游戏文档' :
                                     copy.type === 'tutorial' ? '💡 教学引导' :
                                     copy.type === 'ui_copy' ? '🖥️ UI文案' :
                                     copy.type === 'loading_tip' ? '⏳ 加载提示' :
                                     copy.type === 'dialogue' ? '💬 对白包装' :
                                     copy.type === 'world_lore' ? '📜 世界观' :
                                     copy.type === 'atmosphere' ? '✨ 氛围散文' :
                                     copy.type || '📝 包装文本'}
                                  </span>
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl border bg-black/5 dark:bg-white/5 font-serif text-[11px] leading-relaxed whitespace-pre-wrap">
                                {copy.content}
                              </div>
                              {copy.flavorText && (
                                <p className="text-[10px] opacity-75 italic">说明: {copy.flavorText}</p>
                              )}
                              {copy.tags && copy.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {copy.tags.map((tg, tIdx) => (
                                    <span key={tIdx} className="text-[9px] px-1.5 py-0.5 rounded bg-black/10 font-mono">
                                      #{tg}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 6. Storyboards */}
                  {(previewCategory === 'all' || previewCategory === 'storyboards') && result.storyboards && result.storyboards.length > 0 && (
                    <CategorySection
                      title="分镜脚本 / Storyboard"
                      categoryKey="storyboards"
                      count={result.storyboards.length}
                      icon={Film}
                      selectedCount={Object.values(selectedItems.storyboards).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('storyboards', checked)}
                      onSaveCategory={() => handleSaveItems('storyboards')}
                    >
                      <div className="space-y-4">
                        {result.storyboards.map((sb, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.storyboards[idx]}
                            onToggle={() => handleToggleItem('storyboards', idx)}
                            onEdit={() => setEditingItem({ category: 'storyboards', index: idx, data: { ...sb } })}
                            onDelete={() => handleDeletePreviewItem('storyboards', idx)}
                            onSaveSingle={() => handleSaveItems('storyboards', { category: 'storyboards', index: idx })}
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{sb.title}</span>
                                <span className="text-[10px] font-mono opacity-70">
                                  {sb.rows?.length || 0} 个镜头行 · {sb.columns?.length || 0} 动态列
                                </span>
                              </div>
                              {sb.description && <p className="text-[11px] opacity-75">{sb.description}</p>}

                              {/* Storyboard Table Preview */}
                              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
                                <table className="w-full text-left text-[11px]">
                                  <thead className="border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                                    <tr>
                                      {(sb.columns || []).map((col) => (
                                        <th key={col.id} className="p-2 font-bold font-mono">
                                          {col.label}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(sb.rows || []).map((row, rIdx) => (
                                      <tr key={rIdx} className="border-b last:border-0 hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: 'var(--border-subtle)' }}>
                                        {(sb.columns || []).map((col) => (
                                          <td key={col.id} className="p-2 align-top">
                                            {row.cells?.[col.id] || (col.id === 'shotNumber' ? row.shotNumber : '-')}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 7. AV Requirements */}
                  {(previewCategory === 'all' || previewCategory === 'avRequirements') && result.avRequirements && result.avRequirements.length > 0 && (
                    <CategorySection
                      title="音美制作需求 / AV Requirements"
                      categoryKey="avRequirements"
                      count={result.avRequirements.length}
                      icon={Music}
                      selectedCount={Object.values(selectedItems.avRequirements).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('avRequirements', checked)}
                      onSaveCategory={() => handleSaveItems('avRequirements')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {result.avRequirements.map((av, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.avRequirements[idx]}
                            onToggle={() => handleToggleItem('avRequirements', idx)}
                            onEdit={() => setEditingItem({ category: 'avRequirements', index: idx, data: { ...av } })}
                            onDelete={() => handleDeletePreviewItem('avRequirements', idx)}
                            onSaveSingle={() => handleSaveItems('avRequirements', { category: 'avRequirements', index: idx })}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{av.title}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded border font-bold" style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-secondary-text)', borderColor: 'var(--theme-secondary-border)' }}>
                                  {av.type || 'SFX'}
                                </span>
                              </div>
                              <p className="text-[11px] opacity-80">{av.description}</p>
                              <div className="text-[10px] opacity-60 flex items-center gap-2">
                                <span>范围: {av.level || 'global'}</span>
                                {av.shotId && <span>镜头: {av.shotId}</span>}
                                {av.targetName && <span>步骤: {av.targetName}</span>}
                              </div>
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 8. World Lore */}
                  {(previewCategory === 'all' || previewCategory === 'lore') && result.lore && result.lore.length > 0 && (
                    <CategorySection
                      title="世界观与规则设定"
                      categoryKey="lore"
                      count={result.lore.length}
                      icon={BookOpen}
                      selectedCount={Object.values(selectedItems.lore).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('lore', checked)}
                      onSaveCategory={() => handleSaveItems('lore')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {result.lore.map((l, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.lore[idx]}
                            onToggle={() => handleToggleItem('lore', idx)}
                            onEdit={() => setEditingItem({ category: 'lore', index: idx, data: { ...l } })}
                            onDelete={() => handleDeletePreviewItem('lore', idx)}
                            onSaveSingle={() => handleSaveItems('lore', { category: 'lore', index: idx })}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{l.title}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border">{l.category || '设定'}</span>
                              </div>
                              <p className="text-[11px] opacity-80 leading-relaxed font-serif">{l.content}</p>
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 9. Locations */}
                  {(previewCategory === 'all' || previewCategory === 'locations') && result.locations && result.locations.length > 0 && (
                    <CategorySection
                      title="空间场景与地标"
                      categoryKey="locations"
                      count={result.locations.length}
                      icon={MapPin}
                      selectedCount={Object.values(selectedItems.locations).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('locations', checked)}
                      onSaveCategory={() => handleSaveItems('locations')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {result.locations.map((loc, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.locations[idx]}
                            onToggle={() => handleToggleItem('locations', idx)}
                            onEdit={() => setEditingItem({ category: 'locations', index: idx, data: { ...loc } })}
                            onDelete={() => handleDeletePreviewItem('locations', idx)}
                            onSaveSingle={() => handleSaveItems('locations', { category: 'locations', index: idx })}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{loc.name}</span>
                                <span className="text-[10px] opacity-60 font-mono">{loc.type || '空间场景'}</span>
                              </div>
                              <p className="text-[11px] opacity-75">{loc.description}</p>
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 10. Factions */}
                  {(previewCategory === 'all' || previewCategory === 'factions') && result.factions && result.factions.length > 0 && (
                    <CategorySection
                      title="势力与阵营组织"
                      categoryKey="factions"
                      count={result.factions.length}
                      icon={Shield}
                      selectedCount={Object.values(selectedItems.factions).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('factions', checked)}
                      onSaveCategory={() => handleSaveItems('factions')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {result.factions.map((fac, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.factions[idx]}
                            onToggle={() => handleToggleItem('factions', idx)}
                            onEdit={() => setEditingItem({ category: 'factions', index: idx, data: { ...fac } })}
                            onDelete={() => handleDeletePreviewItem('factions', idx)}
                            onSaveSingle={() => handleSaveItems('factions', { category: 'factions', index: idx })}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{fac.name}</span>
                                {fac.leader && <span className="text-[10px] opacity-60">领袖: {fac.leader}</span>}
                              </div>
                              <p className="text-[11px] opacity-75">{fac.description}</p>
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 11. Items */}
                  {(previewCategory === 'all' || previewCategory === 'items') && result.items && result.items.length > 0 && (
                    <CategorySection
                      title="关键道具与圣物"
                      categoryKey="items"
                      count={result.items.length}
                      icon={Package}
                      selectedCount={Object.values(selectedItems.items).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('items', checked)}
                      onSaveCategory={() => handleSaveItems('items')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {result.items.map((item, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.items[idx]}
                            onToggle={() => handleToggleItem('items', idx)}
                            onEdit={() => setEditingItem({ category: 'items', index: idx, data: { ...item } })}
                            onDelete={() => handleDeletePreviewItem('items', idx)}
                            onSaveSingle={() => handleSaveItems('items', { category: 'items', index: idx })}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                                <span className="text-[10px] opacity-60 font-mono">{item.type || '道具'}</span>
                              </div>
                              <p className="text-[11px] opacity-75">{item.description}</p>
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 12. Events */}
                  {(previewCategory === 'all' || previewCategory === 'events') && result.events && result.events.length > 0 && (
                    <CategorySection
                      title="时序事件节点"
                      categoryKey="events"
                      count={result.events.length}
                      icon={Clock}
                      selectedCount={Object.values(selectedItems.events).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('events', checked)}
                      onSaveCategory={() => handleSaveItems('events')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {result.events.map((ev, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.events[idx]}
                            onToggle={() => handleToggleItem('events', idx)}
                            onEdit={() => setEditingItem({ category: 'events', index: idx, data: { ...ev } })}
                            onDelete={() => handleDeletePreviewItem('events', idx)}
                            onSaveSingle={() => handleSaveItems('events', { category: 'events', index: idx })}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{ev.name}</span>
                                {ev.time && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border">{ev.time}</span>
                                )}
                              </div>
                              <p className="text-[11px] opacity-75">{ev.description}</p>
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 13. Themes */}
                  {(previewCategory === 'all' || previewCategory === 'themes') && result.themes && result.themes.length > 0 && (
                    <CategorySection
                      title="核心主题与意象"
                      categoryKey="themes"
                      count={result.themes.length}
                      icon={Sparkles}
                      selectedCount={Object.values(selectedItems.themes).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('themes', checked)}
                      onSaveCategory={() => handleSaveItems('themes')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {result.themes.map((th, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.themes[idx]}
                            onToggle={() => handleToggleItem('themes', idx)}
                            onEdit={() => setEditingItem({ category: 'themes', index: idx, data: { ...th } })}
                            onDelete={() => handleDeletePreviewItem('themes', idx)}
                            onSaveSingle={() => handleSaveItems('themes', { category: 'themes', index: idx })}
                          >
                            <div className="space-y-1">
                              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{th.name}</span>
                              <p className="text-[11px] opacity-75">{th.coreConcept}</p>
                              {th.motif && <p className="text-[10px] opacity-60">意象: {th.motif}</p>}
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}

                  {/* 14. Annotations */}
                  {(previewCategory === 'all' || previewCategory === 'annotations') && result.annotations && result.annotations.length > 0 && (
                    <CategorySection
                      title="叙事标注片段"
                      categoryKey="annotations"
                      count={result.annotations.length}
                      icon={Tag}
                      selectedCount={Object.values(selectedItems.annotations).filter(Boolean).length}
                      onToggleAll={(checked) => handleToggleCategoryAll('annotations', checked)}
                      onSaveCategory={() => handleSaveItems('annotations')}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {result.annotations.map((ann, idx) => (
                          <ItemCard
                            key={idx}
                            checked={!!selectedItems.annotations[idx]}
                            onToggle={() => handleToggleItem('annotations', idx)}
                            onEdit={() => setEditingItem({ category: 'annotations', index: idx, data: { ...ann } })}
                            onDelete={() => handleDeletePreviewItem('annotations', idx)}
                            onSaveSingle={() => handleSaveItems('annotations', { category: 'annotations', index: idx })}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded border font-bold" style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-secondary-text)', borderColor: 'var(--theme-secondary-border)' }}>
                                  {ann.type}
                                </span>
                              </div>
                              <p className="text-[11px] font-serif leading-relaxed italic opacity-90">"{ann.text}"</p>
                              {ann.note && <p className="text-[10px] opacity-60">注: {ann.note}</p>}
                            </div>
                          </ItemCard>
                        ))}
                      </div>
                    </CategorySection>
                  )}
                </div>
              </div>
            )}
            </div>
          </LabWorkflowContext.Provider>
        </div>
      ) : (
        /* AI Narrative Copilot Workshop */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col h-[640px] rounded-3xl glass-card shadow-sm overflow-hidden">
            {/* Chat Messages */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {chatMessages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-3xl p-4 text-xs leading-relaxed space-y-2 ${
                      m.role === 'user' ? 'theme-btn-primary shadow-md font-medium' : 'border shadow-sm'
                    }`}
                    style={m.role === 'assistant' ? { background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' } : undefined}
                  >
                    <div className="flex items-center justify-between text-[10px] opacity-70 pb-1 border-b font-mono" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>{m.role === 'user' ? '编剧作者' : 'AI 叙事架构师'}</span>
                      {m.role === 'assistant' && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(m.content);
                              showToast('已复制内容到剪贴板', 'info');
                            }}
                            className="hover:underline flex items-center gap-0.5"
                          >
                            <Copy className="w-3 h-3" />
                            <span>复制</span>
                          </button>
                          <button
                            onClick={() => handleSaveOutputAsDocument(m.content)}
                            className="hover:underline font-bold flex items-center gap-0.5"
                            style={{ color: 'var(--theme-primary)' }}
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>存为资料</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                  <div
                    className="rounded-3xl p-4 text-xs flex items-center space-x-2 border"
                    style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    <Sparkles className="w-4 h-4 animate-spin" style={{ color: 'var(--theme-primary)' }} />
                    <span>AI 正在推演剧情与对话...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center space-x-2"
              >
                <input
                  type="text"
                  placeholder="向 AI 咨询剧情大纲、设计人物冲突对白、生成支线选项..."
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-full glass-input text-xs focus:outline-none focus:ring-2 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isGenerating}
                  className="px-5 py-2.5 rounded-full font-bold text-xs shadow-md hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5 theme-btn-primary"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>发送</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Quick Prompts & Context Panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 rounded-3xl glass-card shadow-sm space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Wand2 className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                <span>一键灵感指令库</span>
              </h3>

              <div className="space-y-2">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(qp.prompt)}
                    className="w-full text-left p-3 rounded-2xl border transition-all text-xs group"
                    style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-bold block transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {qp.label}
                    </span>
                    <p className="text-[10px] opacity-60 mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {qp.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-3xl glass-card shadow-sm space-y-2 text-xs">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Users className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                <span>实时注入上下文</span>
              </h3>
              <div className="p-3 rounded-2xl space-y-1 font-mono text-[11px] border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <p>当前项目: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{activeProject?.name || '全部项目'}</span></p>
                <p>已绑定角色: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{characters.length} 位</span></p>
                <p>已记录主支线: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{quests.length} 条</span></p>
                <p>空间地标: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{locations.length} 个</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-3xl glass-card shadow-2xl space-y-4 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                <h3 className="font-bold text-sm">编辑候选条目</h3>
              </div>
              <button onClick={() => setEditingItem(null)} className="p-1 rounded-full opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              <div>
                <label className="text-[11px] font-bold block opacity-80 mb-1">名称 / 标题：</label>
                <input
                  type="text"
                  value={editingItem.data.title || editingItem.data.name || ''}
                  onChange={(e) => {
                    const key = editingItem.data.title !== undefined ? 'title' : 'name';
                    setEditingItem({
                      ...editingItem,
                      data: { ...editingItem.data, [key]: e.target.value },
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                />
              </div>

              {editingItem.data.type !== undefined && (
                <div>
                  <label className="text-[11px] font-bold block opacity-80 mb-1">类型：</label>
                  <input
                    type="text"
                    value={editingItem.data.type || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, type: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
              )}

              {editingItem.data.content !== undefined && (
                <div>
                  <label className="text-[11px] font-bold block opacity-80 mb-1">正文内容：</label>
                  <textarea
                    rows={5}
                    value={editingItem.data.content || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, content: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs leading-relaxed"
                  />
                </div>
              )}

              {editingItem.data.description !== undefined && (
                <div>
                  <label className="text-[11px] font-bold block opacity-80 mb-1">说明 / 描述：</label>
                  <textarea
                    rows={3}
                    value={editingItem.data.description || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, description: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs leading-relaxed"
                  />
                </div>
              )}

              {editingItem.data.bio !== undefined && (
                <div>
                  <label className="text-[11px] font-bold block opacity-80 mb-1">角色小传 / 生平：</label>
                  <textarea
                    rows={3}
                    value={editingItem.data.bio || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, bio: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs leading-relaxed"
                  />
                </div>
              )}

              {editingItem.data.flavorText !== undefined && (
                <div>
                  <label className="text-[11px] font-bold block opacity-80 mb-1">氛围 / 备注：</label>
                  <input
                    type="text"
                    value={editingItem.data.flavorText || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, flavorText: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl border text-xs font-bold opacity-70 hover:opacity-100"
                style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEditedItem}
                className="px-5 py-2 rounded-xl font-bold text-xs theme-btn-primary shadow-md"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Lab Workflow Context for passing workflowMode and density seamlessly
const LabWorkflowContext = React.createContext<{
  workflowMode: 'readonly' | 'smart_correction';
  density: 'comfortable' | 'compact';
}>({
  workflowMode: 'readonly',
  density: 'comfortable',
});

// Category Section Container Component
interface CategorySectionProps {
  title: string;
  categoryKey: string;
  count: number;
  icon: React.ElementType;
  selectedCount: number;
  onToggleAll: (checked: boolean) => void;
  onSaveCategory: () => void;
  workflowMode?: 'readonly' | 'smart_correction';
  children: React.ReactNode;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  title,
  count,
  icon: Icon,
  selectedCount,
  onToggleAll,
  onSaveCategory,
  workflowMode: propWorkflowMode,
  children,
}) => {
  const ctx = React.useContext(LabWorkflowContext);
  const workflowMode = propWorkflowMode || ctx.workflowMode;
  const allSelected = count > 0 && selectedCount === count;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="p-4 sm:p-5 rounded-3xl border space-y-3 glass-card shadow-sm transition-all"
      style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-primary)' }}>
            <Icon className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
            {title} ({count})
          </h4>
          <span className="text-[10px] opacity-60 font-mono">
            已勾选 {selectedCount}/{count}
          </span>
          {workflowMode === 'smart_correction' && (
            <span className="text-[9px] px-2 py-0.5 rounded-full border font-bold flex items-center gap-1" style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-secondary-text)', borderColor: 'var(--theme-secondary-border)' }}>
              <Wand2 className="w-2.5 h-2.5" /> 修正就绪
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            type="button"
            onClick={() => onToggleAll(!allSelected)}
            className="text-[10px] font-mono font-bold px-2.5 sm:px-3 py-1.5 rounded-xl border hover:opacity-90 active:scale-95 transition-all shadow-xs min-h-[32px]"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            {allSelected ? '取消全选' : '全选此类'}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            type="button"
            onClick={onSaveCategory}
            disabled={selectedCount === 0}
            className="inline-flex items-center space-x-1 px-3 sm:px-3.5 py-1.5 rounded-xl text-[10px] font-bold shadow-sm transition-all disabled:opacity-40 theme-btn-primary min-h-[32px]"
          >
            <Save className="w-3 h-3" />
            <span>保存此类 ({selectedCount})</span>
          </motion.button>
        </div>
      </div>

      {children}
    </motion.div>
  );
};

// Item Card Component for Result Preview
interface ItemCardProps {
  checked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveSingle: () => void;
  workflowMode?: 'readonly' | 'smart_correction';
  density?: 'comfortable' | 'compact';
  children: React.ReactNode;
}

const ItemCard: React.FC<ItemCardProps> = ({
  checked,
  onToggle,
  onEdit,
  onDelete,
  onSaveSingle,
  workflowMode: propWorkflowMode,
  density: propDensity,
  children,
}) => {
  const ctx = React.useContext(LabWorkflowContext);
  const workflowMode = propWorkflowMode || ctx.workflowMode;
  const density = propDensity || ctx.density;
  const isReadonly = workflowMode === 'readonly';

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      onClick={(e) => {
        if (isReadonly && (e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          onToggle();
        }
      }}
      className={`${density === 'compact' ? 'p-2.5 sm:p-3' : 'p-3.5 sm:p-4'} rounded-2xl border transition-colors duration-200 relative flex flex-col justify-between group hover:shadow-md ${
        isReadonly ? 'cursor-pointer select-none' : ''
      } ${
        checked ? 'ring-2 ring-[var(--theme-primary)]/40 shadow-sm' : 'opacity-70 hover:opacity-100'
      }`}
      style={{
        background: 'var(--bg-surface)',
        borderColor: checked ? 'var(--theme-primary)' : 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start space-x-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 cursor-pointer w-4 h-4 rounded accent-[var(--theme-primary)] transition-transform active:scale-90"
        />
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      <div
        className={`flex items-center justify-between pt-2.5 mt-2.5 border-t transition-opacity ${
          isReadonly ? 'opacity-50 group-hover:opacity-100' : 'opacity-85 group-hover:opacity-100'
        }`}
        style={{ borderColor: 'var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[9px] font-mono opacity-75">
          {isReadonly ? (
            <span className="flex items-center gap-1 text-[9px]">
              <Eye className="w-2.5 h-2.5" /> 点击卡片勾选
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-bold" style={{ color: 'var(--theme-primary)' }}>
              <Wand2 className="w-2.5 h-2.5" /> 修正模式
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onEdit}
            title="编辑候选字段"
            className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all text-[10px] font-bold flex items-center gap-0.5 min-h-[28px] ${
              !isReadonly
                ? 'border shadow-2xs'
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={!isReadonly ? { background: 'var(--theme-secondary-bg)', color: 'var(--theme-secondary-text)', borderColor: 'var(--theme-secondary-border)' } : undefined}
          >
            <Edit3 className="w-3 h-3" />
            <span>编辑</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onDelete}
            title="移除此项"
            className="px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all text-red-500 text-[10px] font-bold flex items-center gap-0.5 min-h-[28px]"
          >
            <Trash2 className="w-3 h-3" />
            <span>移除</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={onSaveSingle}
            title="单独保存此项"
            className="px-2.5 sm:px-3 py-1 rounded-xl text-[10px] font-bold flex items-center gap-0.5 transition-all theme-btn-primary shadow-xs min-h-[28px]"
          >
            <Save className="w-2.5 h-2.5" />
            <span>入库</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
