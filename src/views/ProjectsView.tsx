import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Edit3,
  Archive,
  Search,
  Tag,
  Calendar,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Project } from '../types';
import { putToStore, archiveEntity, logActivity } from '../services/db';

export const ProjectsView: React.FC = () => {
  const {
    t,
    projects,
    activeProjectId,
    setActiveProjectId,
    refreshData,
    showToast,
    setCurrentTab,
  } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('game');
  const [status, setStatus] = useState<Project['status']>('planning');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const handleOpenCreate = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setType('game');
    setStatus('planning');
    setTags([]);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Project) => {
    setEditingProject(p);
    setName(p.name);
    setDescription(p.description);
    setType(p.type);
    setStatus(p.status);
    setTags(p.tags || []);
    setModalOpen(true);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast(t.common.requiredField, 'error');
      return;
    }

    const now = Date.now();
    const proj: Project = {
      id: editingProject ? editingProject.id : 'proj_' + now + '_' + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      description: description.trim(),
      type,
      status,
      tags,
      createdAt: editingProject ? editingProject.createdAt : now,
      updatedAt: now,
    };

    try {
      await putToStore('projects', proj);
      await logActivity(editingProject ? 'UPDATE_PROJECT' : 'CREATE_PROJECT', 'project', proj.name, proj.id);
      showToast(t.common.success, 'success');
      setModalOpen(false);
      if (!activeProjectId) {
        setActiveProjectId(proj.id);
      }
      await refreshData();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleArchive = async (proj: Project) => {
    if (window.confirm(t.projects.deleteConfirm)) {
      try {
        await archiveEntity('project', proj, '用户归档项目');
        if (activeProjectId === proj.id) {
          setActiveProjectId(null);
        }
        showToast(`项目「${proj.name}」已移入归档区`, 'info');
        await refreshData();
      } catch (e: any) {
        showToast(`归档失败: ${e.message}`, 'error');
      }
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div id="projects-view-container" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <FolderKanban className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
            <span>{t.projects.title}</span>
          </h2>
          <p className="text-xs opacity-75 mt-1" style={{ color: 'var(--text-secondary)' }}>{t.projects.subtitle}</p>
        </div>

        <button
          id="projects-create-new-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 theme-btn-primary"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{t.projects.newProject}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl glass-card">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            id="projects-search-input"
            type="text"
            placeholder={t.common.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg glass-input text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs opacity-75" style={{ color: 'var(--text-secondary)' }}>{t.common.status}:</span>
          <select
            id="projects-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg glass-input text-xs"
          >
            <option value="all">{t.common.all}</option>
            <option value="planning">{t.projects.statuses.planning}</option>
            <option value="writing">{t.projects.statuses.writing}</option>
            <option value="revising">{t.projects.statuses.revising}</option>
            <option value="completed">{t.projects.statuses.completed}</option>
          </select>
        </div>
      </div>

      {/* Project Grid */}
      {filteredProjects.length === 0 ? (
        <div id="projects-empty-state" className="py-16 text-center rounded-2xl glass-card">
          <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-60" style={{ color: 'var(--theme-primary)' }} />
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t.common.empty}</h3>
          <p className="text-xs opacity-75 max-w-sm mx-auto mb-4" style={{ color: 'var(--text-secondary)' }}>{t.home.noRecentProjects}</p>
          <button
            id="projects-empty-add-btn"
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl border text-xs font-medium theme-badge-secondary"
          >
            + {t.projects.newProject}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const isActive = activeProjectId === p.id;
            return (
              <div
                key={p.id}
                id={`project-card-${p.id}`}
                className={`p-5 rounded-2xl glass-card transition-all flex flex-col justify-between group ${
                  isActive
                    ? 'ring-2'
                    : ''
                }`}
                style={{
                  borderColor: isActive ? 'var(--theme-primary)' : 'var(--border-subtle)',
                  boxShadow: isActive ? '0 0 20px rgba(0,0,0,0.1)' : undefined
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--theme-primary)' }} />
                      <h3 className="font-bold text-sm truncate max-w-[180px] font-display" style={{ color: 'var(--text-primary)' }}>
                        {p.name}
                      </h3>
                    </div>
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-mono border"
                      style={{ 
                        background: 'var(--theme-secondary-bg)', 
                        color: 'var(--theme-secondary-text)',
                        borderColor: 'var(--theme-secondary-border)'
                      }}
                    >
                      {t.projects.statuses[p.status] || p.status}
                    </span>
                  </div>

                  <p className="text-xs opacity-80 line-clamp-3 mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {p.description || '暂无故事梗概描述'}
                  </p>

                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {p.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] opacity-75 border font-mono"
                          style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                        >
                          <Tag className="w-2.5 h-2.5" style={{ color: 'var(--theme-primary)' }} />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between text-[11px] opacity-70 font-mono" style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" style={{ color: 'var(--theme-primary)' }} />
                      {t.projects.types[p.type as keyof typeof t.projects.types] || p.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 opacity-60" />
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      id={`project-set-active-${p.id}`}
                      onClick={() => {
                        setActiveProjectId(p.id);
                        showToast(`已切换活跃项目: ${p.name}`, 'success');
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all text-center flex items-center justify-center space-x-1 border"
                      style={{
                        background: isActive ? 'var(--theme-primary)' : 'var(--bg-surface-elevated)',
                        color: isActive ? '#ffffff' : 'var(--text-primary)',
                        borderColor: isActive ? 'var(--theme-primary)' : 'var(--border-subtle)',
                      }}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t.projects.currentlyActive}</span>
                        </>
                      ) : (
                        <span>{t.projects.switchActive}</span>
                      )}
                    </button>

                    <button
                      id={`project-enter-library-${p.id}`}
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setCurrentTab('LIBRARY');
                      }}
                      title="打开资料库"
                      className="p-1.5 rounded-lg border opacity-80 hover:opacity-100 hover:text-[var(--theme-primary)]"
                      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id={`project-edit-${p.id}`}
                      onClick={() => handleOpenEdit(p)}
                      title={t.common.edit}
                      className="p-1.5 rounded-lg border opacity-80 hover:opacity-100 hover:text-[var(--theme-primary)]"
                      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id={`project-archive-${p.id}`}
                      onClick={() => handleArchive(p)}
                      title={t.common.archive}
                      className="p-1.5 rounded-lg border opacity-70 hover:opacity-100 hover:text-rose-500"
                      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Modal */}
      {modalOpen && (
        <div id="project-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div
            id="project-modal-content"
            className="w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl"
            style={{ 
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold text-base font-display">
                {editingProject ? t.projects.editProject : t.projects.newProject}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="opacity-60 hover:opacity-100 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1 opacity-90">{t.projects.fields.name} *</label>
                <input
                  id="project-form-name"
                  type="text"
                  required
                  placeholder="例如: 艾尔德拉遗迹编年史"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">{t.projects.fields.description}</label>
                <textarea
                  id="project-form-desc"
                  rows={3}
                  placeholder="填写一两句话的故事梗概、核心冲突或企划目标..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 opacity-90">{t.projects.fields.type}</label>
                  <select
                    id="project-form-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="game">{t.projects.types.game}</option>
                    <option value="novel">{t.projects.types.novel}</option>
                    <option value="film">{t.projects.types.film}</option>
                    <option value="worldbuilding">{t.projects.types.worldbuilding}</option>
                    <option value="other">{t.projects.types.other}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">{t.projects.fields.status}</label>
                  <select
                    id="project-form-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="planning">{t.projects.statuses.planning}</option>
                    <option value="writing">{t.projects.statuses.writing}</option>
                    <option value="revising">{t.projects.statuses.revising}</option>
                    <option value="completed">{t.projects.statuses.completed}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">{t.projects.fields.tags}</label>
                <input
                  id="project-form-tag-input"
                  type="text"
                  placeholder={t.common.addTag}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="w-full px-3 py-2 rounded-xl glass-input mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {tags.map((tg) => (
                    <span
                      key={tg}
                      className="px-2 py-0.5 rounded text-[10px] flex items-center space-x-1 border"
                      style={{
                        background: 'var(--theme-secondary-bg)',
                        color: 'var(--theme-secondary-text)',
                        borderColor: 'var(--theme-secondary-border)'
                      }}
                    >
                      <span>{tg}</span>
                      <button type="button" onClick={() => handleRemoveTag(tg)} className="hover:opacity-100">×</button>
                    </span>
                  ))}
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
                  id="project-form-submit-btn"
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
