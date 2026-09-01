import React, { useState, useEffect } from 'react';
import { QuestStep, QuestStepType, Character, WorldLocation, AVRequirement, AVType, AVLevel, AVPriority, AVStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { putToStore, deleteFromStore, logActivity } from '../../services/db';
import {
  X,
  Sparkles,
  Layers,
  MapPin,
  Users,
  Music,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Volume2,
  Palette,
  Film,
} from 'lucide-react';

interface QuestStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  questId: string;
  projectId: string;
  step: QuestStep | null;
  allSteps: QuestStep[];
  onSaved: () => void;
}

export const QuestStepModal: React.FC<QuestStepModalProps> = ({
  isOpen,
  onClose,
  questId,
  projectId,
  step,
  allSteps,
  onSaved,
}) => {
  const { characters = [], locations = [], avRequirements = [], showToast, refreshData } = useApp();

  const [activeTab, setActiveTab] = useState<'info' | 'av'>('info');

  // Form states
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [stepType, setStepType] = useState<QuestStepType>('normal');
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [selectedLocs, setSelectedLocs] = useState<string[]>([]);
  const [condition, setCondition] = useState('');
  const [orderIndex, setOrderIndex] = useState(0);

  // Quick AV Form state
  const [newAVTitle, setNewAVTitle] = useState('');
  const [newAVType, setNewAVType] = useState<AVType>('SFX');
  const [newAVPriority, setNewAVPriority] = useState<AVPriority>('medium');
  const [newAVDesc, setNewAVDesc] = useState('');

  useEffect(() => {
    if (step) {
      setTitle(step.title || '');
      setSummary(step.summary || '');
      setStepType(step.type || 'normal');
      setSelectedChars(step.characters || []);
      setSelectedLocs(step.locations || []);
      setCondition(step.condition || '');
      setOrderIndex(step.orderIndex ?? allSteps.length);
    } else {
      setTitle('');
      setSummary('');
      setStepType('normal');
      setSelectedChars([]);
      setSelectedLocs([]);
      setCondition('');
      setOrderIndex(allSteps.length);
    }
  }, [step, allSteps.length, isOpen]);

  if (!isOpen) return null;

  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('请填写步骤标题', 'error');
      return;
    }

    const now = Date.now();
    const stepId = step ? step.id : `step_${now}_${Math.random().toString(36).slice(2, 6)}`;

    const newStep: QuestStep = {
      id: stepId,
      questId,
      projectId,
      title: title.trim(),
      summary: summary.trim(),
      type: stepType,
      orderIndex: Number(orderIndex) || 0,
      characters: selectedChars,
      locations: selectedLocs,
      condition: condition.trim(),
      position: step?.position || { x: 200, y: (allSteps.length + 1) * 160 },
      createdAt: step ? step.createdAt : now,
      updatedAt: now,
    };

    try {
      await putToStore('quest_steps', newStep);
      await logActivity(
        step ? 'UPDATE_QUEST_STEP' : 'CREATE_QUEST_STEP',
        'quest',
        `步骤: ${newStep.title}`,
        projectId
      );
      showToast('步骤保存成功', 'success');
      await refreshData();
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(`保存步骤失败: ${err.message}`, 'error');
    }
  };

  const handleDeleteStep = async () => {
    if (!step) return;
    if (window.confirm(`确定要删除步骤「${step.title}」吗？`)) {
      try {
        await deleteFromStore('quest_steps', step.id);
        showToast('步骤已删除', 'info');
        await refreshData();
        onSaved();
        onClose();
      } catch (err: any) {
        showToast(`删除步骤失败: ${err.message}`, 'error');
      }
    }
  };

  const handleAddStepAV = async () => {
    if (!step?.id) {
      showToast('请先保存步骤后再关联音美需求', 'info');
      return;
    }
    if (!newAVTitle.trim()) {
      showToast('请填写需求标题', 'error');
      return;
    }

    const now = Date.now();
    const req: AVRequirement = {
      id: `av_${now}_${Math.random().toString(36).slice(2, 6)}`,
      projectId,
      questId,
      stepId: step.id,
      level: 'step',
      title: newAVTitle.trim(),
      type: newAVType,
      status: 'pending',
      priority: newAVPriority,
      description: newAVDesc.trim(),
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    try {
      await putToStore('av_requirements', req);
      await logActivity('CREATE_AV_REQ', 'av_requirement', `[步骤级] ${req.title}`, projectId);
      showToast('音美需求已添加', 'success');
      setNewAVTitle('');
      setNewAVDesc('');
      await refreshData();
    } catch (err: any) {
      showToast(`添加需求失败: ${err.message}`, 'error');
    }
  };

  const stepAVs = step ? avRequirements.filter((r) => r.stepId === step.id) : [];

  const typeColorMap: Record<QuestStepType, { label: string; bg: string; text: string }> = {
    normal: { label: '常规推进 (Normal)', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
    start: { label: '起点 (Start)', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
    action: { label: '行动 (Action)', bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400' },
    dialogue: { label: '对白 (Dialogue)', bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-400' },
    branch: { label: '分支节点 (Branch)', bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400' },
    choice: { label: '抉择点 (Choice)', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
    puzzle: { label: '解谜 (Puzzle)', bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400' },
    battle: { label: '战斗 (Battle)', bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400' },
    climax: { label: '高潮转折 (Climax)', bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400' },
    ending: { label: '结局终局 (Ending)', bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto custom-scrollbar">
      <div
        id="quest-step-modal"
        className="w-full max-w-2xl rounded-2xl border p-6 space-y-4 shadow-2xl my-8 text-xs glass-modal"
        style={{
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
            <h3 className="font-bold text-sm font-display">
              {step ? '编辑剧情步骤 (Twine Node)' : '新建剧情步骤 (Twine Node)'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switch */}
        {step && (
          <div className="flex items-center space-x-2 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === 'info' ? 'theme-badge-primary shadow-sm' : 'opacity-60 hover:opacity-100'
              }`}
            >
              步骤核心信息
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('av')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'av' ? 'theme-badge-primary shadow-sm' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <Music className="w-3 h-3" />
              <span>步骤音美需求 ({stepAVs.length})</span>
            </button>
          </div>
        )}

        {activeTab === 'info' ? (
          <form onSubmit={handleSaveStep} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-medium mb-1 opacity-90">步骤标题 *</label>
                <input
                  type="text"
                  required
                  placeholder="如: 节点 01 · 密林伏击"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">节点类型</label>
                <select
                  value={stepType}
                  onChange={(e) => setStepType(e.target.value as QuestStepType)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                >
                  <option value="normal">常规推进 (Normal)</option>
                  <option value="branch">分支节点 (Branch)</option>
                  <option value="choice">抉择点 (Choice)</option>
                  <option value="climax">高潮转折 (Climax)</option>
                  <option value="ending">结局终局 (Ending)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1 opacity-90">剧情简介与演出动作</label>
              <textarea
                rows={4}
                placeholder="详细记录本步骤中发生的事件、对话要点、环境氛围及玩家操作反馈..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-3 py-2 rounded-xl glass-input font-serif leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Characters Multi-select */}
              <div>
                <label className="block font-medium mb-1 opacity-90 flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                  <span>登场角色</span>
                </label>
                <div className="p-2 rounded-xl border max-h-28 overflow-y-auto space-y-1" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  {characters.length === 0 ? (
                    <span className="opacity-50 italic text-[11px]">暂无角色，可在角色档案馆录入</span>
                  ) : (
                    characters.map((c) => {
                      const isChecked = selectedChars.includes(c.name);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center space-x-2 p-1 rounded hover:bg-black/5 cursor-pointer text-[11px]"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedChars([...selectedChars, c.name]);
                              } else {
                                setSelectedChars(selectedChars.filter((n) => n !== c.name));
                              }
                            }}
                            className="rounded text-pink-500"
                          />
                          <span>{c.name}</span>
                          {c.role && <span className="opacity-50 text-[9px]">({c.role})</span>}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Locations Multi-select */}
              <div>
                <label className="block font-medium mb-1 opacity-90 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                  <span>发生地点</span>
                </label>
                <div className="p-2 rounded-xl border max-h-28 overflow-y-auto space-y-1" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  {locations.length === 0 ? (
                    <span className="opacity-50 italic text-[11px]">暂无地点，可在世界观设定录入</span>
                  ) : (
                    locations.map((loc) => {
                      const isChecked = selectedLocs.includes(loc.name);
                      return (
                        <label
                          key={loc.id}
                          className="flex items-center space-x-2 p-1 rounded hover:bg-black/5 cursor-pointer text-[11px]"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLocs([...selectedLocs, loc.name]);
                              } else {
                                setSelectedLocs(selectedLocs.filter((n) => n !== loc.name));
                              }
                            }}
                            className="rounded text-pink-500"
                          />
                          <span>{loc.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1 opacity-90">触发 / 进入前置条件</label>
                <input
                  type="text"
                  placeholder="如: 好感度 >= 60 或 持有「古旧信物」"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">排序权重 Index</label>
                <input
                  type="number"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              {step ? (
                <button
                  type="button"
                  onClick={handleDeleteStep}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 flex items-center space-x-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除步骤</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border opacity-70 hover:opacity-100 hover:bg-black/5 transition-all"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold shadow-md transition-all active:scale-95 theme-btn-primary"
                >
                  保存步骤
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* AV Requirements Tab */
          <div className="space-y-4">
            <div className="p-3 rounded-xl border space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <div className="font-bold flex items-center space-x-1.5">
                <Plus className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                <span>为本步骤新增音美制作需求</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="需求标题 (如: 潜行心跳加速 SFX / 紧张弦乐)"
                    value={newAVTitle}
                    onChange={(e) => setNewAVTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg glass-input text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={newAVType}
                    onChange={(e) => setNewAVType(e.target.value as AVType)}
                    className="px-2 py-1.5 rounded-lg glass-input text-xs"
                  >
                    <option value="SFX">音效 (SFX)</option>
                    <option value="Music">配乐 (Music)</option>
                    <option value="Voice">配音 (Voice)</option>
                    <option value="Art">原画美术 (Art)</option>
                    <option value="VFX">特效 (VFX)</option>
                    <option value="Animation">动画 (Animation)</option>
                  </select>
                  <select
                    value={newAVPriority}
                    onChange={(e) => setNewAVPriority(e.target.value as AVPriority)}
                    className="px-2 py-1.5 rounded-lg glass-input text-xs"
                  >
                    <option value="medium">普通</option>
                    <option value="high">高优先</option>
                    <option value="urgent">紧急</option>
                    <option value="low">低优先</option>
                  </select>
                </div>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="详细参考需求与制作规范描述..."
                  value={newAVDesc}
                  onChange={(e) => setNewAVDesc(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg glass-input text-xs"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddStepAV}
                  className="px-4 py-1.5 rounded-lg font-bold shadow-sm theme-btn-primary flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加至步骤</span>
                </button>
              </div>
            </div>

            {/* List of step AV requirements */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {stepAVs.length === 0 ? (
                <div className="py-8 text-center opacity-50 italic">
                  本步骤暂无关联的音美需求
                </div>
              ) : (
                stepAVs.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl border flex items-center justify-between gap-2 text-xs"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono border theme-badge-secondary font-bold">
                          {req.type}
                        </span>
                        <span className="font-bold truncate">{req.title}</span>
                      </div>
                      {req.description && (
                        <p className="text-[11px] opacity-70 truncate font-serif">{req.description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono border theme-badge-primary">
                        {req.status}
                      </span>
                      <button
                        onClick={async () => {
                          await deleteFromStore('av_requirements', req.id);
                          showToast('需求已移除', 'info');
                          await refreshData();
                        }}
                        className="p-1 text-rose-500 hover:bg-rose-500/10 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
