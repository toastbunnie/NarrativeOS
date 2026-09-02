import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Drama,
  Plus,
  Edit3,
  Play,
  Save,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Search,
  ArrowUp,
  ArrowDown,
  Flag,
  MessageSquare,
  Type,
  Clapperboard,
  Hand,
  GitBranch,
  Circle,
  RotateCcw,
  CheckCircle,
  ListTodo,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  PerformanceScript,
  ScriptNode,
  ScriptNodeType,
  ScriptStatus,
  ScriptChoiceOption,
  Quest,
  QuestStep,
} from '../types';
import { putToStore, archiveEntity, logActivity } from '../services/db';
import { triggerAutoSyncDebounced } from '../services/feishuSync';

const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const NODE_TYPE_META: Record<ScriptNodeType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  dialogue: { label: '角色对白', icon: MessageSquare },
  narration: { label: '旁白', icon: Type },
  scene: { label: '场景描述', icon: Clapperboard },
  action: { label: '动作提示', icon: Hand },
  choice: { label: '选项', icon: ListTodo },
  branch: { label: '分支', icon: GitBranch },
  ending: { label: '结局', icon: Circle },
};

const STATUS_META: Record<ScriptStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'theme-badge' },
  review: { label: '审阅', color: 'theme-badge-primary' },
  final: { label: '定稿', color: 'theme-badge-primary' },
  archived: { label: '归档', color: 'theme-badge' },
};

type DetailSub = 'edit' | 'simulate' | 'meta';

function newNode(type: ScriptNodeType, orderIndex: number): ScriptNode {
  return {
    id: genId('node'),
    type,
    orderIndex,
  };
}

