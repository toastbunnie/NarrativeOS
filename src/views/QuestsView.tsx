import React, { useState } from 'react';
import {
  Compass,
  Plus,
  Edit3,
  Trash2,
  Search,
  CheckCircle,
  GitBranch,
  ArrowRight,
  ListTodo,
  MapPin,
  Users,
  Target,
  Sparkles,
  Film,
  Music,
  Layers,
  BarChart3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Quest, QuestChoice, QuestStatus } from '../types';
import { putToStore, archiveEntity, logActivity } from '../services/db';
import { QuestFlowchart } from '../components/quests/QuestFlowchart';
import { QuestStoryboardView } from '../components/quests/QuestStoryboardView';
import { QuestAVRequirementsTab } from '../components/quests/QuestAVRequirementsTab';

export const QuestsView: React.FC = () => {
  const {
    t,
    quests,
    questSteps,
    questConnections,
    activeProjectId,
    refreshData,
    showToast,
    navigateToAnalysis,
  } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [questTab, setQuestTab] = useState<'flowchart' | 'storyboard' | 'av' | 'overview'>('flowchart');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<QuestStatus>('active');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [newObj, setNewObj] = useState('');
  const [characters, setCharacters] = useState<string[]>([]);
  const [charInput, setCharInput] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [locInput, setLocInput] = useState('');
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [choices, setChoices] = useState<QuestChoice[]>([]);
  
  // New choice form
  const [choiceDesc, setChoiceDesc] = useState('');
  const [choiceConsequence, setChoiceConsequence] = useState('');

  const currentQuest = selectedQuest || quests[0] || null;

  const currentSteps = currentQuest ? questSteps.filter((s) => s.questId === currentQuest.id) : [];
  const currentConnections = currentQuest ? questConnections.filter((c) => c.questId === currentQuest.id) : [];

  const handleOpenCreate = () => {
    setEditingQuest(null);
    setName('');
    setDescription('');
    setStatus('active');
    setObjectives([]);
    setCharacters([]);
    setLocations([]);
    setPrerequisites([]);
    setChoices([]);
    setModalOpen(true);
  };

  const handleOpenEdit = (q: Quest) => {
    setEditingQuest(q);
    setName(q.name);
    setDescription(q.description);
    setStatus(q.status);
    setObjectives(q.objectives || []);
    setCharacters(q.characters || []);
    setLocations(q.locations || []);
    setPrerequisites(q.prerequisites || []);
    setChoices(q.choices || []);
    setModalOpen(true);
  };

  const handleAddObjective = () => {
    if (!newObj.trim()) return;
    setObjectives([...objectives, newObj.trim()]);
    setNewObj('');
  };

  const handleRemoveObjective = (idx: number) => {
    setObjectives(objectives.filter((_, i) => i !== idx));
  };

  const handleAddChoice = () => {
    if (!choiceDesc.trim()) return;
    setChoices([
      ...choices,
      {
        id: 'choice_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        description: choiceDesc.trim(),
        consequence: choiceConsequence.trim(),
      },
    ]);
    setChoiceDesc('');
    setChoiceConsequence('');
  };

  const handleRemoveChoice = (idx: number) => {
    setChoices(choices.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast(t.common.requiredField, 'error');
      return;
    }

    const now = Date.now();
    const questObj: Quest = {
      id: editingQuest ? editingQuest.id : 'quest_' + now + '_' + Math.random().toString(36).slice(2, 6),
      projectId: activeProjectId || '',
      name: name.trim(),
      description: description.trim(),
      objectives,
      characters,
      locations,
      events: editingQuest?.events || [],
      prerequisites,
      choices,
      outcomes: editingQuest?.outcomes || [],
      status,
      tags: editingQuest?.tags || [],
      createdAt: editingQuest ? editingQuest.createdAt : now,
      updatedAt: now,
    };

    try {
      await putToStore('quests', questObj);
      await logActivity(editingQuest ? 'UPDATE_QUEST' : 'CREATE_QUEST', 'quest', questObj.name, activeProjectId || undefined);
      showToast(t.common.success, 'success');
      setModalOpen(false);
      setSelectedQuest(questObj);
      await refreshData();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleArchive = async (q: Quest) => {
    if (window.confirm(`确定要归档剧情线「${q.name}」吗？`)) {
      await archiveEntity('quest', q, '用户归档剧情');
      if (selectedQuest?.id === q.id) setSelectedQuest(null);
      showToast('任务已归档', 'info');
      await refreshData();
    }
  };

  const filteredQuests = quests.filter((q) => {
    const matchesSearch = q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusBadges: Record<QuestStatus, { label: string; color: string }> = {
    draft: { label: t.quests.status.draft, color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40' },
    active: { label: t.quests.status.active, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    completed: { label: t.quests.status.completed, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
    branched: { label: t.quests.status.branched, color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
  };

  return (
    <div id="quests-view-container" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Compass className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
            <span>{t.quests.title}</span>
          </h2>
          <p className="text-xs opacity-75 mt-1" style={{ color: 'var(--text-secondary)' }}>{t.quests.subtitle}</p>
        </div>

        <button
          id="quests-create-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 theme-btn-primary"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{t.quests.newQuest}</span>
        </button>
      </div>

      {/* Main Grid: Quest List & Visual Tree Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Quest Browser */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-3 rounded-xl glass-card flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                id="quests-search-input"
                type="text"
                placeholder={t.common.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg glass-input text-xs"
              />
            </div>

            <select
              id="quests-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg glass-input text-xs"
            >
              <option value="all">{t.common.all}</option>
              <option value="draft">{t.quests.status.draft}</option>
              <option value="active">{t.quests.status.active}</option>
              <option value="completed">{t.quests.status.completed}</option>
              <option value="branched">{t.quests.status.branched}</option>
            </select>
          </div>

          <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
            {filteredQuests.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-dashed" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <Compass className="w-10 h-10 opacity-40 mx-auto mb-2" />
                <p className="text-xs opacity-60">{t.common.empty}</p>
                <button
                  onClick={handleOpenCreate}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold border theme-badge-secondary"
                >
                  + {t.quests.newQuest}
                </button>
              </div>
            ) : (
              filteredQuests.map((q) => {
                const isSelected = (selectedQuest?.id || filteredQuests[0]?.id) === q.id;
                const badge = statusBadges[q.status] || statusBadges.active;
                const stepsCount = questSteps.filter((s) => s.questId === q.id).length;

                return (
                  <div
                    key={q.id}
                    id={`quest-item-${q.id}`}
                    onClick={() => setSelectedQuest(q)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between group ${
                      isSelected
                        ? 'shadow-md ring-2'
                        : 'glass-card hover:border-black/20'
                    }`}
                    style={{
                      background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                      borderColor: isSelected ? 'var(--theme-primary)' : 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-xs truncate font-display" style={{ color: 'var(--text-primary)' }}>{q.name}</h4>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <p className="text-[11px] opacity-75 line-clamp-2 mb-3 leading-relaxed font-serif" style={{ color: 'var(--text-secondary)' }}>
                      {q.description || '暂无剧情背景梗概'}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t text-[10px] font-mono opacity-70" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <span>步骤: {stepsCount} 节点</span>
                      <span>分支: {q.choices?.length || 0} 处</span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(q);
                          }}
                          className="p-1 opacity-60 hover:opacity-100 hover:text-[var(--theme-primary)]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(q);
                          }}
                          className="p-1 opacity-60 hover:opacity-100 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Quest Inspector & Multi-Mode Studio */}
        <div className="lg:col-span-8">
          {currentQuest ? (
            <div id="quest-details-panel" className="p-6 rounded-2xl glass-card space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${statusBadges[currentQuest.status]?.color}`}>
                      {statusBadges[currentQuest.status]?.label}
                    </span>
                    <h3 className="text-base font-bold font-display truncate" style={{ color: 'var(--text-primary)' }}>
                      {currentQuest.name}
                    </h3>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed font-serif" style={{ color: 'var(--text-secondary)' }}>
                    {currentQuest.description || '暂无剧情起因'}
                  </p>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={() =>
                      navigateToAnalysis({
                        entityType: 'quest',
                        entityId: currentQuest.id,
                        entityName: currentQuest.name,
                      })
                    }
                    className="px-3 py-1.5 rounded-xl border text-xs flex items-center space-x-1.5 hover:bg-black/5"
                    style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                    title="在叙事深度分析空间中审视此任务"
                  >
                    <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                    <span>叙事分析</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(currentQuest)}
                    className="px-3 py-1.5 rounded-xl border text-xs flex items-center space-x-1.5 hover:bg-black/5"
                    style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{t.quests.editQuest}</span>
                  </button>
                </div>
              </div>

              {/* Sub Navigation: Flowchart / Storyboard / AV Requirements / Overview */}
              <div className="flex items-center space-x-2 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  onClick={() => setQuestTab('flowchart')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    questTab === 'flowchart' ? 'theme-badge-primary shadow-sm' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Twine 流程图 ({currentSteps.length})</span>
                </button>

                <button
                  onClick={() => setQuestTab('storyboard')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    questTab === 'storyboard' ? 'theme-badge-primary shadow-sm' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>分镜脚本</span>
                </button>

                <button
                  onClick={() => setQuestTab('av')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    questTab === 'av' ? 'theme-badge-primary shadow-sm' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>音美需求</span>
                </button>

                <button
                  onClick={() => setQuestTab('overview')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    questTab === 'overview' ? 'theme-badge-primary shadow-sm' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>剧情大纲与分支</span>
                </button>
              </div>

              {/* Tab Views */}
              {questTab === 'flowchart' && (
                <QuestFlowchart
                  quest={currentQuest}
                  steps={currentSteps}
                  connections={currentConnections}
                  onRefresh={refreshData}
                />
              )}

              {questTab === 'storyboard' && (
                <QuestStoryboardView quest={currentQuest} onRefresh={refreshData} />
              )}

              {questTab === 'av' && (
                <QuestAVRequirementsTab
                  quest={currentQuest}
                  steps={currentSteps}
                  onRefresh={refreshData}
                />
              )}

              {questTab === 'overview' && (
                <div className="space-y-6">
                  {/* Objectives Sequence Flow */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                      <ListTodo className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                      {t.quests.objectives}
                    </span>

                    {currentQuest.objectives && currentQuest.objectives.length > 0 ? (
                      <div className="space-y-2">
                        {currentQuest.objectives.map((obj, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl border flex items-center space-x-3 text-xs"
                            style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                          >
                            <span 
                              className="w-5 h-5 rounded-full font-mono font-bold flex items-center justify-center text-[10px] flex-shrink-0"
                              style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-primary)' }}
                            >
                              {idx + 1}
                            </span>
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{obj}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic p-3 rounded-xl border opacity-60" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>暂无阶段目标</p>
                    )}
                  </div>

                  {/* Choice Points and Consequences */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                      <GitBranch className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                      {t.quests.choices}
                    </span>

                    {currentQuest.choices && currentQuest.choices.length > 0 ? (
                      <div className="space-y-3">
                        {currentQuest.choices.map((ch, idx) => (
                          <div
                            key={ch.id || idx}
                            className="p-4 rounded-xl border space-y-2 text-xs"
                            style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                          >
                            <div className="flex items-center space-x-2 font-medium" style={{ color: 'var(--theme-primary)' }}>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'var(--theme-secondary-bg)' }}>分支 #{idx + 1}</span>
                              <span>{ch.description}</span>
                            </div>
                            {ch.consequence && (
                              <div className="flex items-start space-x-2 pl-4 border-l-2 text-[11px] font-serif" style={{ borderLeftColor: 'var(--theme-primary)', color: 'var(--text-primary)' }}>
                                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--theme-primary)' }} />
                                <span>直接后果: {ch.consequence}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic p-3 rounded-xl border opacity-60" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>暂无分支抉择节点</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center rounded-2xl glass-card text-center p-6">
              <Compass className="w-12 h-12 opacity-40 mb-3" style={{ color: 'var(--theme-primary)' }} />
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>未选中任务</h3>
              <p className="text-xs opacity-60 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                从左侧选择剧情线，查看其阶段目标流程、Twine 节点流程图、分镜台本以及音美需求。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quest Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div
            className="w-full max-w-xl rounded-2xl border p-6 space-y-4 shadow-2xl my-8"
            style={{ 
              background: 'var(--bg-surface-elevated)', 
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold text-base font-display">
                {editingQuest ? t.quests.editQuest : t.quests.newQuest}
              </h3>
              <button onClick={() => setModalOpen(false)} className="opacity-60 hover:opacity-100 text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-medium mb-1 opacity-90">{t.quests.name} *</label>
                  <input
                    type="text"
                    required
                    placeholder="如: 暗潮初动·密函截击战"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">状态</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as QuestStatus)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="draft">{t.quests.status.draft}</option>
                    <option value="active">{t.quests.status.active}</option>
                    <option value="completed">{t.quests.status.completed}</option>
                    <option value="branched">{t.quests.status.branched}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">{t.quests.description}</label>
                <textarea
                  rows={3}
                  placeholder="剧情背景设定与任务出发动机..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-serif leading-relaxed"
                />
              </div>

              {/* Objectives List Input */}
              <div className="space-y-2">
                <label className="block font-medium opacity-90">{t.quests.objectives}</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="阶段目标内容 (如: 前往西风之驿与探子接头)"
                    value={newObj}
                    onChange={(e) => setNewObj(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObjective())}
                    className="flex-1 px-3 py-1.5 rounded-xl glass-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddObjective}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border theme-badge-secondary"
                  >
                    {t.quests.addObjective}
                  </button>
                </div>

                {objectives.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {objectives.map((obj, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg border text-[11px]"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                      >
                        <span className="font-mono opacity-60 mr-2">#{i + 1}</span>
                        <span className="flex-1 truncate">{obj}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveObjective(i)}
                          className="opacity-50 hover:opacity-100 hover:text-rose-500"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Choices input */}
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <label className="block font-medium opacity-90">{t.quests.choices}</label>
                <div className="space-y-2 p-3 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  <input
                    type="text"
                    placeholder={t.quests.choiceDesc}
                    value={choiceDesc}
                    onChange={(e) => setChoiceDesc(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg glass-input text-xs"
                  />
                  <input
                    type="text"
                    placeholder={t.quests.consequence}
                    value={choiceConsequence}
                    onChange={(e) => setChoiceConsequence(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg glass-input text-xs"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddChoice}
                      className="px-3 py-1 rounded-lg text-xs font-bold border theme-badge-primary"
                    >
                      {t.quests.addChoice}
                    </button>
                  </div>
                </div>

                {choices.length > 0 && (
                  <div className="space-y-1.5">
                    {choices.map((ch, i) => (
                      <div
                        key={ch.id || i}
                        className="p-2 rounded-lg border text-[11px] flex items-center justify-between"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                      >
                        <div className="truncate flex-1 pr-2">
                          <span className="font-bold mr-1">分支 {i + 1}:</span>
                          <span>{ch.description}</span>
                          {ch.consequence && (
                            <span className="opacity-60 ml-2 font-serif">→ {ch.consequence}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveChoice(i)}
                          className="opacity-50 hover:opacity-100 hover:text-rose-500 flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border opacity-70 hover:opacity-100"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold shadow-md transition-all active:scale-95 theme-btn-primary"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
