import React, { useState, useEffect } from 'react';
import { Quest, Storyboard, StoryboardColumn, StoryboardRow, AVRequirement, AVType } from '../../types';
import { useApp } from '../../context/AppContext';
import { putToStore, deleteFromStore, logActivity } from '../../services/db';
import {
  Film,
  Plus,
  Trash2,
  Download,
  Upload,
  Music,
  Edit2,
  Check,
  X,
  Sparkles,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

interface QuestStoryboardViewProps {
  quest: Quest;
  onRefresh: () => void;
}

const DEFAULT_COLUMNS: StoryboardColumn[] = [
  { id: 'shotNo', label: '镜头序号 (Shot #)', type: 'number', width: 90 },
  { id: 'shotTitle', label: '景别 / 场景 (Scene)', type: 'text', width: 140 },
  { id: 'camera', label: '运镜与机位 (Camera)', type: 'text', width: 140 },
  { id: 'action', label: '画面与动作演出 (Action)', type: 'text', width: 260 },
  { id: 'dialogue', label: '台词与旁白 (Dialogue / VO)', type: 'text', width: 220 },
  { id: 'sound', label: '音效与配乐 (Sound & Music)', type: 'text', width: 180 },
  { id: 'duration', label: '时长与备注 (Duration)', type: 'text', width: 120 },
];

export const QuestStoryboardView: React.FC<QuestStoryboardViewProps> = ({ quest, onRefresh }) => {
  const { storyboards = [], avRequirements = [], showToast, refreshData } = useApp();

  // Find existing storyboard for this quest or create default
  const questStoryboards = storyboards.filter((sb) => sb.questId === quest.id);
  const activeStoryboard = questStoryboards[0] || null;

  const [columns, setColumns] = useState<StoryboardColumn[]>(
    activeStoryboard?.columns && activeStoryboard.columns.length > 0
      ? activeStoryboard.columns
      : DEFAULT_COLUMNS
  );

  const [rows, setRows] = useState<StoryboardRow[]>(
    activeStoryboard?.rows || []
  );

  const [title, setTitle] = useState(activeStoryboard?.title || `${quest.name} · 分镜台本`);
  const [description, setDescription] = useState(activeStoryboard?.description || '');

  // Column creation state
  const [isAddingCol, setIsAddingCol] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');

  // Quick Shot AV requirement state
  const [selectedShotForAV, setSelectedShotForAV] = useState<string | null>(null);
  const [shotAVTitle, setShotAVTitle] = useState('');
  const [shotAVType, setShotAVType] = useState<AVType>('SFX');
  const [shotAVModalOpen, setShotAVModalOpen] = useState(false);

  useEffect(() => {
    if (activeStoryboard) {
      setColumns(activeStoryboard.columns?.length ? activeStoryboard.columns : DEFAULT_COLUMNS);
      setRows(activeStoryboard.rows || []);
      setTitle(activeStoryboard.title || `${quest.name} · 分镜台本`);
      setDescription(activeStoryboard.description || '');
    } else {
      setColumns(DEFAULT_COLUMNS);
      setRows([]);
      setTitle(`${quest.name} · 分镜台本`);
      setDescription('');
    }
  }, [activeStoryboard, quest.id, quest.name]);

  const handleSaveStoryboard = async (updatedRows?: StoryboardRow[], updatedCols?: StoryboardColumn[]) => {
    const now = Date.now();
    const curRows = updatedRows || rows;
    const curCols = updatedCols || columns;

    const sbObj: Storyboard = {
      id: activeStoryboard ? activeStoryboard.id : `sb_${now}_${Math.random().toString(36).slice(2, 6)}`,
      projectId: quest.projectId,
      questId: quest.id,
      title: title.trim() || `${quest.name} · 分镜台本`,
      description: description.trim(),
      columns: curCols,
      rows: curRows,
      createdAt: activeStoryboard ? activeStoryboard.createdAt : now,
      updatedAt: now,
    };

    try {
      await putToStore('storyboards', sbObj);
      await logActivity(
        activeStoryboard ? 'UPDATE_STORYBOARD' : 'CREATE_STORYBOARD',
        'quest',
        `分镜表: ${sbObj.title} (${curRows.length} 镜头)`,
        quest.projectId
      );
      showToast('分镜表已保存', 'success');
      await refreshData();
      onRefresh();
    } catch (err: any) {
      showToast(`保存分镜失败: ${err.message}`, 'error');
    }
  };

  const handleAddRow = () => {
    const newRowId = `row_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const newRow: StoryboardRow = {
      id: newRowId,
      shotNumber: rows.length + 1,
      cells: {
        shotNo: String(rows.length + 1),
        shotTitle: `镜头 #${rows.length + 1}`,
        camera: '中景 / 特写',
        action: '',
        dialogue: '',
        sound: '',
        duration: '3s',
      },
    };
    const updated = [...rows, newRow];
    setRows(updated);
    handleSaveStoryboard(updated);
  };

  const handleCellChange = (rowId: string, colId: string, value: any) => {
    const updated = rows.map((r) => {
      if (r.id === rowId) {
        return {
          ...r,
          cells: {
            ...r.cells,
            [colId]: value,
          },
        };
      }
      return r;
    });
    setRows(updated);
  };

  const handleDeleteRow = (rowId: string) => {
    const updated = rows.filter((r) => r.id !== rowId);
    setRows(updated);
    handleSaveStoryboard(updated);
  };

  const handleAddColumn = () => {
    if (!newColLabel.trim()) return;
    const colKey = `col_${Date.now()}`;
    const newCol: StoryboardColumn = {
      id: colKey,
      label: newColLabel.trim(),
      type: 'text',
      width: 150,
    };
    const updatedCols = [...columns, newCol];
    setColumns(updatedCols);
    setNewColLabel('');
    setIsAddingCol(false);
    handleSaveStoryboard(rows, updatedCols);
  };

  const handleDeleteColumn = (colId: string) => {
    if (columns.length <= 1) {
      showToast('至少保留一列', 'info');
      return;
    }
    const updatedCols = columns.filter((c) => c.id !== colId);
    setColumns(updatedCols);
    handleSaveStoryboard(rows, updatedCols);
  };

  const handleExportCSV = () => {
    if (rows.length === 0) {
      showToast('分镜表暂无数据可导出', 'info');
      return;
    }
    const headers = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const csvRows = rows.map((r) => {
      return columns
        .map((c) => {
          const val = r.cells[c.id] || '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',');
    });
    const csvContent = '\uFEFF' + [headers, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${quest.name}_分镜台本.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV 导出成功', 'success');
  };

  const handleExportJSON = () => {
    const exportData = {
      questId: quest.id,
      questName: quest.name,
      columns,
      rows,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${quest.name}_分镜台本.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('JSON 导出成功', 'success');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      try {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          showToast('CSV 文件内容过少', 'error');
          return;
        }
        const headerCols = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
        const newCols: StoryboardColumn[] = headerCols.map((h, i) => ({
          id: `col_${i}_${h.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          label: h,
          type: 'text',
          width: 160,
        }));

        const newRows: StoryboardRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map((v) => v.replace(/^"|"$/g, '').trim());
          const cells: Record<string, any> = {};
          newCols.forEach((col, cIdx) => {
            cells[col.id] = vals[cIdx] || '';
          });
          newRows.push({
            id: `row_${Date.now()}_${i}`,
            shotNumber: i,
            cells,
          });
        }

        setColumns(newCols);
        setRows(newRows);
        await handleSaveStoryboard(newRows, newCols);
        showToast(`成功导入 ${newRows.length} 条分镜行`, 'success');
      } catch (err: any) {
        showToast(`解析 CSV 失败: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleCreateShotAV = async () => {
    if (!selectedShotForAV || !shotAVTitle.trim()) {
      showToast('请填写音美需求标题', 'error');
      return;
    }
    const now = Date.now();
    const req: AVRequirement = {
      id: `av_${now}_${Math.random().toString(36).slice(2, 6)}`,
      projectId: quest.projectId,
      questId: quest.id,
      shotId: selectedShotForAV,
      level: 'shot',
      title: shotAVTitle.trim(),
      type: shotAVType,
      status: 'pending',
      priority: 'medium',
      description: `关联镜头 #${selectedShotForAV}`,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    try {
      await putToStore('av_requirements', req);
      await logActivity('CREATE_AV_REQ', 'av_requirement', `[分镜级] ${req.title}`, quest.projectId);
      showToast('已成功创建分镜关联音美需求', 'success');
      setShotAVTitle('');
      setShotAVModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showToast(`创建失败: ${err.message}`, 'error');
    }
  };

  return (
    <div id="quest-storyboard-workspace" className="space-y-4 text-xs">
      {/* Top Header & Actions */}
      <div
        className="p-4 rounded-2xl glass-card flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center space-x-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs"
            style={{ background: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
          >
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span>{title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border theme-badge-secondary">
                {rows.length} 镜头行 · {columns.length} 数据列
              </span>
            </h4>
            <p className="text-[11px] opacity-70 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              任务剧情演出的动态多列分镜表；支持自定义字段、CSV/JSON 导入导出及分镜级音美提报。
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* CSV Import */}
          <label className="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:bg-black/5 flex items-center space-x-1 cursor-pointer" style={{ borderColor: 'var(--border-subtle)' }}>
            <Upload className="w-3.5 h-3.5 opacity-70" />
            <span>导入 CSV</span>
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>

          {/* Export Buttons */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:bg-black/5 flex items-center space-x-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <Download className="w-3.5 h-3.5 opacity-70" />
            <span>导出 CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:bg-black/5 flex items-center space-x-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 opacity-70" />
            <span>导出 JSON</span>
          </button>

          {/* Add Row */}
          <button
            onClick={handleAddRow}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm theme-btn-primary flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ 新增镜头行</span>
          </button>
        </div>
      </div>

      {/* Dynamic Table Grid */}
      <div
        className="rounded-2xl border overflow-hidden glass-card shadow-sm"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            {/* Table Header */}
            <thead>
              <tr
                className="border-b text-[11px] font-bold font-mono tracking-wider sticky top-0 z-10 backdrop-blur-md"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <th className="p-3 w-10 text-center">#</th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="p-3 border-l relative group"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      minWidth: col.width || 140,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{col.label}</span>
                      <button
                        onClick={() => handleDeleteColumn(col.id)}
                        className="opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-rose-500 p-0.5 ml-1 transition-all"
                        title="删除此列"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
                <th
                  className="p-3 border-l text-center w-28"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {isAddingCol ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder="新列名..."
                        value={newColLabel}
                        onChange={(e) => setNewColLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                        className="px-2 py-0.5 rounded text-[10px] glass-input w-24"
                      />
                      <button onClick={handleAddColumn} className="text-emerald-500 p-0.5">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setIsAddingCol(false)} className="opacity-50 p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingCol(true)}
                      className="px-2 py-1 rounded border text-[10px] font-bold opacity-80 hover:opacity-100 flex items-center space-x-1 mx-auto"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>新增列</span>
                    </button>
                  )}
                </th>
                <th className="p-3 border-l w-20 text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                  操作
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 3}
                    className="py-12 text-center opacity-60 italic"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    分镜表暂无镜头，点击右上角「+ 新增镜头行」开始编排剧场分镜
                  </td>
                </tr>
              ) : (
                rows.map((row, rIdx) => {
                  const shotNumber = row.cells.shotNo || String(rIdx + 1);
                  const linkedAVs = avRequirements.filter((r) => r.shotId === shotNumber || r.shotId === row.id);

                  return (
                    <tr
                      key={row.id}
                      className="border-b transition-colors hover:bg-black/5"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <td className="p-3 text-center font-mono text-[10px] opacity-60">
                        {rIdx + 1}
                      </td>

                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className="p-2 border-l"
                          style={{ borderColor: 'var(--border-subtle)' }}
                        >
                          <textarea
                            rows={col.id === 'action' || col.id === 'dialogue' ? 3 : 1}
                            value={row.cells[col.id] ?? ''}
                            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                            onBlur={() => handleSaveStoryboard()}
                            className="w-full px-2 py-1 rounded glass-input text-xs font-sans resize-y leading-snug"
                            placeholder={`录入${col.label}...`}
                          />
                        </td>
                      ))}

                      {/* Shot AV Requirement Action */}
                      <td className="p-2 border-l text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                        <button
                          onClick={() => {
                            setSelectedShotForAV(shotNumber);
                            setShotAVTitle(`[镜头 #${shotNumber}] 音效/配乐需求`);
                            setShotAVModalOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg border text-[10px] font-mono flex items-center space-x-1 mx-auto hover:bg-black/5 transition-all"
                          style={{ borderColor: 'var(--border-subtle)' }}
                          title="为本镜头提报音美需求"
                        >
                          <Music className="w-3 h-3" style={{ color: 'var(--theme-primary)' }} />
                          <span>{linkedAVs.length > 0 ? `${linkedAVs.length} 音美` : '+ 需求'}</span>
                        </button>
                      </td>

                      {/* Row Delete */}
                      <td className="p-2 border-l text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-all"
                          title="删除此行"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shot AV Requirement Modal */}
      {shotAVModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl"
            style={{
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center space-x-2">
                <Music className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
                <h4 className="font-bold text-xs font-display">提报分镜级音美需求</h4>
              </div>
              <button onClick={() => setShotAVModalOpen(false)} className="opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-medium mb-1 opacity-90">关联镜头</label>
                <input
                  type="text"
                  disabled
                  value={`镜头编号: ${selectedShotForAV}`}
                  className="w-full px-3 py-2 rounded-xl glass-input opacity-70"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">需求标题 *</label>
                <input
                  type="text"
                  required
                  placeholder="如: 爆炸轰鸣 SFX / 悲壮小提琴 SOLO"
                  value={shotAVTitle}
                  onChange={(e) => setShotAVTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">音美类型</label>
                <select
                  value={shotAVType}
                  onChange={(e) => setShotAVType(e.target.value as AVType)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                >
                  <option value="SFX">音效 (SFX)</option>
                  <option value="Music">配乐 (Music)</option>
                  <option value="Voice">配音 (Voice)</option>
                  <option value="Art">原画美术 (Art)</option>
                  <option value="VFX">特效 (VFX)</option>
                  <option value="Animation">动画 (Animation)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setShotAVModalOpen(false)}
                className="px-4 py-2 rounded-xl border opacity-70 hover:opacity-100"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateShotAV}
                className="px-5 py-2 rounded-xl font-bold shadow-md theme-btn-primary"
              >
                确定提报
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
