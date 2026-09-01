import React, { useState } from 'react';
import {
  Globe2,
  MapPin,
  Shield,
  Gem,
  BookMarked,
  Sparkles,
  History,
  Plus,
  Edit3,
  Trash2,
  Search,
  Tag,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  WorldLocation,
  WorldFaction,
  WorldItem,
  WorldLore,
  WorldTheme,
  WorldEvent,
} from '../types';
import { putToStore, archiveEntity, logActivity } from '../services/db';

type WorldTab = 'locations' | 'factions' | 'items' | 'lore' | 'themes' | 'events';

export const WorldView: React.FC = () => {
  const {
    t,
    locations,
    factions,
    items,
    lore,
    themes,
    events,
    activeProjectId,
    refreshData,
    showToast,
  } = useApp();

  const [currentTab, setCurrentTab] = useState<WorldTab>('locations');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Universal form fields
  const [field1, setField1] = useState(''); // Name / Title
  const [field2, setField2] = useState(''); // Type / Category / Leader / Time / CoreConcept
  const [field3, setField3] = useState(''); // Description / Content / Motif / Location
  const [field4, setField4] = useState(''); // Effects / Allies / Causes / Extras
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const handleOpenCreate = () => {
    setEditingItem(null);
    setField1('');
    setField2('');
    setField3('');
    setField4('');
    setTags([]);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setField1(item.name || item.title || '');
    setField2(item.type || item.category || item.leader || item.coreConcept || item.time || '');
    setField3(item.description || item.content || item.motif || item.location || '');
    setField4(item.effects || (item.allies ? item.allies.join(', ') : '') || (item.causes ? item.causes.join(', ') : '') || '');
    setTags(item.tags || []);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field1.trim()) {
      showToast(t.common.requiredField, 'error');
      return;
    }

    const now = Date.now();
    const id = editingItem ? editingItem.id : `${currentTab.slice(0, 3)}_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const projectId = activeProjectId || '';

    try {
      if (currentTab === 'locations') {
        const loc: WorldLocation = {
          id,
          projectId,
          name: field1.trim(),
          type: field2.trim() || '场景地貌',
          description: field3.trim(),
          factions: [],
          lore: field4.trim(),
          events: [],
          tags,
          createdAt: editingItem ? editingItem.createdAt : now,
          updatedAt: now,
        };
        await putToStore('locations', loc);
      } else if (currentTab === 'factions') {
        const fac: WorldFaction = {
          id,
          projectId,
          name: field1.trim(),
          leader: field2.trim(),
          description: field3.trim(),
          allies: field4.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
          rivals: [],
          members: [],
          lore: '',
          tags,
          createdAt: editingItem ? editingItem.createdAt : now,
          updatedAt: now,
        };
        await putToStore('factions', fac);
      } else if (currentTab === 'items') {
        const itm: WorldItem = {
          id,
          projectId,
          name: field1.trim(),
          type: field2.trim() || '物品/道具',
          description: field3.trim(),
          effects: field4.trim(),
          owner: '',
          origin: '',
          lore: '',
          tags,
          createdAt: editingItem ? editingItem.createdAt : now,
          updatedAt: now,
        };
        await putToStore('items', itm);
      } else if (currentTab === 'lore') {
        const lr: WorldLore = {
          id,
          projectId,
          title: field1.trim(),
          category: field2.trim() || '通用法则',
          content: field3.trim(),
          relatedEntities: [],
          tags,
          createdAt: editingItem ? editingItem.createdAt : now,
          updatedAt: now,
        };
        await putToStore('lore', lr);
      } else if (currentTab === 'themes') {
        const thm: WorldTheme = {
          id,
          projectId,
          name: field1.trim(),
          coreConcept: field2.trim(),
          motif: field3.trim(),
          relatedCharacters: [],
          relatedQuests: [],
          tags,
          createdAt: editingItem ? editingItem.createdAt : now,
          updatedAt: now,
        };
        await putToStore('themes', thm);
      } else if (currentTab === 'events') {
        const ev: WorldEvent = {
          id,
          projectId,
          name: field1.trim(),
          time: field2.trim() || '纪元时点',
          location: field3.trim(),
          description: field4.trim(),
          characters: [],
          causes: [],
          dependsOn: [],
          tags,
          createdAt: editingItem ? editingItem.createdAt : now,
          updatedAt: now,
        };
        await putToStore('events', ev);
      }

      await logActivity(editingItem ? 'UPDATE_WORLD_ENTITY' : 'CREATE_WORLD_ENTITY', currentTab, field1.trim(), activeProjectId || undefined);
      showToast(t.common.success, 'success');
      setModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleArchive = async (item: any) => {
    if (window.confirm(`确定要将「${item.name || item.title}」移入归档区吗？`)) {
      const typeMap: Record<WorldTab, any> = {
        locations: 'location',
        factions: 'faction',
        items: 'item',
        lore: 'lore',
        themes: 'theme',
        events: 'event',
      };
      await archiveEntity(typeMap[currentTab], item, '用户归档设定');
      showToast('设定已归档', 'info');
      await refreshData();
    }
  };

  const tabsConfig = [
    { id: 'locations' as const, label: t?.world?.tabs?.locations || '空间地貌 (Locations)', icon: MapPin, data: locations || [] },
    { id: 'factions' as const, label: t?.world?.tabs?.factions || '派系组织 (Factions)', icon: Shield, data: factions || [] },
    { id: 'items' as const, label: t?.world?.tabs?.items || '关键圣物 (Items)', icon: Gem, data: items || [] },
    { id: 'lore' as const, label: t?.world?.tabs?.lore || '世界观秘闻 (Lore)', icon: BookMarked, data: lore || [] },
    { id: 'themes' as const, label: t?.world?.tabs?.themes || '核心母题 (Themes)', icon: Sparkles, data: themes || [] },
    { id: 'events' as const, label: t?.world?.tabs?.events || '纪元大事记 (Events)', icon: History, data: events || [] },
  ];

  const currentConfig = tabsConfig.find((t) => t.id === currentTab) || tabsConfig[0];

  const filteredData = (currentConfig.data || []).filter((item: any) => {
    if (!item) return false;
    const text = (item.name || item.title || '') + (item.description || item.content || item.lore || '');
    return text.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div id="world-view-container" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Top Header */}
      <div className="glass-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <span>WORLD BUILDING ATLAS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Globe2 className="w-6 h-6" style={{ color: 'var(--theme-primary)' }} />
            <span>{t.world.title}</span>
          </h2>
          <p className="text-xs opacity-75 mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t.world.subtitle}</p>
        </div>

        <button
          id="world-create-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full font-bold text-xs shadow-lg transition-all active:scale-95 theme-btn-primary"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{t.common.create} {currentConfig.label.split(' ')[0]}</span>
        </button>
      </div>

      {/* Tabs Navigation Strip */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl glass-card">
        {tabsConfig.map((tb) => {
          const Icon = tb.icon;
          const isActive = currentTab === tb.id;
          return (
            <button
              key={tb.id}
              id={`world-tab-${tb.id}`}
              onClick={() => setCurrentTab(tb.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                isActive
                  ? 'shadow-md scale-[1.02] ring-2'
                  : 'hover:opacity-100 opacity-70'
              }`}
              style={{
                background: isActive ? 'var(--theme-primary)' : 'var(--bg-surface-elevated)',
                color: isActive ? '#ffffff' : 'var(--text-primary)',
                borderColor: isActive ? 'var(--theme-primary)' : 'var(--border-subtle)',
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{tb.label}</span>
              <span 
                className="px-2 py-0.5 rounded-full text-[10px] font-mono"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)',
                  color: isActive ? '#ffffff' : 'var(--text-primary)',
                }}
              >
                {tb.data.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Filter */}
      <div className="p-3.5 rounded-2xl glass-card">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            id="world-search-input"
            type="text"
            placeholder={t.common.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl glass-input text-xs"
          />
        </div>
      </div>

      {/* Entities Grid */}
      {filteredData.length === 0 ? (
        <div className="py-20 text-center rounded-3xl glass-card opacity-80">
          <currentConfig.icon className="w-12 h-12 mx-auto mb-3 opacity-60" style={{ color: 'var(--theme-primary)' }} />
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t.common.empty}</h3>
          <p className="text-xs opacity-60 max-w-sm mx-auto mb-4" style={{ color: 'var(--text-secondary)' }}>{t.common.emptyHint}</p>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2 rounded-full border text-xs font-bold theme-badge-secondary"
          >
            + {t.common.create} {currentConfig.label.split(' ')[0]}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredData.map((item: any) => (
            <div
              key={item.id}
              id={`world-item-${item.id}`}
              className="p-5 rounded-3xl glass-card hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.name || item.title}
                  </h4>
                  {(item.type || item.category || item.leader || item.time) && (
                    <span 
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border flex-shrink-0"
                      style={{ 
                        background: 'var(--theme-secondary-bg)', 
                        color: 'var(--theme-secondary-text)',
                        borderColor: 'var(--theme-secondary-border)',
                      }}
                    >
                      {item.type || item.category || item.leader || item.time}
                    </span>
                  )}
                </div>

                <p className="text-xs opacity-80 line-clamp-3 leading-relaxed mb-3 font-serif" style={{ color: 'var(--text-secondary)' }}>
                  {item.description || item.content || item.motif || item.effects || '暂无详细设定描述'}
                </p>

                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.map((tg: string, i: number) => (
                      <span 
                        key={i} 
                        className="px-2 py-0.5 rounded text-[9px] font-mono opacity-75 border"
                        style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                      >
                        #{tg}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t flex items-center justify-between text-[10px] opacity-60 font-mono" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:text-[var(--theme-primary)]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleArchive(item)}
                    className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Universal World Entity Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-3xl border p-6 space-y-4 shadow-2xl"
            style={{ 
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold text-sm">
                {editingItem ? t.common.edit : t.common.create} {currentConfig.label}
              </h3>
              <button onClick={() => setModalOpen(false)} className="opacity-60 hover:opacity-100 text-xs p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold mb-1 opacity-90">
                    {currentTab === 'lore' ? '设定标题' : '名称'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="如: 浮空遗迹·天帷之城"
                    value={field1}
                    onChange={(e) => setField1(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 opacity-90">
                    {currentTab === 'locations' ? '空间类型' : currentTab === 'factions' ? '领袖/主理' : currentTab === 'events' ? '发生时点' : '分类/类型'}
                  </label>
                  <input
                    type="text"
                    placeholder="如: 隐秘圣殿"
                    value={field2}
                    onChange={(e) => setField2(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 opacity-90">
                  {currentTab === 'lore' ? '设定详述/规则正文' : '详细描述与背景'}
                </label>
                <textarea
                  rows={4}
                  placeholder="描写空间地貌、势力主张、圣物威能、历史纪元..."
                  value={field3}
                  onChange={(e) => setField3(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-serif resize-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 opacity-90">
                  {currentTab === 'items' ? '附带威能/特殊效果' : currentTab === 'factions' ? '盟友组织 (逗号分隔)' : '关联备注/附注'}
                </label>
                <input
                  type="text"
                  placeholder="相关联的附加属性..."
                  value={field4}
                  onChange={(e) => setField4(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-full border hover:bg-black/5 text-xs font-bold opacity-80"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all theme-btn-primary"
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
