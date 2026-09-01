import React, { useState } from 'react';
import {
  Quest,
  QuestStep,
  AVRequirement,
  AVType,
  AVLevel,
  AVStatus,
  AVPriority,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { putToStore, deleteFromStore, logActivity } from '../../services/db';
import {
  Music,
  Plus,
  Edit3,
  Trash2,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Volume2,
  Palette,
  Film,
  Sparkles,
  Search,
  Layers,
  X,
} from 'lucide-react';

interface QuestAVRequirementsTabProps {
  quest: Quest;
  steps: QuestStep[];
  onRefresh: () => void;
}

export const QuestAVRequirementsTab: React.FC<QuestAVRequirementsTabProps> = ({
  quest,
  steps,
  onRefresh,
}) => {
  const { avRequirements = [], showToast, refreshData } = useApp();

  const [levelFilter, setLevelFilter] = useState<'all' | AVLevel>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AVType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AVStatus>('all');
  const [search, setSearch] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<AVRequirement | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<AVLevel>('global');
  const [type, setType] = useState<AVType>('SFX');
  const [stepId, setStepId] = useState<string>('');
  const [shotId, setShotId] = useState<string>('');
  const [status, setStatus] = useState<AVStatus>('pending');
  const [priority, setPriority] = useState<AVPriority>('medium');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [assignee, setAssignee] = useState('');

  const questAVs = avRequirements.filter((r) => r.questId === quest.id);

  const filteredAVs = questAVs.filter((req) => {
    const matchesLevel = levelFilter === 'all' || req.level === levelFilter;
    const matchesType = typeFilter === 'all' || req.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesSearch =
      req.title.toLowerCase().includes(search.toLowerCase()) ||
      req.description?.toLowerCase().includes(search.toLowerCase()) ||
      req.assignee?.toLowerCase().includes(search.toLowerCase());
    return matchesLevel && matchesType && matchesStatus && matchesSearch;
  });

  const handleOpenCreate = () => {
    setEditingReq(null);
    setTitle('');
    setLevel('global');
    setType('SFX');
    setStepId('');
    setShotId('');
    setStatus('pending');
    setPriority('medium');
    setDescription('');
    setFormat('');
    setReferenceUrl('');
    setAssignee('');
    setModalOpen(true);
  };

  const handleOpenEdit = (req: AVRequirement) => {
    setEditingReq(req);
    setTitle(req.title);
    setLevel(req.level);
    setType(req.type);
    setStepId(req.stepId || '');
    setShotId(req.shotId || '');
    setStatus(req.status);
    setPriority(req.priority);
    setDescription(req.description || '');
    setFormat(req.format || '');
    setReferenceUrl(req.referenceUrl || '');
    setAssignee(req.assignee || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('请填写需求标题', 'error');
      return;
    }

    const now = Date.now();
    const reqObj: AVRequirement = {
      id: editingReq ? editingReq.id : `av_${now}_${Math.random().toString(36).slice(2, 6)}`,
      projectId: quest.projectId,
      questId: quest.id,
      stepId: level === 'step' ? stepId : undefined,
      shotId: level === 'shot' ? shotId : undefined,
      level,
      title: title.trim(),
      type,
      status,
      priority,
      description: description.trim(),
      format: format.trim(),
      referenceUrl: referenceUrl.trim(),
      assignee: assignee.trim(),
      tags: [],
      createdAt: editingReq ? editingReq.createdAt : now,
      updatedAt: now,
    };

    try {
      await putToStore('av_requirements', reqObj);
      await logActivity(
        editingReq ? 'UPDATE_AV_REQ' : 'CREATE_AV_REQ',
        'av_requirement',
        reqObj.title,
        quest.projectId
      );
      showToast('音美需求保存成功', 'success');
      setModalOpen(false);
      await refreshData();
      onRefresh();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (req: AVRequirement) => {
    if (window.confirm(`确定要删除音美需求「${req.title}」吗？`)) {
      try {
        await deleteFromStore('av_requirements', req.id);
        showToast('需求已删除', 'info');
        await refreshData();
        onRefresh();
      } catch (err: any) {
        showToast(`删除失败: ${err.message}`, 'error');
      }
    }
  };

  const handleQuickStatusChange = async (req: AVRequirement, newStatus: AVStatus) => {
    const updated: AVRequirement = {
      ...req,
      status: newStatus,
      updatedAt: Date.now(),
    };
    await putToStore('av_requirements', updated);
    await refreshData();
  };

  const statusBadgeMap: Record<AVStatus, { label: string; bg: string; text: string; border: string }> = {
    pending: { label: '待排期', bg: 'bg-zinc-500/10', text: 'text-zinc-500', border: 'border-zinc-500/30' },
    in_progress: { label: '制作中', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
    review: { label: '验收中', bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
    completed: { label: '已验收交付', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
    blocked: { label: '受阻阻塞', bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/30' },
  };

  const priorityBadgeMap: Record<AVPriority, { label: string; color: string }> = {
    urgent: { label: '紧急', color: 'text-rose-500 font-bold' },
    high: { label: '高优', color: 'text-orange-500 font-semibold' },
    medium: { label: '普通', color: 'text-amber-500' },
    low: { label: '低优', color: 'text-zinc-400' },
  };

  const typeIconMap: Record<AVType, React.ComponentType<{ className?: string }>> = {
    Music: Music,
    SFX: Volume2,
    Voice: Volume2,
    Art: Palette,
    VFX: Sparkles,
    Animation: Film,
    Other: Layers,
  };

  return (
    <div id="quest-av-requirements-panel" className="space-y-4 text-xs">
      {/* Top Header & Search Filters */}
      <div
        className="p-4 rounded-2xl glass-card flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <h4 className="font-bold text-xs font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Music className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
            <span>{quest.name} · 音美需求全景看板</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border theme-badge-secondary">
              共 {questAVs.length} 项需求
            </span>
          </h4>
          <p className="text-[11px] opacity-70 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            覆盖全局总需求、分镜级特定需求及步骤级触发音画。
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm theme-btn-primary flex items-center space-x-1"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>+ 提报新音美需求</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="p-3 rounded-xl glass-card flex flex-wrap items-center gap-2 text-xs">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            type="text"
            placeholder="搜索音美需求标题、描述或制作人..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg glass-input text-xs"
          />
        </div>

        {/* Level Filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as any)}
          className="px-2.5 py-1.5 rounded-lg glass-input text-xs"
        >
          <option value="all">层级: 全部</option>
          <option value="global">全局总需求 (Global)</option>
          <option value="shot">分镜关联需求 (Shot)</option>
          <option value="step">步骤触发需求 (Step)</option>
        </select>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-2.5 py-1.5 rounded-lg glass-input text-xs"
        >
          <option value="all">类型: 全部</option>
          <option value="Music">配乐 (Music)</option>
          <option value="SFX">音效 (SFX)</option>
          <option value="Voice">配音 (Voice)</option>
          <option value="Art">原画 (Art)</option>
          <option value="VFX">特效 (VFX)</option>
          <option value="Animation">动画 (Animation)</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-2.5 py-1.5 rounded-lg glass-input text-xs"
        >
          <option value="all">状态: 全部</option>
          <option value="pending">待排期</option>
          <option value="in_progress">制作中</option>
          <option value="review">验收中</option>
          <option value="completed">已验收交付</option>
          <option value="blocked">受阻</option>
        </select>
      </div>

      {/* Requirements List */}
      <div className="space-y-2.5">
        {filteredAVs.length === 0 ? (
          <div
            className="py-12 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center space-y-2"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <Music className="w-8 h-8 opacity-40" style={{ color: 'var(--theme-primary)' }} />
            <p className="text-xs opacity-60">暂无符合条件的音美需求</p>
            <button
              onClick={handleOpenCreate}
              className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold border theme-badge-secondary"
            >
              + 提报首条需求
            </button>
          </div>
        ) : (
          filteredAVs.map((req) => {
            const StatusIcon =
              req.status === 'completed'
                ? CheckCircle2
                : req.status === 'in_progress'
                ? Clock
                : req.status === 'blocked'
                ? AlertCircle
                : AlertTriangle;
            const statusInfo = statusBadgeMap[req.status] || statusBadgeMap.pending;
            const priorityInfo = priorityBadgeMap[req.priority] || priorityBadgeMap.medium;
            const TypeIcon = typeIconMap[req.type] || Music;
            const linkedStep = steps.find((s) => s.id === req.stepId);

            return (
              <div
                key={req.id}
                id={`av-req-card-${req.id}`}
                className="p-4 rounded-2xl border glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-all hover:shadow-md"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                {/* Left: Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-1">
                    <span className="p-1 rounded-lg border theme-badge-secondary flex items-center justify-center">
                      <TypeIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border opacity-80">
                      {req.type}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono border theme-badge-primary">
                      {req.level === 'global' ? '全局' : req.level === 'shot' ? `分镜 #${req.shotId}` : `步骤: ${linkedStep?.title || req.stepId}`}
                    </span>
                    <span className={`text-[10px] font-mono ${priorityInfo.color}`}>
                      [{priorityInfo.label}]
                    </span>
                    <h5 className="font-bold text-xs truncate font-display" style={{ color: 'var(--text-primary)' }}>
                      {req.title}
                    </h5>
                  </div>

                  {req.description && (
                    <p className="text-[11px] opacity-75 line-clamp-2 leading-relaxed font-serif" style={{ color: 'var(--text-secondary)' }}>
                      {req.description}
                    </p>
                  )}

                  <div className="flex items-center space-x-3 text-[10px] opacity-60 font-mono">
                    {req.format && <span>格式: {req.format}</span>}
                    {req.assignee && <span>负责人: {req.assignee}</span>}
                    {req.referenceUrl && (
                      <a href={req.referenceUrl} target="_blank" rel="noreferrer" className="underline hover:opacity-100">
                        参考资料 ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Right: Quick Status & Actions */}
                <div className="flex items-center space-x-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <select
                    value={req.status}
                    onChange={(e) => handleQuickStatusChange(req, e.target.value as AVStatus)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                  >
                    <option value="pending">待排期</option>
                    <option value="in_progress">制作中</option>
                    <option value="review">验收中</option>
                    <option value="completed">已验收交付</option>
                    <option value="blocked">受阻阻塞</option>
                  </select>

                  <button
                    onClick={() => handleOpenEdit(req)}
                    className="p-1.5 rounded-lg border hover:bg-black/5 transition-all opacity-70 hover:opacity-100"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    title="编辑需求"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(req)}
                    className="p-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-all opacity-70 hover:opacity-100"
                    title="删除需求"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* AV Requirement Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto custom-scrollbar">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl my-8 text-xs glass-modal"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center space-x-2">
                <Music className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                <h3 className="font-bold text-sm font-display">
                  {editingReq ? '编辑音美需求' : '提报新音美需求'}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block font-medium mb-1 opacity-90">需求标题 *</label>
                <input
                  type="text"
                  required
                  placeholder="如: Boss 现身登场专属交响配乐 / 拔剑金属脆响 SFX"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1 opacity-90">音美类型</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AVType)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="SFX">音效 (SFX)</option>
                    <option value="Music">配乐 (Music)</option>
                    <option value="Voice">配音 (Voice)</option>
                    <option value="Art">原画美术 (Art)</option>
                    <option value="VFX">特效 (VFX)</option>
                    <option value="Animation">动画 (Animation)</option>
                    <option value="Other">其他 (Other)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">关联层级</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as AVLevel)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="global">全局总需求 (Global)</option>
                    <option value="step">步骤触发 (Step)</option>
                    <option value="shot">分镜演出 (Shot)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">优先级</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as AVPriority)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="urgent">紧急排期 (Urgent)</option>
                    <option value="high">高优 (High)</option>
                    <option value="medium">普通 (Medium)</option>
                    <option value="low">低优 (Low)</option>
                  </select>
                </div>
              </div>

              {level === 'step' && (
                <div>
                  <label className="block font-medium mb-1 opacity-90">关联任务步骤</label>
                  <select
                    value={stepId}
                    onChange={(e) => setStepId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="">选择步骤...</option>
                    {steps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {level === 'shot' && (
                <div>
                  <label className="block font-medium mb-1 opacity-90">关联镜头编号</label>
                  <input
                    type="text"
                    placeholder="如: 镜头 #1 / Shot_04"
                    value={shotId}
                    onChange={(e) => setShotId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium mb-1 opacity-90">制作规范与细节描述</label>
                <textarea
                  rows={3}
                  placeholder="详细说明音画情绪、音色要求、时长长度、起止触发时机及参考样例..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-serif leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1 opacity-90">交付格式/码率</label>
                  <input
                    type="text"
                    placeholder="如: WAV 48kHz 24bit"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">制作负责人</label>
                  <input
                    type="text"
                    placeholder="如: 音效策划 / 外部外包"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">当前制作状态</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AVStatus)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="pending">待排期</option>
                    <option value="in_progress">制作中</option>
                    <option value="review">验收中</option>
                    <option value="completed">已验收交付</option>
                    <option value="blocked">受阻阻塞</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">参考试听 / 样片链接</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border opacity-70 hover:opacity-100"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold shadow-md theme-btn-primary"
                >
                  保存需求
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
