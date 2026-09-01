import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  Layers,
  Sparkles,
  Tag,
  Users,
  MapPin,
  Compass,
  CheckCircle2,
  Clock,
  Send,
  BarChart3,
  BookOpen,
  X,
  Copy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  NarrativeCopy,
  NarrativeCopyCategory,
  NarrativeCopyStatus,
} from '../types';
import { putToStore, deleteFromStore, logActivity } from '../services/db';

export const NarrativeCopyView: React.FC = () => {
  const {
    t,
    narrativeCopy = [],
    quests = [],
    characters = [],
    locations = [],
    activeProjectId,
    refreshData,
    showToast,
    navigateToAnalysis,
  } = useApp();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | NarrativeCopyCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | NarrativeCopyStatus>('all');
  const [questFilter, setQuestFilter] = useState<string>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCopy, setEditingCopy] = useState<NarrativeCopy | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<NarrativeCopyCategory>('system_ui');
  const [content, setContent] = useState('');
  const [flavorText, setFlavorText] = useState('');
  const [status, setStatus] = useState<NarrativeCopyStatus>('draft');
  const [selectedQuestId, setSelectedQuestId] = useState<string>('');
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [selectedLocs, setSelectedLocs] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [version, setVersion] = useState('1.0');
  const [notes, setNotes] = useState('');

  const filteredCopy = narrativeCopy.filter((item) => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesQuest = questFilter === 'all' || item.questId === questFilter;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase()) ||
      item.flavorText?.toLowerCase().includes(search.toLowerCase()) ||
      item.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesStatus && matchesQuest && matchesSearch;
  });

  const handleOpenCreate = () => {
    setEditingCopy(null);
    setTitle('');
    setCategory('system_ui');
    setContent('');
    setFlavorText('');
    setStatus('draft');
    setSelectedQuestId('');
    setSelectedChars([]);
    setSelectedLocs([]);
    setTags([]);
    setVersion('1.0');
    setNotes('');
    setModalOpen(true);
  };

  const handleOpenEdit = (item: NarrativeCopy) => {
    setEditingCopy(item);
    setTitle(item.title);
    setCategory(item.category);
    setContent(item.content);
    setFlavorText(item.flavorText || '');
    setStatus(item.status);
    setSelectedQuestId(item.questId || '');
    setSelectedChars(item.characters || []);
    setSelectedLocs(item.locations || []);
    setTags(item.tags || []);
    setVersion(item.version || '1.0');
    setNotes(item.notes || '');
    setModalOpen(true);
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    if (!tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showToast('标题与文本内容为必填项', 'error');
      return;
    }

    const now = Date.now();
    const copyObj: NarrativeCopy = {
      id: editingCopy ? editingCopy.id : `copy_${now}_${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProjectId || '',
      questId: selectedQuestId || undefined,
      type: category,
      category,
      title: title.trim(),
      content: content.trim(),
      flavorText: flavorText.trim() || undefined,
      status,
      characters: selectedChars,
      locations: selectedLocs,
      tags,
      version: version.trim() || '1.0',
      wordCount: (title.trim().length + content.trim().length + (flavorText.trim().length || 0)),
      notes: notes.trim() || undefined,
      createdAt: editingCopy ? editingCopy.createdAt : now,
      updatedAt: now,
    };

    try {
      await putToStore('narrative_copy', copyObj);
      await logActivity(
        editingCopy ? 'UPDATE_COPY' : 'CREATE_COPY',
        'narrative_copy',
        copyObj.title,
        activeProjectId || undefined
      );
      showToast('文本包装词条已保存', 'success');
      setModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (item: NarrativeCopy) => {
    if (window.confirm(`确定要删除文本包装「${item.title}」吗？`)) {
      try {
        await deleteFromStore('narrative_copy', item.id);
        showToast('词条已删除', 'info');
        await refreshData();
      } catch (err: any) {
        showToast(`删除失败: ${err.message}`, 'error');
      }
    }
  };

  const handleCopyClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('文案已复制到剪贴板', 'success');
  };

  const categoryLabels: Record<NarrativeCopyCategory, { label: string; icon: string }> = {
    voice_interactive: { label: '语音 / 点击对话文本', icon: '🎙️' },
    pv_trailer: { label: 'PV / 宣发预告文案', icon: '🎬' },
    item_lore: { label: '道具 / 装备风味', icon: '🗡️' },
    letter: { label: '游戏内书信', icon: '✉️' },
    announcement: { label: '游戏公告', icon: '📢' },
    mail: { label: '游戏邮件', icon: '📬' },
    document: { label: '游戏文档', icon: '📁' },
    loading_tip: { label: '加载提示', icon: '⏳' },
    tutorial: { label: '教学引导', icon: '💡' },
    ui_copy: { label: '界面文案', icon: '🖥️' },
    system_ui: { label: '系统 UI / 提示', icon: '💻' },
    dialogue: { label: '剧本对话包装', icon: '💬' },
    world_lore: { label: '世界观词条', icon: '📜' },
    skill_desc: { label: '技能与特性', icon: '⚡' },
    activity: { label: '活动与成就', icon: '🏆' },
    atmosphere: { label: '氛围与散文', icon: '✨' },
    other: { label: '其他包装', icon: '📝' },
  };

  const statusLabels: Record<NarrativeCopyStatus, { label: string; color: string }> = {
    draft: { label: '草稿 Draft', color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30' },
    review: { label: '审阅中 Review', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
    approved: { label: '已定稿 Approved', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
    final: { label: '上线交付 Final', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
    deprecated: { label: '已废弃 Deprecated', color: 'bg-rose-500/10 text-rose-500 border-rose-500/30' },
  };

  return (
    <div id="narrative-copy-view" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <FileText className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
            <span>文本包装 / Narrative Copy</span>
          </h2>
          <p className="text-xs opacity-75 mt-1" style={{ color: 'var(--text-secondary)' }}>
            统一管理游戏各端文本包装（UI提示、道具Flavor Text、技能描述、世界观词条），并与角色和剧情深度关联。
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 theme-btn-primary"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ 新增文本包装</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-2xl glass-card flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            type="text"
            placeholder="搜索文本包装标题、内容、Flavor Text 或标签..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg glass-input text-xs"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="px-2.5 py-1.5 rounded-lg glass-input text-xs"
        >
          <option value="all">分类: 全部 ({narrativeCopy.length})</option>
          {Object.entries(categoryLabels).map(([key, info]) => (
            <option key={key} value={key}>
              {info.icon} {info.label}
            </option>
          ))}
        </select>

        {/* Quest Filter */}
        <select
          value={questFilter}
          onChange={(e) => setQuestFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg glass-input text-xs"
        >
          <option value="all">关联任务: 全部</option>
          {quests.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-2.5 py-1.5 rounded-lg glass-input text-xs"
        >
          <option value="all">状态: 全部</option>
          <option value="draft">草稿</option>
          <option value="review">审阅中</option>
          <option value="approved">已定稿</option>
          <option value="final">上线交付</option>
        </select>
      </div>

      {/* Copy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCopy.length === 0 ? (
          <div
            className="col-span-full py-16 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center space-y-3"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <FileText className="w-10 h-10 opacity-30" style={{ color: 'var(--theme-primary)' }} />
            <p className="text-xs opacity-60">暂无符合条件的文本包装词条</p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl text-xs font-bold shadow-md theme-btn-primary flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>创建首条文本包装</span>
            </button>
          </div>
        ) : (
          filteredCopy.map((item) => {
            const catInfo = categoryLabels[item.category] || categoryLabels.other;
            const statusInfo = statusLabels[item.status] || statusLabels.draft;
            const linkedQuest = quests.find((q) => q.id === item.questId);
            const wordCount = item.content.length + (item.flavorText?.length || 0);

            return (
              <div
                key={item.id}
                id={`copy-card-${item.id}`}
                className="p-4 rounded-2xl border glass-card flex flex-col justify-between space-y-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                {/* Top: Category & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-1.5 flex-wrap">
                    <span className="text-xs">{catInfo.icon}</span>
                    <span className="text-[10px] font-mono opacity-80 font-bold">{catInfo.label}</span>
                    {item.version && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded border opacity-60">
                        v{item.version}
                      </span>
                    )}
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h4 className="font-bold text-xs font-display" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </h4>
                  {linkedQuest && (
                    <div className="flex items-center space-x-1 text-[10px] opacity-70 mt-0.5" style={{ color: 'var(--theme-primary)' }}>
                      <Compass className="w-3 h-3" />
                      <span>{linkedQuest.name}</span>
                    </div>
                  )}
                </div>

                {/* Main Content Body */}
                <div className="p-3 rounded-xl border text-xs font-sans leading-relaxed space-y-2 relative" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  <p className="line-clamp-4 select-text">{item.content}</p>

                  {item.flavorText && (
                    <p className="text-[11px] opacity-80 italic pt-2 border-t border-dashed font-serif line-clamp-3" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      “{item.flavorText}”
                    </p>
                  )}
                </div>

                {/* Tags & Entities */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] opacity-80">
                  {item.characters && item.characters.length > 0 && (
                    <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded border theme-badge-secondary">
                      <Users className="w-2.5 h-2.5" />
                      <span>{item.characters.join(', ')}</span>
                    </span>
                  )}

                  {item.locations && item.locations.length > 0 && (
                    <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded border theme-badge-secondary">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{item.locations.join(', ')}</span>
                    </span>
                  )}

                  {item.tags && item.tags.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-mono border opacity-70">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t text-[10px] font-mono opacity-70" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span>{wordCount} 字</span>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleCopyClipboard(`${item.title}\n${item.content}\n${item.flavorText || ''}`)}
                      className="p-1 hover:opacity-100 hover:text-[var(--theme-primary)]"
                      title="复制全文"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() =>
                        navigateToAnalysis({
                          entityType: 'narrative_copy',
                          entityId: item.id,
                          entityName: item.title,
                        })
                      }
                      className="p-1 hover:opacity-100 hover:text-[var(--theme-primary)]"
                      title="发送至叙事分析"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1 hover:opacity-100 hover:text-[var(--theme-primary)]"
                      title="编辑文案"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1 hover:opacity-100 hover:text-rose-500"
                      title="删除"
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

      {/* Narrative Copy Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div
            className="w-full max-w-xl rounded-2xl border p-6 space-y-4 shadow-2xl my-8 text-xs"
            style={{
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                <h3 className="font-bold text-sm font-display">
                  {editingCopy ? '编辑文本包装词条' : '新建文本包装词条'}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1 opacity-90">词条/包装标题 *</label>
                  <input
                    type="text"
                    required
                    placeholder="如: 破损的西风勋章 (Flavor) / 联机确认弹窗"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">分类类型</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as NarrativeCopyCategory)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    {Object.entries(categoryLabels).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.icon} {info.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">正式文本内容 (Body / Copy) *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="录入正式包装文案、功能描述或系统文本..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-sans leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">风味叙事文本 (Flavor Text / 背景小传)</label>
                <textarea
                  rows={3}
                  placeholder="道具背景故事、角色留存日记断片、吟游诗人歌谣..."
                  value={flavorText}
                  onChange={(e) => setFlavorText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-serif leading-relaxed italic"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1 opacity-90">关联剧情线</label>
                  <select
                    value={selectedQuestId}
                    onChange={(e) => setSelectedQuestId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="">（不关联或全局通用）</option>
                    {quests.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">状态</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as NarrativeCopyStatus)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="draft">草稿 Draft</option>
                    <option value="review">审阅中 Review</option>
                    <option value="approved">已定稿 Approved</option>
                    <option value="final">上线交付 Final</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">版本号</label>
                  <input
                    type="text"
                    placeholder="如: 1.0 / 2.1-beta"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input font-mono"
                  />
                </div>
              </div>

              {/* Tags Input */}
              <div className="space-y-1.5">
                <label className="block font-medium opacity-90">分类标签</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="输入标签按回车 (如: 新手引导, 悲情, 装备说明)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1 px-3 py-1.5 rounded-xl glass-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 rounded-xl border text-xs font-bold theme-badge-secondary"
                  >
                    + 标签
                  </button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-lg border text-[10px] font-mono flex items-center space-x-1"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                      >
                        <span>#{t}</span>
                        <button type="button" onClick={() => handleRemoveTag(t)} className="opacity-50 hover:opacity-100">
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">备注与审校留言</label>
                <input
                  type="text"
                  placeholder="如: 需配合日语声优停顿调整、已与战斗策划确认"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                  保存词条
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