export const PerformanceScriptView: React.FC = () => {
  const {
    t,
    performanceScripts,
    quests,
    questSteps,
    activeProjectId,
    refreshData,
    showToast,
  } = useApp();

  const [search, setSearch] = useState('');
  const [questFilter, setQuestFilter] = useState('all');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [detailSub, setDetailSub] = useState<DetailSub>('edit');
  const [creating, setCreating] = useState(false);

  // New script form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formQuestId, setFormQuestId] = useState('');

  // Edit state (working copy)
  const [draft, setDraft] = useState<PerformanceScript | null>(null);
  const [dirty, setDirty] = useState(false);

  const projectScripts = useMemo(() => {
    return performanceScripts
      .filter((s) => !activeProjectId || s.projectId === activeProjectId)
      .filter((s) => (questFilter === 'all' ? true : s.questId === questFilter))
      .filter((s) =>
        !search ? true :
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [performanceScripts, activeProjectId, search, questFilter]);

  const projectQuests = useMemo(
    () => quests.filter((q) => !activeProjectId || q.projectId === activeProjectId).sort((a, b) => b.updatedAt - a.updatedAt),
    [quests, activeProjectId]
  );

  const selectedScript = projectScripts.find((s) => s.id === selectedScriptId) || null;

  // ============ Load draft when selecting a script ============
  const openScript = (script: PerformanceScript) => {
    setDraft(JSON.parse(JSON.stringify(script)));
    setDirty(false);
    setSelectedScriptId(script.id);
    setDetailSub('edit');
  };

  const startCreate = () => {
    setCreating(true);
    setFormTitle('');
    setFormDesc('');
    setFormQuestId(projectQuests[0]?.id || '');
  };

  const cancelCreate = () => {
    setCreating(false);
  };

  const confirmCreate = async () => {
    if (!formTitle.trim()) {
      showToast('请填写剧本标题', 'error');
      return;
    }
    const now = Date.now();
    const startNode = newNode('scene', 0);
    const script: PerformanceScript = {
      id: genId('pscript'),
      projectId: activeProjectId || '',
      questId: formQuestId || undefined,
      stepIds: [],
      title: formTitle.trim(),
      description: formDesc.trim(),
      status: 'draft',
      nodes: [startNode],
      startNodeId: startNode.id,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    try {
      await putToStore('performance_scripts', script);
      await logActivity('CREATE_SCRIPT', 'performance_script', script.title, activeProjectId || undefined);
      showToast(t.common.success, 'success');
      setCreating(false);
      await refreshData();
      triggerAutoSyncDebounced();
      openScript(script);
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  // ============ Edit helpers ============
  const updateDraft = (updater: (d: PerformanceScript) => PerformanceScript) => {
    setDraft((prev) => (prev ? updater(prev) : prev));
    setDirty(true);
  };

  const updateNode = (nodeId: string, patch: Partial<ScriptNode>) => {
    updateDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    }));
  };

  const addNode = (type: ScriptNodeType) => {
    updateDraft((d) => {
      const nextOrder = d.nodes.reduce((m, n) => Math.max(m, n.orderIndex), -1) + 1;
      const node = newNode(type, nextOrder);
      return { ...d, nodes: [...d.nodes, node] };
    });
  };

  const deleteNode = (nodeId: string) => {
    updateDraft((d) => {
      const remaining = d.nodes.filter((n) => n.id !== nodeId).map((n, i) => ({ ...n, orderIndex: i }));
      const newStart = d.startNodeId === nodeId ? remaining[0]?.id : d.startNodeId;
      return { ...d, nodes: remaining, startNodeId: newStart };
    });
  };

  const moveNode = (nodeId: string, dir: -1 | 1) => {
    updateDraft((d) => {
      const sorted = [...d.nodes].sort((a, b) => a.orderIndex - b.orderIndex);
      const idx = sorted.findIndex((n) => n.id === nodeId);
      if (idx < 0) return d;
      const swap = idx + dir;
      if (swap < 0 || swap >= sorted.length) return d;
      const a = sorted[idx];
      const b = sorted[swap];
      const aOrder = a.orderIndex;
      a.orderIndex = b.orderIndex;
      b.orderIndex = aOrder;
      return { ...d, nodes: [...sorted] };
    });
  };

  const setStartNode = (nodeId: string) => {
    updateDraft((d) => ({ ...d, startNodeId: nodeId }));
  };

  const addOption = (nodeId: string) => {
    updateDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, options: [...(n.options || []), { id: genId('opt'), text: '' }] }
          : n
      ),
    }));
  };

  const updateOption = (nodeId: string, optId: string, patch: Partial<ScriptChoiceOption>) => {
    updateDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, options: (n.options || []).map((o) => (o.id === optId ? { ...o, ...patch } : o)) }
          : n
      ),
    }));
  };

  const deleteOption = (nodeId: string, optId: string) => {
    updateDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, options: (n.options || []).filter((o) => o.id !== optId) }
          : n
      ),
    }));
  };

  const saveDraft = async () => {
    if (!draft) return;
    try {
      const updated = { ...draft, updatedAt: Date.now() };
      await putToStore('performance_scripts', updated);
      await logActivity('UPDATE_SCRIPT', 'performance_script', updated.title, activeProjectId || undefined);
      showToast(t.common.success, 'success');
      setDirty(false);
      await refreshData();
      triggerAutoSyncDebounced();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleArchive = async (script: PerformanceScript) => {
    if (window.confirm(`确定要归档演出剧本「${script.title}」吗？`)) {
      try {
        await archiveEntity('performance_script', script, 'User manual archive');
        await logActivity('ARCHIVE', 'performance_script', script.title, activeProjectId || undefined);
        showToast(t.common.success, 'success');
        if (selectedScriptId === script.id) {
          setSelectedScriptId(null);
          setDraft(null);
        }
        await refreshData();
      } catch (err: any) {
        showToast(`归档失败: ${err.message}`, 'error');
      }
    }
  };

  const stepsForQuest = (questId?: string) =>
    questId ? questSteps.filter((s) => s.questId === questId) : [];

  // ============ Render ============
  if (creating) {
    return (
      <div className="p-6">
        <div className="glass-card p-6 max-w-xl mx-auto space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center theme-badge-primary">
              <Drama className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              新建演出剧本
            </h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>
                标题 (Title) *
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="剧本标题"
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>
                简介 (Description)
              </label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="剧本简介"
                rows={3}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>
                关联任务 (Quest)
              </label>
              <select
                value={formQuestId}
                onChange={(e) => setFormQuestId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">（无关联任务）</option>
                {projectQuests.map((q) => (
                  <option key={q.id} value={q.id}>{q.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button onClick={cancelCreate} className="theme-btn px-4 py-2 rounded-xl text-xs font-bold opacity-70">
              {t.common.cancel}
            </button>
            <button onClick={confirmCreate} className="theme-btn-primary px-4 py-2 rounded-xl text-xs font-bold">
              {t.common.confirm}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center theme-badge-primary">
            <Drama className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t.nav.SCRIPT}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              演出剧本 · 关联任务步骤 · 对白/旁白/场景/选项/分支/结局演出模拟
            </p>
          </div>
        </div>
        <button onClick={startCreate} className="theme-btn-primary px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5">
          <Plus className="w-3.5 h-3.5" />
          <span>新建剧本</span>
        </button>
      </div>

      {selectedScript && draft ? (
        <ScriptDetail
          script={draft}
          dirty={dirty}
          detailSub={detailSub}
          setDetailSub={setDetailSub}
          quests={projectQuests}
          stepsForQuest={stepsForQuest}
          onBack={() => { setSelectedScriptId(null); setDraft(null); }}
          onSave={saveDraft}
          onArchive={() => handleArchive(selectedScript)}
          updateDraft={updateDraft}
          updateNode={updateNode}
          addNode={addNode}
          deleteNode={deleteNode}
          moveNode={moveNode}
          setStartNode={setStartNode}
          addOption={addOption}
          updateOption={updateOption}
          deleteOption={deleteOption}
        />
      ) : (
        <ScriptList
          scripts={projectScripts}
          quests={projectQuests}
          search={search}
          setSearch={setSearch}
          questFilter={questFilter}
          setQuestFilter={setQuestFilter}
          onOpen={openScript}
          onArchive={handleArchive}
          t={t}
        />
      )}
    </div>
  );
};

// ============ Script List ============
interface ScriptListProps {
  scripts: PerformanceScript[];
  quests: Quest[];
  search: string;
  setSearch: (v: string) => void;
  questFilter: string;
  setQuestFilter: (v: string) => void;
  onOpen: (s: PerformanceScript) => void;
  onArchive: (s: PerformanceScript) => void;
  t: any;
}

const ScriptList: React.FC<ScriptListProps> = ({
  scripts, quests, search, setSearch, questFilter, setQuestFilter, onOpen, onArchive, t,
}) => {
  return (
    <div className="glass-card p-4 space-y-3">
      {/* Filters */}
      <div className="flex items-center space-x-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.common.search}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          />
        </div>
        <select
          value={questFilter}
          onChange={(e) => setQuestFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-xs"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
        >
          <option value="all">{t.common.all} 任务</option>
          {quests.map((q) => (
            <option key={q.id} value={q.id}>{q.name}</option>
          ))}
        </select>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {scripts.length} 个剧本
        </span>
      </div>

      {/* List */}
      {scripts.length === 0 ? (
        <div className="text-center py-12 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t.common.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {scripts.map((s) => {
            const quest = quests.find((q) => q.id === s.questId);
            const statusMeta = STATUS_META[s.status] || STATUS_META.draft;
            const endingCount = s.nodes.filter((n) => n.type === 'ending').length;
            const choiceCount = s.nodes.filter((n) => n.type === 'choice').length;
            return (
              <motion.div
                key={s.id}
                layout
                className="glass-card p-4 space-y-3 hover:opacity-90 transition-opacity"
              >
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onOpen(s)} className="text-left min-w-0 flex-1">
                    <div className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {s.title}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {s.description || t.common.empty}
                    </div>
                  </button>
                  <span className={`${statusMeta.color} text-xs px-2 py-0.5 rounded-full flex-shrink-0`}>
                    {statusMeta.label}
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="theme-badge text-xs">
                    {s.nodes.length} 节点
                  </span>
                  <span className="theme-badge text-xs">
                    {choiceCount} 选项
                  </span>
                  <span className="theme-badge text-xs">
                    {endingCount} 结局
                  </span>
                  {s.stepIds.length > 0 && (
                    <span className="theme-badge text-xs">
                      {s.stepIds.length} 步骤
                    </span>
                  )}
                </div>
                {quest && (
                  <div className="text-xs flex items-center space-x-1" style={{ color: 'var(--text-secondary)' }}>
                    <ListTodo className="w-3 h-3" />
                    <span className="truncate">{quest.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button onClick={() => onOpen(s)} className="theme-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1">
                    <Play className="w-3 h-3" />
                    <span>演出 / 编辑</span>
                  </button>
                  <button onClick={() => onArchive(s)} className="opacity-50 hover:opacity-100 transition-opacity p-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============ Script Detail (Edit + Simulate + Meta) ============
interface ScriptDetailProps {
  script: PerformanceScript;
  dirty: boolean;
  detailSub: DetailSub;
  setDetailSub: (s: DetailSub) => void;
  quests: Quest[];
  stepsForQuest: (questId?: string) => QuestStep[];
  onBack: () => void;
  onSave: () => void;
  onArchive: () => void;
  updateDraft: (updater: (d: PerformanceScript) => PerformanceScript) => void;
  updateNode: (id: string, patch: Partial<ScriptNode>) => void;
  addNode: (type: ScriptNodeType) => void;
  deleteNode: (id: string) => void;
  moveNode: (id: string, dir: -1 | 1) => void;
  setStartNode: (id: string) => void;
  addOption: (nodeId: string) => void;
  updateOption: (nodeId: string, optId: string, patch: Partial<ScriptChoiceOption>) => void;
  deleteOption: (nodeId: string, optId: string) => void;
}

const ScriptDetail: React.FC<ScriptDetailProps> = (props) => {
  const { script, dirty, detailSub, setDetailSub, quests, stepsForQuest, onBack, onSave, onArchive, updateDraft, updateNode, addNode, deleteNode, moveNode, setStartNode, addOption, updateOption, deleteOption } = props;
  const { t } = useApp();

  const sortedNodes = useMemo(() => [...script.nodes].sort((a, b) => a.orderIndex - b.orderIndex), [script.nodes]);
  const questSteps = stepsForQuest(script.questId);
  const quest = quests.find((q) => q.id === script.questId);

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs">
          <button onClick={onBack} className="opacity-70 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
            {t.nav.SCRIPT}
          </button>
          <ChevronRight className="w-3 h-3 opacity-40" />
          <span style={{ color: 'var(--text-primary)' }} className="font-bold">{script.title}</span>
          {dirty && <span className="theme-badge-primary text-xs px-1.5 py-0.5 rounded-full">未保存</span>}
        </div>
        <div className="flex items-center space-x-2">
          {dirty && (
            <button onClick={onSave} className="theme-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1">
              <Save className="w-3 h-3" />
              <span>{t.common.save}</span>
            </button>
          )}
          <button onClick={onArchive} className="opacity-50 hover:opacity-100 transition-opacity p-1.5">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center space-x-2 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
        {([
          { id: 'edit' as const, label: '编辑剧本', icon: Edit3 },
          { id: 'simulate' as const, label: '演出模拟', icon: Play },
          { id: 'meta' as const, label: '剧本信息', icon: Info },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDetailSub(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              detailSub === tab.id ? 'theme-badge-primary shadow-sm' : 'opacity-60 hover:opacity-100'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Sub views */}
      {detailSub === 'edit' && (
        <ScriptEditor
          script={script}
          sortedNodes={sortedNodes}
          quest={quest}
          questSteps={questSteps}
          updateDraft={updateDraft}
          updateNode={updateNode}
          addNode={addNode}
          deleteNode={deleteNode}
          moveNode={moveNode}
          setStartNode={setStartNode}
          addOption={addOption}
          updateOption={updateOption}
          deleteOption={deleteOption}
          t={t}
        />
      )}

      {detailSub === 'simulate' && (
        <ScriptSimulator script={script} sortedNodes={sortedNodes} quest={quest} />
      )}

      {detailSub === 'meta' && (
        <ScriptMeta
          script={script}
          quests={quests}
          questSteps={questSteps}
          updateDraft={updateDraft}
          t={t}
        />
      )}
    </div>
  );
};

// ============ Script Editor ============
interface ScriptEditorProps {
  script: PerformanceScript;
  sortedNodes: ScriptNode[];
  quest?: Quest;
  questSteps: QuestStep[];
  updateDraft: (updater: (d: PerformanceScript) => PerformanceScript) => void;
  updateNode: (id: string, patch: Partial<ScriptNode>) => void;
  addNode: (type: ScriptNodeType) => void;
  deleteNode: (id: string) => void;
  moveNode: (id: string, dir: -1 | 1) => void;
  setStartNode: (id: string) => void;
  addOption: (nodeId: string) => void;
  updateOption: (nodeId: string, optId: string, patch: Partial<ScriptChoiceOption>) => void;
  deleteOption: (nodeId: string, optId: string) => void;
  t: any;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({
  script, sortedNodes, quest, questSteps, updateDraft, updateNode, addNode, deleteNode, moveNode, setStartNode, addOption, updateOption, deleteOption, t,
}) => {
  const inputStyle: React.CSSProperties = { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' };

  const nodeById = (id?: string) => sortedNodes.find((n) => n.id === id);

  return (
    <div className="space-y-3">
      {/* Add node toolbar */}
      <div className="glass-card p-3">
        <div className="text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>增加节点</div>
        <div className="flex items-center flex-wrap gap-2">
          {(Object.keys(NODE_TYPE_META) as ScriptNodeType[]).map((nt) => {
            const meta = NODE_TYPE_META[nt];
            return (
              <button key={nt} onClick={() => addNode(nt)} className="theme-btn px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1">
                <meta.icon className="w-3 h-3" />
                <span>{meta.label}</span>
                <Plus className="w-2.5 h-2.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Node list */}
      <div className="space-y-2">
        {sortedNodes.map((node, idx) => {
          const meta = NODE_TYPE_META[node.type];
          const isStart = script.startNodeId === node.id;
          return (
            <div key={node.id} className="glass-card p-3 space-y-2">
              {/* Node header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="text-xs opacity-50 font-mono">#{idx}</span>
                  <meta.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{meta.label}</span>
                  {isStart && (
                    <span className="theme-badge-primary text-xs px-1.5 py-0.5 rounded-full flex items-center space-x-0.5">
                      <Flag className="w-2.5 h-2.5" />
                      <span>起点</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  <button onClick={() => moveNode(node.id, -1)} disabled={idx === 0} className="p-1 rounded opacity-60 hover:opacity-100 disabled:opacity-20">
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => moveNode(node.id, 1)} disabled={idx === sortedNodes.length - 1} className="p-1 rounded opacity-60 hover:opacity-100 disabled:opacity-20">
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  {!isStart && (
                    <button onClick={() => setStartNode(node.id)} className="p-1 rounded opacity-60 hover:opacity-100" title="设为起点">
                      <Flag className="w-3 h-3" />
                    </button>
                  )}
                  <button onClick={() => deleteNode(node.id)} className="p-1 rounded opacity-50 hover:opacity-100" title="删除">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Speaker (dialogue/action) */}
              {(node.type === 'dialogue' || node.type === 'action') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs opacity-60 block mb-1">角色 (Speaker)</label>
                    <input
                      type="text"
                      value={node.speaker || ''}
                      onChange={(e) => updateNode(node.id, { speaker: e.target.value })}
                      placeholder="角色名"
                      className="w-full px-2 py-1.5 rounded-lg text-xs"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs opacity-60 block mb-1">展示位置 (Side)</label>
                    <select
                      value={node.side || ''}
                      onChange={(e) => updateNode(node.id, { side: (e.target.value || undefined) as any })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs"
                      style={inputStyle}
                    >
                      <option value="">自动</option>
                      <option value="left">左 (Left)</option>
                      <option value="right">右 (Right)</option>
                      <option value="center">中 (Center)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Text (dialogue/narration/scene/action) */}
              {(node.type === 'dialogue' || node.type === 'narration' || node.type === 'scene' || node.type === 'action') && (
                <div>
                  <label className="text-xs opacity-60 block mb-1">
                    {node.type === 'dialogue' ? '对白' : node.type === 'narration' ? '旁白文本' : node.type === 'scene' ? '场景描述' : '动作提示'}
                  </label>
                  <textarea
                    value={node.text || ''}
                    onChange={(e) => updateNode(node.id, { text: e.target.value })}
                    placeholder="输入文本..."
                    rows={node.type === 'scene' ? 2 : 3}
                    className="w-full px-2 py-1.5 rounded-lg text-xs"
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Cue / Note (scene/action) */}
              {(node.type === 'scene' || node.type === 'action') && (
                <div>
                  <label className="text-xs opacity-60 block mb-1">演出提示 (Cue / Note)</label>
                  <input
                    type="text"
                    value={node.meta?.cue || ''}
                    onChange={(e) => updateNode(node.id, { meta: { ...node.meta, cue: e.target.value } })}
                    placeholder="演出提示..."
                    className="w-full px-2 py-1.5 rounded-lg text-xs"
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Choice: options */}
              {node.type === 'choice' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>选项列表 (Options)</label>
                    <button onClick={() => addOption(node.id)} className="theme-btn px-2 py-1 rounded-lg text-xs font-bold flex items-center space-x-1">
                      <Plus className="w-2.5 h-2.5" />
                      <span>添加选项</span>
                    </button>
                  </div>
                  {(node.options || []).map((opt, oi) => (
                    <div key={opt.id} className="rounded-lg p-2 space-y-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-50 font-mono">选项 {oi + 1}</span>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => updateOption(node.id, opt.id, { text: e.target.value })}
                          placeholder="选项文本"
                          className="flex-1 px-2 py-1 rounded text-xs"
                          style={inputStyle}
                        />
                        <button onClick={() => deleteOption(node.id, opt.id)} className="p-1 opacity-50 hover:opacity-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs opacity-60 block mb-0.5">分支目标节点</label>
                          <select
                            value={opt.targetNodeId || ''}
                            onChange={(e) => updateOption(node.id, opt.id, { targetNodeId: e.target.value || undefined })}
                            className="w-full px-2 py-1 rounded text-xs"
                            style={inputStyle}
                          >
                            <option value="">（无）</option>
                            {sortedNodes.filter((n) => n.id !== node.id).map((n) => {
                              const nm = NODE_TYPE_META[n.type];
                              return <option key={n.id} value={n.id}>#{n.orderIndex} {nm.label}{n.speaker ? ` · ${n.speaker}` : ''}</option>;
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs opacity-60 block mb-0.5">跳转任务步骤</label>
                          <select
                            value={opt.targetStepId || ''}
                            onChange={(e) => updateOption(node.id, opt.id, { targetStepId: e.target.value || undefined })}
                            className="w-full px-2 py-1 rounded text-xs"
                            style={inputStyle}
                          >
                            <option value="">（无）</option>
                            {questSteps.map((st) => (
                              <option key={st.id} value={st.id}>{st.title}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs opacity-60 block mb-0.5">结局标签</label>
                          <input
                            type="text"
                            value={opt.endingLabel || ''}
                            onChange={(e) => updateOption(node.id, opt.id, { endingLabel: e.target.value || undefined })}
                            placeholder="如：真结局"
                            className="w-full px-2 py-1 rounded text-xs"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label className="text-xs opacity-60 block mb-0.5">条件</label>
                          <input
                            type="text"
                            value={opt.condition || ''}
                            onChange={(e) => updateOption(node.id, opt.id, { condition: e.target.value || undefined })}
                            placeholder="分支条件"
                            className="w-full px-2 py-1 rounded text-xs"
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(node.options || []).length === 0 && (
                    <div className="text-xs text-center py-2 opacity-50">暂无选项，点击「添加选项」</div>
                  )}
                </div>
              )}

              {/* Branch: target */}
              {node.type === 'branch' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs opacity-60 block mb-1">分支目标节点</label>
                    <select
                      value={node.targetNodeId || ''}
                      onChange={(e) => updateNode(node.id, { targetNodeId: e.target.value || undefined })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs"
                      style={inputStyle}
                    >
                      <option value="">（无）</option>
                      {sortedNodes.filter((n) => n.id !== node.id).map((n) => {
                        const nm = NODE_TYPE_META[n.type];
                        return <option key={n.id} value={n.id}>#{n.orderIndex} {nm.label}{n.speaker ? ` · ${n.speaker}` : ''}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 block mb-1">分支条件</label>
                    <input
                      type="text"
                      value={node.condition || ''}
                      onChange={(e) => updateNode(node.id, { condition: e.target.value })}
                      placeholder="分支条件"
                      className="w-full px-2 py-1.5 rounded-lg text-xs"
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {/* Ending */}
              {node.type === 'ending' && (
                <div>
                  <label className="text-xs opacity-60 block mb-1">结局标签 (Ending Label)</label>
                  <input
                    type="text"
                    value={node.endingLabel || ''}
                    onChange={(e) => updateNode(node.id, { endingLabel: e.target.value })}
                    placeholder="如：真结局 / 普通结局 / 坏结局"
                    className="w-full px-2 py-1.5 rounded-lg text-xs"
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Cross-links: targetStepId / targetScriptId (for branch/ending/choice option - show on node for branch) */}
              {(node.type === 'branch' || node.type === 'ending') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs opacity-60 block mb-1">跳转任务步骤</label>
                    <select
                      value={node.targetStepId || ''}
                      onChange={(e) => updateNode(node.id, { targetStepId: e.target.value || undefined })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs"
                      style={inputStyle}
                    >
                      <option value="">（无）</option>
                      {questSteps.map((st) => (
                        <option key={st.id} value={st.id}>{st.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs opacity-60 block mb-1">跳转其他剧本</label>
                    <input
                      type="text"
                      value={node.targetScriptId || ''}
                      onChange={(e) => updateNode(node.id, { targetScriptId: e.target.value || undefined })}
                      placeholder="剧本 ID"
                      className="w-full px-2 py-1.5 rounded-lg text-xs"
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============ Script Simulator (演出模拟) ============
interface ScriptSimulatorProps {
  script: PerformanceScript;
  sortedNodes: ScriptNode[];
  quest?: Quest;
}

const ScriptSimulator: React.FC<ScriptSimulatorProps> = ({ script, sortedNodes }) => {
  const startId = script.startNodeId || sortedNodes[0]?.id;
  const [currentId, setCurrentId] = useState<string | null>(startId || null);
  const [visited, setVisited] = useState<string[]>(startId ? [startId] : []);
  const [ended, setEnded] = useState(false);
  const [endingLabel, setEndingLabel] = useState<string>('');

  const currentNode = sortedNodes.find((n) => n.id === currentId) || null;

  // Track speaker side alternation
  const [lastSide, setLastSide] = useState<'left' | 'right' | null>(null);

  const nextByOrder = (fromId: string): ScriptNode | undefined => {
    const idx = sortedNodes.findIndex((n) => n.id === fromId);
    if (idx < 0) return undefined;
    return sortedNodes[idx + 1];
  };

  const goToNode = (id: string | undefined) => {
    if (!id) return;
    setCurrentId(id);
    setVisited((prev) => prev.includes(id) ? prev : [...prev, id]);
  };

  const handleContinue = () => {
    if (!currentNode) return;
    // Explicit target first (for branch)
    if (currentNode.targetNodeId) {
      goToNode(currentNode.targetNodeId);
      return;
    }
    const next = nextByOrder(currentNode.id);
    if (next) {
      goToNode(next.id);
    } else {
      setEnded(true);
      setEndingLabel('');
    }
  };

  const handleChoice = (opt: ScriptChoiceOption) => {
    if (opt.endingLabel) {
      setEnded(true);
      setEndingLabel(opt.endingLabel);
      // If there's also a target, still mark ended but don't navigate
      if (opt.targetNodeId) {
        setVisited((prev) => prev.includes(opt.targetNodeId!) ? prev : [...prev, opt.targetNodeId!]);
      }
      return;
    }
    if (opt.targetNodeId) {
      goToNode(opt.targetNodeId);
      return;
    }
    // No target: advance by order
    handleContinue();
  };

  const restart = () => {
    setCurrentId(startId || null);
    setVisited(startId ? [startId] : []);
    setEnded(false);
    setEndingLabel('');
    setLastSide(null);
  };

  // Render all visited nodes up to current (so user sees the conversation flow)
  const visibleNodes = sortedNodes.filter((n) => visited.includes(n.id));
  // Only show up to and including current node
  const currentIdx = currentNode ? visibleNodes.findIndex((n) => n.id === currentNode.id) : -1;
  const shownNodes = currentIdx >= 0 ? visibleNodes.slice(0, currentIdx + 1) : visibleNodes;

  // Compute side for each dialogue node (alternation)
  let sideTracker: 'left' | 'right' | null = null;
  const sideForNode = (node: ScriptNode): 'left' | 'right' | 'center' => {
    if (node.type === 'narration') return 'center';
    if (node.side) return node.side;
    if (node.type === 'scene' || node.type === 'action') return 'center';
    // dialogue: alternate
    if (node.type === 'dialogue') {
      const next = sideTracker === 'left' ? 'right' : 'left';
      sideTracker = next;
      return next;
    }
    return 'center';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {ended ? '演出已结束' : `当前节点 #${currentNode?.orderIndex ?? '-'}`}
        </div>
        <button onClick={restart} className="theme-btn px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1">
          <RotateCcw className="w-3 h-3" />
          <span>重新演出</span>
        </button>
      </div>

      {/* Stage */}
      <div className="glass-card p-4 min-h-[300px] space-y-2" style={{ background: 'var(--bg-secondary)' }}>
        {shownNodes.length === 0 && !ended && (
          <div className="text-center py-12 text-xs" style={{ color: 'var(--text-secondary)' }}>
            暂无可演出节点，请先在「编辑」中添加节点
          </div>
        )}

        {shownNodes.map((node) => {
          const meta = NODE_TYPE_META[node.type];
          const side = sideForNode(node);

          if (node.type === 'narration') {
            return (
              <div key={node.id} className="flex justify-center">
                <div className="text-xs italic text-center max-w-md px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                  {node.text || '（旁白）'}
                </div>
              </div>
            );
          }

          if (node.type === 'scene') {
            return (
              <div key={node.id} className="flex justify-center">
                <div className="text-xs text-center max-w-lg px-4 py-2 rounded-xl" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px dashed var(--border-subtle)' }}>
                  <Clapperboard className="w-3 h-3 inline mr-1 opacity-60" />
                  <span className="opacity-70">场景：</span>{node.text || '（场景描述）'}
                  {node.meta?.cue && <div className="text-xs opacity-60 mt-1">提示：{node.meta.cue}</div>}
                </div>
              </div>
            );
          }

          if (node.type === 'action') {
            return (
              <div key={node.id} className="flex justify-center">
                <div className="text-xs text-center px-3 py-1.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <Hand className="w-3 h-3 inline mr-1 opacity-60" />
                  <span>{node.speaker ? `${node.speaker}：` : ''}{node.text || '（动作提示）'}</span>
                </div>
              </div>
            );
          }

          if (node.type === 'dialogue') {
            const isLeft = side === 'left';
            return (
              <div key={node.id} className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[75%] ${isLeft ? '' : 'text-right'}`}>
                  {node.speaker && (
                    <div className="text-xs opacity-60 mb-0.5 px-1" style={{ color: 'var(--text-secondary)' }}>
                      {node.speaker}
                    </div>
                  )}
                  <div className="px-3 py-2 rounded-2xl text-sm" style={{
                    background: isLeft ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                    color: isLeft ? 'var(--text-primary)' : 'var(--text-on-accent, #fff)',
                    borderTopLeftRadius: isLeft ? '4px' : undefined,
                    borderTopRightRadius: isLeft ? undefined : '4px',
                  }}>
                    {node.text || '（对白）'}
                  </div>
                </div>
              </div>
            );
          }

          if (node.type === 'choice') {
            const isCurrent = node.id === currentId && !ended;
            return (
              <div key={node.id} className="space-y-1.5">
                <div className="text-xs opacity-60 text-center" style={{ color: 'var(--text-secondary)' }}>
                  <ListTodo className="w-3 h-3 inline mr-1" />
                  选项
                </div>
                {(node.options || []).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => isCurrent && handleChoice(opt)}
                    disabled={!isCurrent}
                    className={`block w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                      isCurrent ? 'hover:opacity-90 cursor-pointer' : 'opacity-50 cursor-default'
                    }`}
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{opt.text || '（选项）'}</span>
                      {opt.endingLabel && (
                        <span className="theme-badge-primary text-xs px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {opt.endingLabel}
                        </span>
                      )}
                    </div>
                    {opt.condition && (
                      <div className="text-xs opacity-50 mt-0.5">条件：{opt.condition}</div>
                    )}
                  </button>
                ))}
                {(node.options || []).length === 0 && (
                  <div className="text-xs text-center opacity-50 py-1">（无选项）</div>
                )}
              </div>
            );
          }

          if (node.type === 'branch') {
            const target = sortedNodes.find((n) => n.id === node.targetNodeId);
            return (
              <div key={node.id} className="flex justify-center">
                <div className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  <GitBranch className="w-3 h-3 inline mr-1 opacity-60" />
                  <span>分支{node.condition ? `（${node.condition}）` : ''} → {target ? `#${target.orderIndex}` : '下一节点'}</span>
                </div>
              </div>
            );
          }

          if (node.type === 'ending') {
            return (
              <div key={node.id} className="flex justify-center">
                <div className="text-center px-6 py-4 rounded-2xl" style={{ background: 'var(--bg-tertiary)', border: '2px solid var(--accent-primary)' }}>
                  <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--accent-primary)' }} />
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {node.endingLabel || '结局'}
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* Ending banner from choice endingLabel */}
        {ended && (
          <div className="flex justify-center pt-2">
            <div className="text-center px-6 py-4 rounded-2xl" style={{ background: 'var(--bg-tertiary)', border: '2px solid var(--accent-primary)' }}>
              <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--accent-primary)' }} />
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {endingLabel || '演出结束'}
              </div>
              <button onClick={restart} className="theme-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold mt-3 flex items-center space-x-1 mx-auto">
                <RotateCcw className="w-3 h-3" />
                <span>重新演出</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Continue button for linear flow */}
      {!ended && currentNode && currentNode.type !== 'choice' && (
        <div className="flex justify-center">
          <button onClick={handleContinue} className="theme-btn-primary px-6 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5">
            <span>{currentNode.type === 'ending' ? '完成演出' : currentNode.type === 'branch' ? '继续分支' : '继续'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* If at ending node, show end */}
      {!ended && currentNode && currentNode.type === 'ending' && (
        <div className="flex justify-center">
          <button onClick={() => { setEnded(true); setEndingLabel(currentNode.endingLabel || ''); }} className="theme-btn-primary px-6 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>到达结局</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ============ Script Meta ============
interface ScriptMetaProps {
  script: PerformanceScript;
  quests: Quest[];
  questSteps: QuestStep[];
  updateDraft: (updater: (d: PerformanceScript) => PerformanceScript) => void;
  t: any;
}

const ScriptMeta: React.FC<ScriptMetaProps> = ({ script, quests, questSteps, updateDraft, t }) => {
  const inputStyle: React.CSSProperties = { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' };
  const statuses: ScriptStatus[] = ['draft', 'review', 'final', 'archived'];

  const toggleStep = (stepId: string) => {
    updateDraft((d) => {
      const has = d.stepIds.includes(stepId);
      return {
        ...d,
        stepIds: has ? d.stepIds.filter((s) => s !== stepId) : [...d.stepIds, stepId],
      };
    });
  };

  return (
    <div className="glass-card p-4 space-y-4 max-w-2xl">
      <div>
        <label className="text-xs font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>标题 (Title)</label>
        <input
          type="text"
          value={script.title}
          onChange={(e) => updateDraft((d) => ({ ...d, title: e.target.value }))}
          className="w-full px-3 py-2 rounded-xl text-sm"
          style={inputStyle}
        />
      </div>
      <div>
        <label className="text-xs font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>简介 (Description)</label>
        <textarea
          value={script.description}
          onChange={(e) => updateDraft((d) => ({ ...d, description: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 rounded-xl text-sm"
          style={inputStyle}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>状态 (Status)</label>
          <select
            value={script.status}
            onChange={(e) => updateDraft((d) => ({ ...d, status: e.target.value as ScriptStatus }))}
            className="w-full px-3 py-2 rounded-xl text-sm"
            style={inputStyle}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>关联任务 (Quest)</label>
          <select
            value={script.questId || ''}
            onChange={(e) => updateDraft((d) => ({ ...d, questId: e.target.value || undefined, stepIds: [] }))}
            className="w-full px-3 py-2 rounded-xl text-sm"
            style={inputStyle}
          >
            <option value="">（无关联任务）</option>
            {quests.map((q) => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Associated steps */}
      <div>
        <label className="text-xs font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>关联任务步骤 (Quest Steps)</label>
        {questSteps.length === 0 ? (
          <div className="text-xs opacity-50 py-2">该任务暂无步骤</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {questSteps.map((st) => {
              const selected = script.stepIds.includes(st.id);
              return (
                <button
                  key={st.id}
                  onClick={() => toggleStep(st.id)}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center space-x-2 transition-all ${
                    selected ? 'theme-badge-primary' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ border: '1px solid var(--border-subtle)' }}
                >
                  <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: selected ? 'var(--accent-primary)' : 'var(--bg-tertiary)' }}>
                    {selected && <CheckCircle className="w-3 h-3" style={{ color: 'var(--text-on-accent, #fff)' }} />}
                  </div>
                  <span className="truncate">{st.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs opacity-50 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>{t.common.createdAt}：{new Date(script.createdAt).toLocaleString()}</div>
        <div>{t.common.updatedAt}：{new Date(script.updatedAt).toLocaleString()}</div>
        <div>节点数：{script.nodes.length} · 步骤关联：{script.stepIds.length}</div>
      </div>
    </div>
  );
};
