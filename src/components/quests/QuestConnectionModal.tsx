import React, { useState, useEffect } from 'react';
import { QuestStep, QuestConnection, QuestConnectionType } from '../../types';
import { useApp } from '../../context/AppContext';
import { putToStore, deleteFromStore, logActivity } from '../../services/db';
import { X, GitBranch, ArrowRight, Trash2 } from 'lucide-react';

interface QuestConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  questId: string;
  projectId: string;
  steps: QuestStep[];
  connection: QuestConnection | null;
  defaultFromStepId?: string;
  onSaved: () => void;
}

export const QuestConnectionModal: React.FC<QuestConnectionModalProps> = ({
  isOpen,
  onClose,
  questId,
  projectId,
  steps,
  connection,
  defaultFromStepId,
  onSaved,
}) => {
  const { showToast, refreshData } = useApp();

  const [fromStepId, setFromStepId] = useState('');
  const [toStepId, setToStepId] = useState('');
  const [type, setType] = useState<QuestConnectionType>('Next');
  const [condition, setCondition] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (connection) {
      setFromStepId(connection.fromStepId || '');
      setToStepId(connection.toStepId || '');
      setType(connection.type || 'Next');
      setCondition(connection.condition || '');
      setLabel(connection.label || '');
    } else {
      setFromStepId(defaultFromStepId || (steps[0]?.id || ''));
      setToStepId(steps[1]?.id || steps[0]?.id || '');
      setType('Next');
      setCondition('');
      setLabel('');
    }
  }, [connection, defaultFromStepId, steps, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromStepId || !toStepId) {
      showToast('请选择起点步骤与终点步骤', 'error');
      return;
    }
    const isSelfLoop = fromStepId === toStepId;

    const now = Date.now();
    const connObj: QuestConnection = {
      id: connection ? connection.id : `conn_${now}_${Math.random().toString(36).slice(2, 6)}`,
      projectId,
      questId,
      fromStepId,
      toStepId,
      type: isSelfLoop && type === 'Next' ? 'Loop' : type,
      condition: condition.trim(),
      label: label.trim() || (isSelfLoop ? '循环重试/状态维持' : ''),
      createdAt: connection ? connection.createdAt : now,
    };

    try {
      await putToStore('quest_connections', connObj);
      await logActivity(
        connection ? 'UPDATE_QUEST_CONNECTION' : 'CREATE_QUEST_CONNECTION',
        'quest',
        `连线: ${connObj.type} (${connObj.label || '无标签'})`,
        projectId
      );
      showToast('连接保存成功', 'success');
      await refreshData();
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(`保存连接失败: ${err.message}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!connection) return;
    if (window.confirm('确定要删除此流向连线吗？')) {
      try {
        await deleteFromStore('quest_connections', connection.id);
        showToast('连接已删除', 'info');
        await refreshData();
        onSaved();
        onClose();
      } catch (err: any) {
        showToast(`删除连接失败: ${err.message}`, 'error');
      }
    }
  };

  const typeLabels: Record<QuestConnectionType, { name: string; desc: string }> = {
    Next: { name: '顺承推进 (Next)', desc: '标准剧情前后顺承推进' },
    Branch: { name: '剧情分支 (Branch)', desc: '剧情在此分化为不同路线' },
    Choice: { name: '玩家抉择 (Choice)', desc: '由玩家主动选项触发的路线分支' },
    Success: { name: '成功结算 (Success)', desc: '判定/战斗/挑战成功流向' },
    Failure: { name: '失败惩罚 (Failure)', desc: '判定/战斗/逾期失败流向' },
    Ending: { name: '结局通向 (Ending)', desc: '通向剧线某一终局' },
    Merge: { name: '多线汇聚 (Merge)', desc: '多条分支剧情重新汇聚' },
    Loop: { name: '自身循环 (Loop)', desc: '节点状态维持、重试循环或自我指向' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div
        id="quest-connection-modal"
        className="w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl my-8 text-xs"
        style={{
          background: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
            <h3 className="font-bold text-sm font-display">
              {connection ? '编辑流转关系 (Connection)' : '新建步骤流转 (Connection)'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block font-medium mb-1 opacity-90">起点步骤 (From)</label>
              <select
                required
                value={fromStepId}
                onChange={(e) => setFromStepId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl glass-input truncate"
              >
                <option value="">选择起点...</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.name || '未命名步骤'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1 opacity-90">目标步骤 (To)</label>
              <select
                required
                value={toStepId}
                onChange={(e) => setToStepId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl glass-input truncate"
              >
                <option value="">选择终点...</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.name || '未命名步骤'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1 opacity-90">连接关系类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as QuestConnectionType)}
              className="w-full px-3 py-2 rounded-xl glass-input"
            >
              {(Object.keys(typeLabels) as QuestConnectionType[]).map((tKey) => (
                <option key={tKey} value={tKey}>
                  {typeLabels[tKey].name} - {typeLabels[tKey].desc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1 opacity-90">连线文案 / 选项描述 (Label)</label>
            <input
              type="text"
              placeholder="如: 选择「挺身而出」 / 信任密使"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input"
            />
          </div>

          <div>
            <label className="block font-medium mb-1 opacity-90">触发 / 判定条件 (Condition)</label>
            <input
              type="text"
              placeholder="如: 拥有「龙纹玉佩」 或 战胜守卫"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            {connection ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除连接</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border opacity-70 hover:opacity-100 hover:bg-black/5"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl font-bold shadow-md transition-all active:scale-95 theme-btn-primary"
              >
                保存连接
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
