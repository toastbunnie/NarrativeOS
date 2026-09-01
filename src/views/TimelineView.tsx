import React, { useState } from 'react';
import {
  CalendarDays,
  Plus,
  Edit3,
  Trash2,
  MoveUp,
  MoveDown,
  Clock,
  MapPin,
  Users,
  GitCommit,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TimelineEvent } from '../types';
import { putToStore, deleteFromStore, logActivity } from '../services/db';

export const TimelineView: React.FC = () => {
  const {
    t,
    timeline,
    activeProjectId,
    refreshData,
    showToast,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<TimelineEvent | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [timeLabel, setTimeLabel] = useState('');
  const [track, setTrack] = useState('主线剧情');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [characters, setCharacters] = useState<string[]>([]);
  const [charInput, setCharInput] = useState('');

  // Sorted timeline
  const sortedTimeline = [...timeline].sort((a, b) => a.order - b.order);

  const handleOpenCreate = () => {
    setEditingNode(null);
    setTitle('');
    setTimeLabel(`纪元 ${sortedTimeline.length + 1} 年`);
    setTrack('主线剧情');
    setDescription('');
    setLocation('');
    setCharacters([]);
    setModalOpen(true);
  };

  const handleOpenEdit = (node: TimelineEvent) => {
    setEditingNode(node);
    setTitle(node.title);
    setTimeLabel(node.timeLabel || '');
    setTrack(node.track || '主线剧情');
    setDescription(node.description || '');
    setLocation(node.location || '');
    setCharacters(node.characters || []);
    setModalOpen(true);
  };

  const handleAddChar = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && charInput.trim()) {
      e.preventDefault();
      if (!characters.includes(charInput.trim())) {
        setCharacters([...characters, charInput.trim()]);
      }
      setCharInput('');
    }
  };

  const handleRemoveChar = (charName: string) => {
    setCharacters(characters.filter((c) => c !== charName));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast(t.common.requiredField, 'error');
      return;
    }

    const now = Date.now();
    const eventObj: TimelineEvent = {
      id: editingNode ? editingNode.id : 'time_' + now + '_' + Math.random().toString(36).slice(2, 6),
      projectId: activeProjectId || '',
      name: title.trim(),
      title: title.trim(),
      time: timeLabel.trim(),
      timeLabel: timeLabel.trim(),
      track: track.trim() || '主线剧情',
      category: track.trim() || '主线剧情',
      description: description.trim(),
      location: location.trim(),
      characters,
      orderIndex: editingNode ? (editingNode.orderIndex ?? editingNode.order ?? 0) : sortedTimeline.length,
      order: editingNode ? (editingNode.order ?? editingNode.orderIndex ?? 0) : sortedTimeline.length,
      causalCauses: editingNode?.causalCauses || [],
      causalDependsOn: editingNode?.causalDependsOn || [],
      tags: editingNode?.tags || [],
      createdAt: editingNode ? editingNode.createdAt : now,
      updatedAt: now,
    };

    try {
      await putToStore('timeline', eventObj);
      await logActivity(editingNode ? 'UPDATE_TIMELINE' : 'CREATE_TIMELINE', 'timeline', eventObj.title || eventObj.name, activeProjectId || undefined);
      showToast(t.common.success, 'success');
      setModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedTimeline.length) return;

    const currentItem = sortedTimeline[index];
    const targetItem = sortedTimeline[targetIndex];

    const tempOrder = currentItem.order;
    currentItem.order = targetItem.order;
    targetItem.order = tempOrder;

    try {
      await putToStore('timeline', currentItem);
      await putToStore('timeline', targetItem);
      await refreshData();
    } catch (e: any) {
      showToast('时序重排失败', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.timeline.deleteConfirm)) {
      await deleteFromStore('timeline', id);
      showToast(t.common.success, 'info');
      await refreshData();
    }
  };

  return (
    <div id="timeline-view-container" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <CalendarDays className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
            <span>{t.timeline.title}</span>
          </h2>
          <p className="text-xs opacity-75 mt-1" style={{ color: 'var(--text-secondary)' }}>{t.timeline.subtitle}</p>
        </div>

        <button
          id="timeline-add-event-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 theme-btn-primary"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{t.timeline.addEvent}</span>
        </button>
      </div>

      {/* Timeline Stream */}
      {sortedTimeline.length === 0 ? (
        <div className="py-16 text-center rounded-2xl glass-card">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-60" style={{ color: 'var(--theme-primary)' }} />
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t.common.empty}</h3>
          <p className="text-xs opacity-75 max-w-sm mx-auto mb-4" style={{ color: 'var(--text-secondary)' }}>{t.timeline.emptyHint}</p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl border text-xs font-medium theme-badge-secondary"
          >
            + {t.timeline.addEvent}
          </button>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--theme-primary)]">
          {sortedTimeline.map((item, idx) => (
            <div
              key={item.id}
              id={`timeline-node-${item.id}`}
              className="relative rounded-2xl glass-card p-5 transition-all group"
            >
              {/* Timeline Pin Indicator */}
              <div 
                className="absolute -left-6 sm:-left-8 top-5 w-4 h-4 rounded-full flex items-center justify-center -translate-x-1/2 shadow-sm border-2"
                style={{ 
                  background: 'var(--bg-surface-elevated)', 
                  borderColor: 'var(--theme-primary)'
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--theme-primary)' }} />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
                      style={{ 
                        background: 'var(--theme-secondary-bg)', 
                        color: 'var(--theme-secondary-text)',
                        borderColor: 'var(--theme-secondary-border)'
                      }}
                    >
                      {item.track}
                    </span>
                    <span className="text-xs font-mono flex items-center gap-1 font-bold" style={{ color: 'var(--theme-primary)' }}>
                      <Clock className="w-3 h-3" />
                      {item.timeLabel}
                    </span>
                  </div>
                  <h3 className="text-base font-bold font-display mt-1" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </h3>
                </div>

                <div className="flex items-center space-x-1 self-end sm:self-start">
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, 'up')}
                    className="p-1 opacity-60 hover:opacity-100 disabled:opacity-20"
                    title={t.timeline.moveUp}
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={idx === sortedTimeline.length - 1}
                    onClick={() => handleMove(idx, 'down')}
                    className="p-1 opacity-60 hover:opacity-100 disabled:opacity-20"
                    title={t.timeline.moveDown}
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1 opacity-60 hover:opacity-100 hover:text-[var(--theme-primary)]"
                    title={t.common.edit}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 opacity-50 hover:opacity-100 hover:text-rose-500"
                    title={t.common.delete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs opacity-80 leading-relaxed font-serif whitespace-pre-wrap mb-3" style={{ color: 'var(--text-secondary)' }}>
                {item.description || '暂无事件演进详述'}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono pt-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                {item.location && (
                  <span className="flex items-center gap-1 opacity-90">
                    <MapPin className="w-3 h-3" style={{ color: 'var(--theme-primary)' }} />
                    {item.location}
                  </span>
                )}
                {item.characters && item.characters.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 opacity-75" />
                    <span>{item.characters.join('、')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline Event Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl"
            style={{ 
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold text-sm font-display">
                {editingNode ? (t?.timeline?.editEvent || '编辑事件') : (t?.timeline?.addEvent || t?.timeline?.newEvent || '编排新事件')}
              </h3>
              <button onClick={() => setModalOpen(false)} className="opacity-60 hover:opacity-100 text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1 opacity-90">{t?.timeline?.fields?.title || '事件标题'} *</label>
                <input
                  type="text"
                  required
                  placeholder="如: 王城陷落与流亡誓约"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 opacity-90">{t?.timeline?.fields?.timeLabel || '时点/纪年'}</label>
                  <input
                    type="text"
                    placeholder="如: 新历前 302 年"
                    value={timeLabel}
                    onChange={(e) => setTimeLabel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">{t?.timeline?.fields?.track || '叙事线/轨道'}</label>
                  <input
                    type="text"
                    placeholder="如: 主线剧情 / 支线暗涌"
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">{t?.timeline?.fields?.description || '事件详情描述'}</label>
                <textarea
                  rows={3}
                  placeholder="事件起因、冲突过程与全局影响..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-serif resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 opacity-90">{t?.timeline?.fields?.location || '发生地点'}</label>
                  <input
                    type="text"
                    placeholder="发生场景空间..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">{t?.timeline?.fields?.characters || '参演角色'}</label>
                  <input
                    type="text"
                    placeholder="输入角色名回车添加..."
                    value={charInput}
                    onChange={(e) => setCharInput(e.target.value)}
                    onKeyDown={handleAddChar}
                    className="w-full px-3 py-2 rounded-xl glass-input mb-1"
                  />
                  <div className="flex flex-wrap gap-1">
                    {characters.map((c) => (
                      <span 
                        key={c} 
                        className="px-1.5 py-0.5 rounded text-[10px] flex items-center space-x-1 border"
                        style={{
                          background: 'var(--theme-secondary-bg)',
                          color: 'var(--theme-secondary-text)',
                          borderColor: 'var(--theme-secondary-border)'
                        }}
                      >
                        <span>{c}</span>
                        <button type="button" onClick={() => handleRemoveChar(c)}>✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border hover:bg-black/5"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all theme-btn-primary"
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
