import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Sparkles,
  Download,
  AlertCircle,
  CheckCircle2,
  PieChart as PieIcon,
  Activity,
  HeartHandshake,
  GitBranch,
  MapPin,
  Flame,
  FileText,
  Music,
  Compass,
  Users,
  Layers,
  Save,
  Trash2,
  RotateCcw,
  BookOpen,
  ArrowRight,
  X,
  Target,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { computeNarrativeMetrics, NarrativeAnalysisMetrics } from '../services/analysisEngine';
import { AnalysisRecord } from '../types';
import { putToStore, deleteFromStore, logActivity } from '../services/db';

export const AnalysisView: React.FC = () => {
  const {
    t,
    documents = [],
    characters = [],
    quests = [],
    questSteps = [],
    questConnections = [],
    narrativeCopy = [],
    storyboards = [],
    avRequirements = [],
    locations = [],
    themes = [],
    timeline = [],
    annotations = [],
    analyses = [],
    activeProjectId,
    analysisTarget,
    setAnalysisTarget,
    showToast,
    refreshData,
  } = useApp();

  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');

  // Target Filter State (defaults to analysisTarget if set, otherwise 'project')
  const [selectedTargetType, setSelectedTargetType] = useState<string>(
    analysisTarget?.entityType || 'project'
  );
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    analysisTarget?.entityId || 'all'
  );

  // Compute Base Metrics
  const baseMetrics: NarrativeAnalysisMetrics = useMemo(() => {
    return computeNarrativeMetrics(
      documents,
      characters,
      quests,
      locations,
      themes,
      annotations,
      timeline,
      activeProjectId || undefined
    );
  }, [documents, characters, quests, locations, themes, annotations, timeline, activeProjectId]);

  // Branching complexity calculations
  const branchingMetrics = useMemo(() => {
    const relevantSteps = selectedTargetId !== 'all' && selectedTargetType === 'quest'
      ? questSteps.filter((s) => s.questId === selectedTargetId)
      : questSteps;

    const relevantConns = selectedTargetId !== 'all' && selectedTargetType === 'quest'
      ? questConnections.filter((c) => c.questId === selectedTargetId)
      : questConnections;

    const branches = relevantConns.filter((c) => c.type === 'Branch').length;
    const choices = relevantConns.filter((c) => c.type === 'Choice').length;
    const merges = relevantConns.filter((c) => c.type === 'Merge').length;
    const endings = relevantConns.filter((c) => c.type === 'Ending').length;

    return {
      totalSteps: relevantSteps.length,
      totalConnections: relevantConns.length,
      branches,
      choices,
      merges,
      endings,
      branchingFactor: relevantSteps.length > 0 ? (relevantConns.length / relevantSteps.length).toFixed(2) : '1.00',
    };
  }, [questSteps, questConnections, selectedTargetId, selectedTargetType]);

  // Narrative Copy Coverage Breakdown
  const copyMetrics = useMemo(() => {
    const total = narrativeCopy.length;
    const ui = narrativeCopy.filter((c) => c.category === 'system_ui').length;
    const item = narrativeCopy.filter((c) => c.category === 'item_lore').length;
    const dialogue = narrativeCopy.filter((c) => c.category === 'dialogue').length;
    const world = narrativeCopy.filter((c) => c.category === 'world_lore').length;
    const skill = narrativeCopy.filter((c) => c.category === 'skill_desc').length;
    const totalWords = narrativeCopy.reduce((acc, c) => acc + (c.content?.length || 0) + (c.flavorText?.length || 0), 0);

    return { total, ui, item, dialogue, world, skill, totalWords };
  }, [narrativeCopy]);

  // AV Requirements Metrics
  const avMetrics = useMemo(() => {
    const total = avRequirements.length;
    const completed = avRequirements.filter((r) => r.status === 'completed').length;
    const inProgress = avRequirements.filter((r) => r.status === 'in_progress').length;
    const pending = avRequirements.filter((r) => r.status === 'pending').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 100;

    return { total, completed, inProgress, pending, rate };
  }, [avRequirements]);

  // Automated Diagnostic Issues
  const diagnosticIssues = useMemo(() => {
    const issues: Array<{ id: string; type: 'warning' | 'info' | 'success'; message: string }> = [];

    // Check 1: Quests with no steps
    const emptyQuests = quests.filter(
      (q) => !questSteps.some((s) => s.questId === q.id)
    );
    if (emptyQuests.length > 0) {
      issues.push({
        id: 'empty_quests',
        type: 'warning',
        message: `存在 ${emptyQuests.length} 条尚未编排步骤节点的剧情线 (${emptyQuests.map((q) => q.name).slice(0, 2).join('、')}${emptyQuests.length > 2 ? '等' : ''})`,
      });
    }

    // Check 2: Unresolved foreshadowing
    if (baseMetrics.foreshadowingResolvedRate < 0.3 && annotations.length > 0) {
      issues.push({
        id: 'low_foreshadowing',
        type: 'info',
        message: `当前伏笔回收率为 ${Math.round(baseMetrics.foreshadowingResolvedRate * 100)}%，建议在后续章节安排线索收束`,
      });
    }

    // Check 3: AV backlog
    if (avMetrics.pending > 3) {
      issues.push({
        id: 'av_backlog',
        type: 'warning',
        message: `有 ${avMetrics.pending} 项音美需求处于「待排期」状态，请及时指派负责人推进`,
      });
    }

    // Check 4: Character dialogue coverage
    const silentChars = characters.filter((c) => !c.dialogues || c.dialogues.length === 0);
    if (silentChars.length > 0 && characters.length > 2) {
      issues.push({
        id: 'silent_chars',
        type: 'info',
        message: `有 ${silentChars.length} 名角色尚无经典台词收录 (${silentChars.map((c) => c.name).slice(0, 3).join('、')})`,
      });
    }

    if (issues.length === 0) {
      issues.push({
        id: 'all_good',
        type: 'success',
        message: '项目剧情连贯性与资源配置状态优异，未检测到结构性断层。',
      });
    }

    return issues;
  }, [quests, questSteps, baseMetrics, annotations, avMetrics, characters]);

  // Overall Health Score
  const healthScore = Math.min(
    100,
    Math.round(
      (baseMetrics.totalWords > 0 ? 25 : 5) +
      (characters.length >= 3 ? 15 : characters.length * 5) +
      (quests.length >= 2 ? 20 : quests.length * 10) +
      (questSteps.length >= 4 ? 20 : questSteps.length * 4) +
      (narrativeCopy.length >= 2 ? 10 : narrativeCopy.length * 5) +
      (avMetrics.rate >= 50 ? 10 : 5)
    )
  );

  const handleSaveAnalysisSnapshot = async () => {
    const now = Date.now();
    const targetName =
      selectedTargetType === 'quest'
        ? quests.find((q) => q.id === selectedTargetId)?.name || '指定任务'
        : selectedTargetType === 'narrative_copy'
        ? narrativeCopy.find((c) => c.id === selectedTargetId)?.title || '指定文本包装'
        : '全项目宏观分析';

    const snapshotTitle = reportTitle.trim() || `${targetName} · 叙事深度分析报告 (${new Date().toLocaleDateString()})`;

    const record: AnalysisRecord = {
      id: `analysis_${now}_${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProjectId || '',
      title: snapshotTitle,
      targetType: selectedTargetType as any,
      targetId: selectedTargetId !== 'all' ? selectedTargetId : undefined,
      targetName,
      metrics: {
        healthScore,
        baseMetrics,
        branchingMetrics,
        copyMetrics,
        avMetrics,
      },
      insights: diagnosticIssues.map((i) => i.message),
      recommendations: [
        '优化高潮节点前后的节奏曲线过渡',
        '确保关键抉择分支具有对应结局或剧情反转后果',
        '保持道具与技能文案的世界观叙事风格一致性',
      ],
      createdAt: now,
      updatedAt: now,
    };

    try {
      await putToStore('analyses', record);
      await logActivity('SAVE_ANALYSIS', 'analysis', record.title, activeProjectId || undefined);
      showToast('分析快照已成功归档保存', 'success');
      setReportTitle('');
      await refreshData();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleDeleteAnalysis = async (id: string) => {
    if (window.confirm('确定要删除此分析报告记录吗？')) {
      await deleteFromStore('analyses', id);
      showToast('已删除分析记录', 'info');
      await refreshData();
    }
  };

  const handleExportJSON = () => {
    const exportData = {
      projectId: activeProjectId,
      timestamp: new Date().toISOString(),
      healthScore,
      branchingMetrics,
      copyMetrics,
      avMetrics,
      baseMetrics,
      diagnosticIssues,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Narrative_Analysis_Report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出叙事分析体检报告', 'success');
  };

  return (
    <div id="analysis-view-workspace" className="space-y-6 pb-12 text-xs" style={{ color: 'var(--text-primary)' }}>
      {/* Target Focus Banner */}
      {analysisTarget && (
        <div
          className="p-3.5 rounded-2xl border glass-card flex items-center justify-between gap-3 animate-in fade-in"
          style={{
            background: 'var(--theme-secondary-bg)',
            borderColor: 'var(--theme-primary)',
          }}
        >
          <div className="flex items-center space-x-2.5">
            <Target className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
            <div>
              <span className="font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                定向聚焦分析: {analysisTarget.entityName}
              </span>
              <span className="text-[10px] opacity-75 font-mono ml-2">
                [{analysisTarget.entityType.toUpperCase()}]
              </span>
            </div>
          </div>

          <button
            onClick={() => setAnalysisTarget(null)}
            className="px-2.5 py-1 rounded-xl text-[10px] font-bold border hover:bg-black/5 flex items-center space-x-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <X className="w-3 h-3" />
            <span>返回全景视角</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
            <span>{t.analysis.title}</span>
          </h2>
          <p className="text-xs opacity-75 mt-1" style={{ color: 'var(--text-secondary)' }}>
            实时纯前端算法多维审视：张力曲线、分支拓扑、文案覆盖、音美进度与剧情结构诊断。
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Target Filter */}
          <select
            value={selectedTargetType}
            onChange={(e) => {
              setSelectedTargetType(e.target.value);
              setSelectedTargetId('all');
            }}
            className="px-3 py-1.5 rounded-xl glass-input text-xs"
          >
            <option value="project">分析范围: 全项目</option>
            <option value="quest">分析范围: 指定剧情线</option>
            <option value="narrative_copy">分析范围: 文本包装</option>
          </select>

          {selectedTargetType === 'quest' && (
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="px-3 py-1.5 rounded-xl glass-input text-xs"
            >
              <option value="all">所有任务</option>
              {quests.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleExportJSON}
            className="px-3.5 py-1.5 rounded-xl border text-xs font-medium flex items-center space-x-1.5 hover:bg-black/5"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <Download className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
            <span>导出报告</span>
          </button>

          <button
            onClick={handleSaveAnalysisSnapshot}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md theme-btn-primary flex items-center space-x-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存分析快照</span>
          </button>
        </div>
      </div>

      {/* Top 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Health Score */}
        <div className="p-5 rounded-2xl glass-card border flex flex-col justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs opacity-75" style={{ color: 'var(--text-secondary)' }}>{t.analysis.healthScore}</span>
            <Activity className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono" style={{ color: 'var(--theme-primary)' }}>
              {healthScore}
            </span>
            <span className="text-xs font-mono opacity-75" style={{ color: 'var(--text-secondary)' }}>/ 100</span>
          </div>
          <p className="text-[11px] opacity-75 mt-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
            状态评级: <span className="font-bold" style={{ color: 'var(--theme-primary)' }}>{healthScore >= 80 ? '结构坚实稳固' : '持续丰满中'}</span>
          </p>
        </div>

        {/* Branching Factor */}
        <div className="p-5 rounded-2xl glass-card border flex flex-col justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs opacity-75" style={{ color: 'var(--text-secondary)' }}>剧情分支复杂度</span>
            <GitBranch className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
              {branchingMetrics.branchingFactor}x
            </span>
            <span className="text-xs opacity-75 font-mono" style={{ color: 'var(--text-secondary)' }}>分支系数</span>
          </div>
          <p className="text-[11px] opacity-75 mt-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
            {branchingMetrics.totalSteps} 步骤 · {branchingMetrics.branches} 分支 · {branchingMetrics.endings} 终局
          </p>
        </div>

        {/* Narrative Copy Words */}
        <div className="p-5 rounded-2xl glass-card border flex flex-col justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs opacity-75" style={{ color: 'var(--text-secondary)' }}>文本包装体量</span>
            <FileText className="w-4 h-4" style={{ color: 'var(--theme-secondary)' }} />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
              {copyMetrics.totalWords.toLocaleString()}
            </span>
            <span className="text-xs opacity-75 font-mono" style={{ color: 'var(--text-secondary)' }}>字符</span>
          </div>
          <p className="text-[11px] opacity-75 mt-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
            涵盖 {copyMetrics.total} 条 UI / 道具 / 技能词条
          </p>
        </div>

        {/* AV Fulfillment */}
        <div className="p-5 rounded-2xl glass-card border flex flex-col justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs opacity-75" style={{ color: 'var(--text-secondary)' }}>音美交付完成率</span>
            <Music className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
              {avMetrics.rate}%
            </span>
            <span className="text-xs opacity-75 font-mono" style={{ color: 'var(--text-secondary)' }}>已验收</span>
          </div>
          <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${avMetrics.rate}%`,
                background: 'var(--theme-primary)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Visualizers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Narrative Tension Progression Curve */}
        <div className="lg:col-span-8 p-6 rounded-2xl glass-card border space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t.analysis.sentimentCurve}</h3>
            </div>
            <span className="text-[11px] opacity-75 font-mono" style={{ color: 'var(--text-secondary)' }}>剧情张力演进 (0~100)</span>
          </div>

          <div
            className="h-64 flex items-end space-x-3 pt-6 pb-2 px-4 rounded-xl border relative overflow-x-auto"
            style={{
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {baseMetrics.narrativeDensityCurve.map((item, idx) => (
              <div
                key={idx}
                className="flex-1 min-w-[50px] flex flex-col items-center justify-end h-full group relative"
              >
                <div
                  className="w-full rounded-t opacity-80 group-hover:opacity-100 transition-all shadow-sm"
                  style={{
                    height: `${Math.max(10, item.tension)}%`,
                    background: 'var(--theme-primary)',
                  }}
                />
                <span className="text-[10px] opacity-75 font-mono mt-1.5 truncate max-w-[60px]" style={{ color: 'var(--text-secondary)' }}>
                  {item.point}
                </span>

                {/* Tooltip */}
                <div
                  className="absolute -top-10 border px-2.5 py-1 rounded-lg text-[10px] opacity-0 group-hover:opacity-100 transition-opacity font-mono pointer-events-none z-10 shadow-lg whitespace-nowrap"
                  style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  张力: {item.tension} | 对白: {item.dialogue}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Automated Narrative Diagnostic Radar */}
        <div className="lg:col-span-4 p-6 rounded-2xl glass-card border space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center space-x-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>剧情架构智能诊断</h3>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {diagnosticIssues.map((issue) => (
              <div
                key={issue.id}
                className={`p-3 rounded-xl border flex items-start space-x-2 text-[11px] leading-relaxed ${
                  issue.type === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : issue.type === 'info'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}
              >
                {issue.type === 'warning' ? (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : issue.type === 'info' ? (
                  <Activity className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lower Row: Saved Analyses Snapshots & Character Density */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Saved Snapshots in Store */}
        <div className="lg:col-span-7 p-6 rounded-2xl glass-card border space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>已归档的深度分析快照 ({analyses.length})</h3>
            </div>
            <span className="text-[10px] opacity-60 font-mono">存储于 analyses 集合</span>
          </div>

          {analyses.length === 0 ? (
            <div className="py-8 text-center opacity-60 italic">
              暂无已保存的分析快照，点击右上角「保存分析快照」进行归档记录。
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {analyses.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl border flex items-center justify-between text-xs group hover:bg-black/5 transition-all"
                  style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <h5 className="font-bold truncate font-display" style={{ color: 'var(--text-primary)' }}>
                      {rec.title}
                    </h5>
                    <p className="text-[10px] opacity-60 font-mono">
                      目标: {rec.targetName || '全项目'} · 创建于 {new Date(rec.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteAnalysis(rec.id)}
                    className="p-1 text-rose-500 opacity-60 hover:opacity-100"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Character Density List */}
        <div className="lg:col-span-5 p-6 rounded-2xl glass-card border space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center space-x-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <HeartHandshake className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t.analysis.characterFocus}</h3>
          </div>

          {baseMetrics.characterPresence.length === 0 ? (
            <div className="py-8 text-center text-xs opacity-60">暂无角色出场频次统计</div>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {baseMetrics.characterPresence.slice(0, 5).map((c, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                    <span className="opacity-75" style={{ color: 'var(--text-secondary)' }}>
                      {c.appearances} 次出场 · {c.dialogueCount} 台词
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, c.appearances * 20)}%`,
                        background: 'var(--theme-primary)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
