import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, Music, ChevronRight, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { QuestAVRequirementsTab } from '../components/quests/QuestAVRequirementsTab';

export const AVRequirementsView: React.FC = () => {
  const { t, quests, questSteps, avRequirements, activeProjectId, refreshData } = useApp();
  const [search, setSearch] = useState('');
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  const projectQuests = useMemo(() => {
    return quests
      .filter((q) => !activeProjectId || q.projectId === activeProjectId)
      .filter((q) =>
        !search ? true :
        q.name.toLowerCase().includes(search.toLowerCase()) ||
        (q.description || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [quests, activeProjectId, search]);

  const selectedQuest = projectQuests.find((q) => q.id === selectedQuestId) || null;
  const selectedSteps = useMemo(
    () => questSteps.filter((s) => s.questId === selectedQuestId),
    [questSteps, selectedQuestId]
  );

  const avCountFor = (questId: string) =>
    avRequirements.filter((av) => av.questId === questId).length;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center theme-badge-primary">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t.nav.AV_REQUIREMENTS}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              音美需求 / AV Requirements · 关联任务步骤与分镜镜头
            </p>
          </div>
        </div>
      </div>

      {!selectedQuest ? (
        <div className="glass-card p-4 space-y-3">
          {/* Search */}
          <div className="flex items-center space-x-2">
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
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {projectQuests.length} 个任务
            </span>
          </div>

          {/* Quest list */}
          {projectQuests.length === 0 ? (
            <div className="text-center py-12 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t.common.empty}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projectQuests.map((q) => {
                const count = avCountFor(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQuestId(q.id)}
                    className="glass-card p-4 text-left hover:opacity-90 transition-opacity flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
                        <Music className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {q.name}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                          {q.description || t.common.empty}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className={`theme-badge ${count > 0 ? 'theme-badge-primary' : ''} text-xs`}>
                        {count} 音美
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 mt-1 opacity-40" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Back + breadcrumb */}
          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => setSelectedQuestId(null)}
              className="opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t.nav.AV_REQUIREMENTS}
            </button>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <span style={{ color: 'var(--text-primary)' }} className="font-bold">
              {selectedQuest.name}
            </span>
          </div>

          {/* Delegate to existing quest-coupled AV editor */}
          <QuestAVRequirementsTab quest={selectedQuest} steps={selectedSteps} onRefresh={refreshData} />
        </div>
      )}
    </div>
  );
};
