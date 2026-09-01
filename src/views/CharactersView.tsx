import React, { useState } from 'react';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Search,
  MessageSquare,
  Network,
  Heart,
  Target,
  Sparkles,
  ChevronRight,
  Quote,
  Flame,
  Shield,
  Compass,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Character, CharacterRelation, CharacterDialogue, RelationType } from '../types';
import { putToStore, archiveEntity, logActivity } from '../services/db';

export const CharactersView: React.FC = () => {
  const {
    t,
    characters,
    activeProjectId,
    refreshData,
    showToast,
    setCurrentTab,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [identity, setIdentity] = useState('');
  const [personality, setPersonality] = useState('');
  const [goals, setGoals] = useState('');
  const [bio, setBio] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [relationships, setRelationships] = useState<CharacterRelation[]>([]);
  const [dialogues, setDialogues] = useState<CharacterDialogue[]>([]);

  // Temp form relation
  const [newRelTarget, setNewRelTarget] = useState('');
  const [newRelType, setNewRelType] = useState<RelationType>('knows');
  const [newRelDesc, setNewRelDesc] = useState('');

  // Temp form dialogue
  const [newQuote, setNewQuote] = useState('');
  const [newQuoteContext, setNewQuoteContext] = useState('');

  const handleOpenCreate = () => {
    setEditingChar(null);
    setName('');
    setAliases([]);
    setIdentity('');
    setPersonality('');
    setGoals('');
    setBio('');
    setTags([]);
    setRelationships([]);
    setDialogues([]);
    setModalOpen(true);
  };

  const handleOpenEdit = (char: Character) => {
    setEditingChar(char);
    setName(char.name);
    setAliases(char.aliases || []);
    setIdentity(char.identity || '');
    setPersonality(char.personality || '');
    setGoals(char.goals || '');
    setBio(char.bio || '');
    setTags(char.tags || []);
    setRelationships(char.relationships || []);
    setDialogues(char.dialogues || []);
    setModalOpen(true);
  };

  const handleAddRelation = () => {
    if (!newRelTarget.trim()) return;
    const targetName = newRelTarget.trim();
    const targetObj = characters.find((c) => c.name === targetName || c.id === targetName);
    const rel: CharacterRelation = {
      targetId: targetObj ? targetObj.id : 'temp_' + targetName,
      targetName: targetObj ? targetObj.name : targetName,
      type: newRelType,
      description: newRelDesc.trim(),
      weight: 3,
    };
    setRelationships([...relationships, rel]);
    setNewRelTarget('');
    setNewRelDesc('');
  };

  const handleRemoveRelation = (idx: number) => {
    setRelationships(relationships.filter((_, i) => i !== idx));
  };

  const handleAddDialogue = () => {
    if (!newQuote.trim()) return;
    setDialogues([
      ...dialogues,
      { quote: newQuote.trim(), context: newQuoteContext.trim() },
    ]);
    setNewQuote('');
    setNewQuoteContext('');
  };

  const handleRemoveDialogue = (idx: number) => {
    setDialogues(dialogues.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast(t.common.requiredField, 'error');
      return;
    }

    const now = Date.now();
    const avatarColors = ['#F04E98', '#00FFBF', '#809AAA', '#D48AA0', '#F59E0B', '#8B5CF6'];
    const color = editingChar?.avatarColor || avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const charObj: Character = {
      id: editingChar ? editingChar.id : 'char_' + now + '_' + Math.random().toString(36).slice(2, 6),
      projectId: activeProjectId || '',
      name: name.trim(),
      aliases,
      identity: identity.trim(),
      personality: personality.trim(),
      goals: goals.trim(),
      bio: bio.trim(),
      relationships,
      appearances: editingChar?.appearances || [],
      dialogues,
      events: editingChar?.events || [],
      locations: editingChar?.locations || [],
      quests: editingChar?.quests || [],
      themes: editingChar?.themes || [],
      tags,
      avatarColor: color,
      createdAt: editingChar ? editingChar.createdAt : now,
      updatedAt: now,
    };

    try {
      await putToStore('characters', charObj);
      await logActivity(editingChar ? 'UPDATE_CHARACTER' : 'CREATE_CHARACTER', 'character', charObj.name, activeProjectId || undefined);
      showToast(t.common.success, 'success');
      setModalOpen(false);
      setSelectedChar(charObj);
      await refreshData();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleArchive = async (char: Character) => {
    if (window.confirm(`确定要将角色「${char.name}」移入归档区吗？`)) {
      await archiveEntity('character', char, '用户归档角色');
      if (selectedChar?.id === char.id) setSelectedChar(null);
      showToast(`角色已归档`, 'info');
      await refreshData();
    }
  };

  const filteredCharacters = characters.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.identity?.toLowerCase().includes(search.toLowerCase()) ||
      c.bio?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div id="characters-view-container" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Users className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
            <span>{t.characters.title}</span>
          </h2>
          <p className="text-xs opacity-75 mt-1" style={{ color: 'var(--text-secondary)' }}>{t.characters.subtitle}</p>
        </div>

        <button
          id="characters-create-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 theme-btn-primary"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{t.characters.newCharacter}</span>
        </button>
      </div>

      {/* Main Grid: Character Cards & Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Character List / Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-3 rounded-xl glass-card">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                id="characters-search-input"
                type="text"
                placeholder={t.common.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg glass-input text-xs"
              />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredCharacters.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-dashed" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <Users className="w-10 h-10 opacity-40 mx-auto mb-2" />
                <p className="text-xs opacity-60">{t.common.empty}</p>
                <button
                  onClick={handleOpenCreate}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold border theme-badge-secondary"
                >
                  + {t.characters.newCharacter}
                </button>
              </div>
            ) : (
              filteredCharacters.map((char) => {
                const isSelected = selectedChar?.id === char.id;
                return (
                  <div
                    key={char.id}
                    id={`character-item-${char.id}`}
                    onClick={() => setSelectedChar(char)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between group ${
                      isSelected
                        ? 'shadow-md ring-2'
                        : 'glass-card hover:border-black/20'
                    }`}
                    style={{
                      background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                      borderColor: isSelected ? 'var(--theme-primary)' : 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-start space-x-3 truncate">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white font-display flex-shrink-0 shadow"
                        style={{ backgroundColor: char.avatarColor || 'var(--theme-primary)' }}
                      >
                        {char.name.slice(0, 1)}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-xs truncate font-display" style={{ color: 'var(--text-primary)' }}>{char.name}</h4>
                          {char.identity && (
                            <span 
                              className="px-1.5 py-0.2 rounded text-[10px] font-mono border"
                              style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-secondary-text)', borderColor: 'var(--theme-secondary-border)' }}
                            >
                              {char.identity}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-75 line-clamp-1 mt-1 font-serif" style={{ color: 'var(--text-secondary)' }}>
                          {char.personality || char.goals || char.bio || '无更多设定'}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] font-mono mt-1 opacity-60" style={{ color: 'var(--text-secondary)' }}>
                          <span>羁绊: {char.relationships?.length || 0}</span>
                          <span>语录: {char.dialogues?.length || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(char);
                        }}
                        title={t.common.edit}
                        className="p-1 opacity-60 hover:opacity-100 hover:text-[var(--theme-primary)]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(char);
                        }}
                        title={t.common.archive}
                        className="p-1 opacity-60 hover:opacity-100 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Character Detailed Dossier */}
        <div className="lg:col-span-7">
          {selectedChar ? (
            <div id="character-dossier-panel" className="p-6 rounded-2xl glass-card space-y-6">
              {/* Profile Header */}
              <div className="flex items-start justify-between pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center space-x-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl text-white font-display shadow-lg"
                    style={{ backgroundColor: selectedChar.avatarColor || 'var(--theme-primary)' }}
                  >
                    {selectedChar.name.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <span>{selectedChar.name}</span>
                      {selectedChar.aliases && selectedChar.aliases.length > 0 && (
                        <span className="text-xs font-normal font-sans opacity-70">
                          ({selectedChar.aliases.join(' / ')})
                        </span>
                      )}
                    </h3>
                    <p className="text-xs font-mono mt-0.5 font-bold" style={{ color: 'var(--theme-primary)' }}>{selectedChar.identity || '未指定身份/阵营'}</p>
                  </div>
                </div>

                <button
                  id="character-dossier-edit-btn"
                  onClick={() => handleOpenEdit(selectedChar)}
                  className="px-3 py-1.5 rounded-xl border text-xs flex items-center space-x-1.5 hover:bg-black/5"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t.characters.editCharacter}</span>
                </button>
              </div>

              {/* Personality & Goals (Want vs Need) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border space-y-1" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <span className="text-[11px] font-mono flex items-center gap-1 font-bold" style={{ color: 'var(--theme-primary)' }}>
                    <Sparkles className="w-3 h-3" />
                    {t.characters.personality}
                  </span>
                  <p className="text-xs leading-relaxed font-serif" style={{ color: 'var(--text-primary)' }}>
                    {selectedChar.personality || '尚未细化性格特质与内在弧光'}
                  </p>
                </div>

                <div className="p-4 rounded-xl border space-y-1" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <span className="text-[11px] font-mono flex items-center gap-1 font-bold" style={{ color: 'var(--theme-secondary-text)' }}>
                    <Target className="w-3 h-3" />
                    {t.characters.goals}
                  </span>
                  <p className="text-xs leading-relaxed font-serif" style={{ color: 'var(--text-primary)' }}>
                    {selectedChar.goals || '尚未定义核心驱动欲望与目标'}
                  </p>
                </div>
              </div>

              {/* Biography */}
              <div className="space-y-2">
                <span className="text-xs font-bold font-mono uppercase tracking-wider opacity-80" style={{ color: 'var(--text-primary)' }}>
                  {t.characters.bio}
                </span>
                <div className="p-4 rounded-xl border text-xs leading-relaxed font-serif whitespace-pre-wrap" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                  {selectedChar.bio || '暂无详细人物生平背景'}
                </div>
              </div>

              {/* Relationships List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    <Network className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                    {t.characters.relationships}
                  </span>
                  <button
                    onClick={() => setCurrentTab('KNOWLEDGE GRAPH')}
                    className="text-[11px] hover:underline font-mono font-bold"
                    style={{ color: 'var(--theme-primary)' }}
                  >
                    在图谱中查看 →
                  </button>
                </div>

                {selectedChar.relationships && selectedChar.relationships.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedChar.relationships.map((rel, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border flex items-center justify-between text-xs"
                        style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                      >
                        <div>
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{rel.targetName}</span>
                          <span 
                            className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
                            style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-primary)' }}
                          >
                            {t.relations[rel.type] || rel.type}
                          </span>
                          {rel.description && (
                            <p className="text-[10px] opacity-70 mt-0.5 font-serif" style={{ color: 'var(--text-secondary)' }}>{rel.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic p-3 rounded-xl border opacity-60" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>暂无建立的羁绊关联</p>
                )}
              </div>

              {/* Classic Dialogues */}
              <div className="space-y-2">
                <span className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Quote className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                  {t.characters.dialogues}
                </span>

                {selectedChar.dialogues && selectedChar.dialogues.length > 0 ? (
                  <div className="space-y-2">
                    {selectedChar.dialogues.map((d, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border text-xs font-serif italic border-l-4"
                        style={{ 
                          background: 'var(--bg-surface-elevated)', 
                          borderColor: 'var(--border-subtle)', 
                          borderLeftColor: 'var(--theme-primary)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        “{d.quote}”
                        {d.context && (
                          <span className="block text-[10px] opacity-70 font-sans not-italic mt-1" style={{ color: 'var(--text-secondary)' }}>
                            — 情境: {d.context}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic p-3 rounded-xl border opacity-60" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>暂无摘录的台词语录</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center rounded-2xl glass-card text-center p-6">
              <Users className="w-12 h-12 opacity-40 mb-3" style={{ color: 'var(--theme-primary)' }} />
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>未选中角色</h3>
              <p className="text-xs opacity-60 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                从左侧角色列表中点击选择角色，查看完整人物档案、性格目标、人际羁绊与台词精选。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Character Edit / Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto custom-scrollbar">
          <div
            className="w-full max-w-2xl rounded-2xl border p-6 space-y-4 shadow-2xl my-8 glass-modal"
            style={{ 
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold text-base font-display">
                {editingChar ? t.characters.editCharacter : t.characters.newCharacter}
              </h3>
              <button onClick={() => setModalOpen(false)} className="opacity-60 hover:opacity-100 text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 opacity-90">{t.characters.name} *</label>
                  <input
                    type="text"
                    required
                    placeholder="如: 艾登·维恩"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">{t.characters.identity}</label>
                  <input
                    type="text"
                    placeholder="如: 帝国执剑人 / 叛逆法师"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 opacity-90">{t.characters.personality}</label>
                  <input
                    type="text"
                    placeholder="如: 冷酷但恪守荣誉，内心隐藏愧疚"
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">{t.characters.goals}</label>
                  <input
                    type="text"
                    placeholder="如: 查清禁忌真相，拯救被困的妹妹"
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">{t.characters.bio}</label>
                <textarea
                  rows={4}
                  placeholder="描写生平事迹、关键转折点与家庭出身..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input resize-none"
                />
              </div>

              {/* Relationships Editor Section */}
              <div className="p-3 rounded-xl border space-y-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <span className="block font-medium opacity-90">{t.characters.relationships}</span>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder={t.characters.targetCharacter}
                    value={newRelTarget}
                    onChange={(e) => setNewRelTarget(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg glass-input text-xs w-32"
                  />
                  <select
                    value={newRelType}
                    onChange={(e) => setNewRelType(e.target.value as RelationType)}
                    className="px-2 py-1.5 rounded-lg glass-input text-xs"
                  >
                    <option value="knows">{t.relations.knows}</option>
                    <option value="likes">{t.relations.likes}</option>
                    <option value="dislikes">{t.relations.dislikes}</option>
                    <option value="trusts">{t.relations.trusts}</option>
                    <option value="conflicts_with">{t.relations.conflicts_with}</option>
                    <option value="belongs_to">{t.relations.belongs_to}</option>
                    <option value="reveals">{t.relations.reveals}</option>
                    <option value="foreshadows">{t.relations.foreshadows}</option>
                    <option value="causes">{t.relations.causes}</option>
                    <option value="depends_on">{t.relations.depends_on}</option>
                  </select>
                  <input
                    type="text"
                    placeholder="备注说明 (如: 宿命死敌)"
                    value={newRelDesc}
                    onChange={(e) => setNewRelDesc(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg glass-input text-xs min-w-[120px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddRelation}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold theme-btn-primary"
                  >
                    + 添加
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {relationships.map((rel, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded border text-[11px] flex items-center space-x-1.5"
                      style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                    >
                      <span className="font-medium" style={{ color: 'var(--theme-primary)' }}>{rel.targetName}</span>
                      <span className="opacity-70">({t.relations[rel.type] || rel.type})</span>
                      <button type="button" onClick={() => handleRemoveRelation(i)} className="opacity-60 hover:opacity-100">✕</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Dialogues Editor Section */}
              <div className="p-3 rounded-xl border space-y-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <span className="block font-medium opacity-90">{t.characters.dialogues}</span>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="台词台词内容..."
                    value={newQuote}
                    onChange={(e) => setNewQuote(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg glass-input text-xs min-w-[150px]"
                  />
                  <input
                    type="text"
                    placeholder="情境/章节"
                    value={newQuoteContext}
                    onChange={(e) => setNewQuoteContext(e.target.value)}
                    className="w-32 px-2.5 py-1.5 rounded-lg glass-input text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddDialogue}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold theme-btn-primary"
                  >
                    + 录入
                  </button>
                </div>

                <div className="space-y-1 pt-1">
                  {dialogues.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 rounded border text-[11px]" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
                      <span className="truncate italic font-serif">“{d.quote}” {d.context ? `(${d.context})` : ''}</span>
                      <button type="button" onClick={() => handleRemoveDialogue(i)} className="opacity-60 hover:opacity-100 ml-2">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border hover:bg-black/5 opacity-80"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold shadow-md theme-btn-primary active:scale-95"
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
