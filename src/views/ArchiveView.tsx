import React, { useState } from 'react';
import {
  Archive,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Search,
  Filter,
  Layers,
  FolderKanban,
  BookOpen,
  Users,
  Compass,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { restoreArchivedEntity, permanentlyDeleteArchive, clearAllArchives } from '../services/db';

export const ArchiveView: React.FC = () => {
  const {
    t,
    archives = [],
    archiveRecords = [],
    refreshData,
    showToast,
  } = useApp();

  const archiveList = archives && archives.length > 0 ? archives : (archiveRecords || []);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const handleRestore = async (id: string, name: string) => {
    try {
      await restoreArchivedEntity(id);
      showToast(`已成功将「${name}」复原至主工作区`, 'success');
      await refreshData();
    } catch (e: any) {
      showToast(`复原失败: ${e.message}`, 'error');
    }
  };

  const handlePermanentDelete = async (id: string, name: string) => {
    if (window.confirm(`警告：永久删除「${name}」后将无法恢复，确定执行吗？`)) {
      try {
        await permanentlyDeleteArchive(id);
        showToast('已彻底删除该记录', 'info');
        await refreshData();
      } catch (e: any) {
        showToast(`删除失败: ${e.message}`, 'error');
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('警告：确定要清空所有归档与废纸篓数据吗？此操作不可逆！')) {
      try {
        await clearAllArchives();
        showToast('已清空全部归档记录', 'info');
        await refreshData();
      } catch (e: any) {
        showToast(`清空失败: ${e.message}`, 'error');
      }
    }
  };

  const filteredArchives = (archiveList || []).filter((item) => {
    if (!item) return false;
    const text = (item.name || item.title || JSON.stringify(item.data || '')).toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || item.entityType === typeFilter;
    return matchesSearch && matchesType;
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'project': return <FolderKanban className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />;
      case 'document': return <BookOpen className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />;
      case 'character': return <Users className="w-4 h-4 text-cyan-500" />;
      case 'quest': return <Compass className="w-4 h-4 text-amber-500" />;
      case 'location': return <MapPin className="w-4 h-4 text-emerald-500" />;
      default: return <Sparkles className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />;
    }
  };

  return (
    <div id="archive-view-container" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Top Header */}
      <div className="glass-card p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div 
            className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-bold mb-2 border"
            style={{
              background: 'var(--theme-secondary-bg)',
              color: 'var(--theme-secondary-text)',
              borderColor: 'var(--theme-secondary-border)'
            }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
            <span>RECYCLE & VAULT</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Archive className="w-6 h-6" style={{ color: 'var(--theme-primary)' }} />
            <span>{t.archive.title}</span>
          </h2>
          <p className="text-xs opacity-75 mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t.archive.subtitle}</p>
        </div>

        {archiveList.length > 0 && (
          <button
            id="archive-clear-all-btn"
            onClick={handleClearAll}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 border border-rose-500/30 text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.archive.clearAll}</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl glass-card shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            id="archive-search-input"
            type="text"
            placeholder={t.common.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl glass-input text-xs focus:outline-none focus:ring-2 shadow-inner"
          />
        </div>

        <select
          id="archive-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl glass-input text-xs font-medium focus:outline-none"
        >
          <option value="all">{t.common.all}</option>
          <option value="project">{t.home.stats.projects}</option>
          <option value="document">{t.home.stats.documents}</option>
          <option value="character">{t.home.stats.characters}</option>
          <option value="quest">{t.home.stats.quests}</option>
          <option value="location">{t.home.stats.locations}</option>
        </select>
      </div>

      {/* Archives List */}
      {filteredArchives.length === 0 ? (
        <div className="py-20 text-center rounded-3xl glass-card text-xs shadow-sm opacity-75">
          <Archive className="w-12 h-12 opacity-30 mx-auto mb-3" style={{ color: 'var(--theme-primary)' }} />
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t.common.empty}</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{t.archive.emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredArchives.map((item) => {
            const itemName = item.data?.name || item.data?.title || '未命名实体';
            return (
              <div
                key={item.id}
                id={`archive-item-${item.id}`}
                className="p-4 rounded-2xl border shadow-sm flex items-center justify-between gap-3 transition-all"
                style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-start space-x-3 truncate">
                  <div 
                    className="p-2.5 rounded-xl border shadow-inner flex-shrink-0 mt-0.5"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                  >
                    {getEntityIcon(item.entityType)}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                        {itemName}
                      </span>
                      <span 
                        className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border"
                        style={{
                          background: 'var(--theme-secondary-bg)',
                          color: 'var(--theme-secondary-text)',
                          borderColor: 'var(--theme-secondary-border)'
                        }}
                      >
                        {item.entityType}
                      </span>
                    </div>
                    <p className="text-[10px] opacity-60 mt-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      归档于: {new Date(item.archivedAt).toLocaleString()}
                    </p>
                    {item.reason && (
                      <p className="text-[10px] opacity-75 truncate" style={{ color: 'var(--text-secondary)' }}>原因: {item.reason}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(item.id, itemName)}
                    title={t.archive.restore}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 border shadow-sm active:scale-95 transition-all theme-btn-primary"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t.archive.restore}</span>
                  </button>

                  <button
                    onClick={() => handlePermanentDelete(item.id, itemName)}
                    title={t.archive.permanentDelete}
                    className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-600 text-xs flex items-center space-x-1 border border-rose-500/30 active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
