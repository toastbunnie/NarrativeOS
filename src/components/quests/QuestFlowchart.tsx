import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Quest,
  QuestStep,
  QuestConnection,
  QuestConnectionType,
  QuestStepType,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { putToStore, logActivity } from '../../services/db';
import {
  Plus,
  GitBranch,
  ArrowRight,
  Users,
  MapPin,
  Music,
  Edit3,
  Link as LinkIcon,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutGrid,
  Zap,
  Repeat,
  GripHorizontal,
  X,
} from 'lucide-react';
import { QuestStepModal } from './QuestStepModal';
import { QuestConnectionModal } from './QuestConnectionModal';

const NODE_SIZE = 220; // 220px x 220px exact square box

interface QuestFlowchartProps {
  quest: Quest;
  steps: QuestStep[];
  connections: QuestConnection[];
  onRefresh: () => void;
}

export const QuestFlowchart: React.FC<QuestFlowchartProps> = ({
  quest,
  steps,
  connections,
  onRefresh,
}) => {
  const { avRequirements = [], showToast, refreshData } = useApp();

  // Local positions cache for smooth dragging
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  
  // Canvas Viewport Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging Node State
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number }>({
    mouseX: 0,
    mouseY: 0,
    nodeX: 0,
    nodeY: 0,
  });

  // Interactive Connect Mode (Click port -> Click target node or self)
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [cursorCanvasPos, setCursorCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Modals
  const [selectedStepForEdit, setSelectedStepForEdit] = useState<QuestStep | null>(null);
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [selectedConnForEdit, setSelectedConnForEdit] = useState<QuestConnection | null>(null);
  const [connModalOpen, setConnModalOpen] = useState(false);
  const [defaultFromStepId, setDefaultFromStepId] = useState<string | undefined>(undefined);
  const [defaultToStepId, setDefaultToStepId] = useState<string | undefined>(undefined);

  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse Wheel Smooth Zoom with Fixed Outer Viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((currentZoom) => {
        const targetZoom = Math.min(2.0, Math.max(0.3, Number((currentZoom * zoomFactor).toFixed(2))));
        if (targetZoom !== currentZoom) {
          const ratio = targetZoom / currentZoom;
          setPan((currentPan) => ({
            x: cursorX - (cursorX - currentPan.x) * ratio,
            y: cursorY - (cursorY - currentPan.y) * ratio,
          }));
          return targetZoom;
        }
        return currentZoom;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Initialize node positions (Grid or saved position)
  useEffect(() => {
    const newPositions: Record<string, { x: number; y: number }> = {};
    const cols = Math.max(3, Math.ceil(Math.sqrt(steps.length * 1.5)));
    
    steps.forEach((step, index) => {
      if (step.position && typeof step.position.x === 'number' && typeof step.position.y === 'number') {
        newPositions[step.id] = { x: step.position.x, y: step.position.y };
      } else if (nodePositions[step.id]) {
        newPositions[step.id] = nodePositions[step.id];
      } else {
        const col = index % cols;
        const row = Math.floor(index / cols);
        newPositions[step.id] = {
          x: 50 + col * (NODE_SIZE + 90),
          y: 50 + row * (NODE_SIZE + 90),
        };
      }
    });

    setNodePositions(newPositions);
  }, [steps]);

  // Connection Style Definition
  const connTypeStyles: Record<
    QuestConnectionType,
    { label: string; bg: string; text: string; border: string; stroke: string }
  > = {
    Next: { label: '顺承', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30', stroke: '#10b981' },
    Branch: { label: '分支', bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30', stroke: '#a855f7' },
    Choice: { label: '抉择', bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30', stroke: '#f59e0b' },
    Success: { label: '成功', bg: 'bg-teal-500/10', text: 'text-teal-500', border: 'border-teal-500/30', stroke: '#14b8a6' },
    Failure: { label: '失败', bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/30', stroke: '#f43f5e' },
    Ending: { label: '终局', bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/30', stroke: '#6366f1' },
    Merge: { label: '汇聚', bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/30', stroke: '#06b6d4' },
    Loop: { label: '循环', bg: 'bg-pink-500/10', text: 'text-pink-500', border: 'border-pink-500/30', stroke: '#ec4899' },
  };

  const stepTypeBadges: Record<QuestStepType, { label: string; color: string }> = {
    normal: { label: 'Normal 推进', color: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' },
    start: { label: 'Start 起点', color: 'border-blue-500/40 text-blue-600 bg-blue-500/10' },
    action: { label: 'Action 行动', color: 'border-cyan-500/40 text-cyan-600 bg-cyan-500/10' },
    dialogue: { label: 'Dialogue 对白', color: 'border-teal-500/40 text-teal-600 bg-teal-500/10' },
    branch: { label: 'Branch 分支', color: 'border-purple-500/40 text-purple-600 bg-purple-500/10' },
    choice: { label: 'Choice 抉择', color: 'border-amber-500/40 text-amber-600 bg-amber-500/10' },
    puzzle: { label: 'Puzzle 解谜', color: 'border-yellow-500/40 text-yellow-600 bg-yellow-500/10' },
    battle: { label: 'Battle 战斗', color: 'border-orange-500/40 text-orange-600 bg-orange-500/10' },
    climax: { label: 'Climax 高潮', color: 'border-rose-500/40 text-rose-600 bg-rose-500/10' },
    ending: { label: 'Ending 终局', color: 'border-indigo-500/40 text-indigo-600 bg-indigo-500/10' },
  };

  const stepMap = useMemo(() => {
    const map = new Map<string, QuestStep>();
    steps.forEach((s) => map.set(s.id, s));
    return map;
  }, [steps]);

  // Self Loops & Topology Stats
  const selfLoopsCount = useMemo(() => {
    return connections.filter((c) => c.fromStepId === c.toStepId || c.type === 'Loop').length;
  }, [connections]);

  // Calculate Square Box Edge Intersection
  const getBoxEdgePoint = useCallback((
    centerFrom: { x: number; y: number },
    centerTo: { x: number; y: number },
    halfSize: number = NODE_SIZE / 2
  ) => {
    const dx = centerTo.x - centerFrom.x;
    const dy = centerTo.y - centerFrom.y;
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
      return { x: centerFrom.x, y: centerFrom.y - halfSize };
    }
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx > absDy) {
      const signX = dx > 0 ? 1 : -1;
      const x = centerFrom.x + signX * halfSize;
      const y = centerFrom.y + (dy / absDx) * halfSize;
      return { x, y };
    } else {
      const signY = dy > 0 ? 1 : -1;
      const y = centerFrom.y + signY * halfSize;
      const x = centerFrom.x + (dx / absDy) * halfSize;
      return { x, y };
    }
  }, []);

  // Compute SVG Connection Geometry
  const renderedConnections = useMemo(() => {
    return connections.map((conn) => {
      const fromPos = nodePositions[conn.fromStepId];
      const toPos = nodePositions[conn.toStepId];

      if (!fromPos || !toPos) return null;

      const isSelfLoop = conn.fromStepId === conn.toStepId || conn.type === 'Loop';
      const style = connTypeStyles[conn.type] || connTypeStyles.Next;

      if (isSelfLoop) {
        // Self-to-Self Loop Geometry on Square box top-right
        const startX = fromPos.x + NODE_SIZE - 35;
        const startY = fromPos.y;
        const endX = fromPos.x + NODE_SIZE;
        const endY = fromPos.y + 40;

        const path = `M ${startX} ${startY} C ${fromPos.x + NODE_SIZE + 10} ${fromPos.y - 50}, ${fromPos.x + NODE_SIZE + 60} ${fromPos.y - 30}, ${fromPos.x + NODE_SIZE + 60} ${fromPos.y + 20} C ${fromPos.x + NODE_SIZE + 60} ${fromPos.y + 42}, ${fromPos.x + NODE_SIZE + 25} ${fromPos.y + 42}, ${endX} ${endY}`;
        const midX = fromPos.x + NODE_SIZE + 48;
        const midY = fromPos.y - 12;

        return {
          conn,
          path,
          midX,
          midY,
          style,
          isSelfLoop: true,
          fromPos,
          toPos,
        };
      }

      // Inter-Node Connection Geometry
      const fromCenter = { x: fromPos.x + NODE_SIZE / 2, y: fromPos.y + NODE_SIZE / 2 };
      const toCenter = { x: toPos.x + NODE_SIZE / 2, y: toPos.y + NODE_SIZE / 2 };

      const start = getBoxEdgePoint(fromCenter, toCenter, NODE_SIZE / 2);
      const end = getBoxEdgePoint(toCenter, fromCenter, NODE_SIZE / 2);

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy);

      // Smooth Cubic Bezier
      const curvature = Math.min(60, distance * 0.25);
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;

      let path = '';
      if (Math.abs(dx) > Math.abs(dy)) {
        path = `M ${start.x} ${start.y} C ${start.x + dx * 0.4} ${start.y}, ${end.x - dx * 0.4} ${end.y}, ${end.x} ${end.y}`;
      } else {
        path = `M ${start.x} ${start.y} C ${start.x} ${start.y + dy * 0.4}, ${end.x} ${end.y - dy * 0.4}, ${end.x} ${end.y}`;
      }

      return {
        conn,
        path,
        midX,
        midY,
        style,
        isSelfLoop: false,
        fromPos,
        toPos,
      };
    }).filter(Boolean);
  }, [connections, nodePositions, getBoxEdgePoint]);

  // Node Drag Handlers
  const handleNodeMouseDown = (e: React.MouseEvent, stepId: string) => {
    e.stopPropagation();
    if (connectingFromId) return; // In connecting mode, don't drag

    const currentPos = nodePositions[stepId] || { x: 0, y: 0 };
    setDraggingStepId(stepId);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: currentPos.x,
      nodeY: currentPos.y,
    };
  };

  // Canvas Pan Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current && !(e.target as HTMLElement).classList.contains('canvas-background-layer')) {
      return;
    }
    if (connectingFromId) {
      // Cancel connecting mode on canvas click
      setConnectingFromId(null);
      return;
    }
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  // Global Mouse Move & Up
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Update cursor position in canvas coordinate space for interactive connection wire
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
        const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;
        setCursorCanvasPos({ x: mouseCanvasX, y: mouseCanvasY });
      }

      if (isPanning) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
      } else if (draggingStepId) {
        const deltaX = (e.clientX - dragStartRef.current.mouseX) / zoom;
        const deltaY = (e.clientY - dragStartRef.current.mouseY) / zoom;
        
        setNodePositions((prev) => ({
          ...prev,
          [draggingStepId]: {
            x: Math.max(10, Math.round(dragStartRef.current.nodeX + deltaX)),
            y: Math.max(10, Math.round(dragStartRef.current.nodeY + deltaY)),
          },
        }));
      }
    };

    const handleMouseUp = async () => {
      if (isPanning) {
        setIsPanning(false);
      }
      if (draggingStepId) {
        const stepToUpdate = stepMap.get(draggingStepId);
        const finalPos = nodePositions[draggingStepId];
        setDraggingStepId(null);

        if (stepToUpdate && finalPos) {
          const updatedStep: QuestStep = {
            ...stepToUpdate,
            position: { x: finalPos.x, y: finalPos.y },
            updatedAt: Date.now(),
          };
          try {
            await putToStore('quest_steps', updatedStep);
          } catch (err) {
            console.error('Failed to persist node position', err);
          }
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, draggingStepId, pan, zoom, nodePositions, stepMap]);

  // Connect Mode Node Click
  const handleNodeConnectClick = (e: React.MouseEvent, stepId: string) => {
    e.stopPropagation();
    if (!connectingFromId) {
      // Start connecting mode from this node
      setConnectingFromId(stepId);
      showToast('🔗 请点击目标节点（点击自身可创建循环回路），或按 ESC 取消', 'info');
    } else {
      // Finish connecting mode: Open Connection modal
      const fromId = connectingFromId;
      const toId = stepId;
      setConnectingFromId(null);

      setSelectedConnForEdit(null);
      setDefaultFromStepId(fromId);
      setDefaultToStepId(toId);
      setConnModalOpen(true);
    }
  };

  // Cancel connect mode on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connectingFromId) {
        setConnectingFromId(null);
        showToast('已取消连线操作', 'info');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectingFromId, showToast]);

  // Auto Layout Intelligent Grid / Tree
  const handleAutoLayout = async () => {
    if (steps.length === 0) return;
    
    // Sort steps topologically or by orderIndex
    const sorted = [...steps].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    const newPosMap: Record<string, { x: number; y: number }> = {};
    
    const cols = Math.max(3, Math.ceil(Math.sqrt(steps.length * 1.5)));
    
    for (let i = 0; i < sorted.length; i++) {
      const step = sorted[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const newX = 50 + col * (NODE_SIZE + 80);
      const newY = 50 + row * (NODE_SIZE + 80);
      newPosMap[step.id] = { x: newX, y: newY };

      const updatedStep: QuestStep = {
        ...step,
        position: { x: newX, y: newY },
        updatedAt: Date.now(),
      };
      await putToStore('quest_steps', updatedStep);
    }

    setNodePositions(newPosMap);
    showToast('✨ 已完成剧情方块节点自动排布', 'success');
    await refreshData();
    onRefresh();
  };

  // Auto Connect Sequential
  const handleAutoConnectSequential = async () => {
    if (steps.length < 2) {
      showToast('至少需要2个步骤才能建立顺承连线', 'info');
      return;
    }
    const now = Date.now();
    let createdCount = 0;
    for (let i = 0; i < steps.length - 1; i++) {
      const from = steps[i];
      const to = steps[i + 1];
      const alreadyExists = connections.some((c) => c.fromStepId === from.id && c.toStepId === to.id);
      if (!alreadyExists) {
        const connObj: QuestConnection = {
          id: `conn_${now}_${i}_${Math.random().toString(36).slice(2, 5)}`,
          projectId: quest.projectId,
          questId: quest.id,
          fromStepId: from.id,
          toStepId: to.id,
          type: 'Next',
          label: `顺承至 ${to.title || '下一步骤'}`,
          createdAt: now + i,
        };
        await putToStore('quest_connections', connObj);
        createdCount++;
      }
    }
    if (createdCount > 0) {
      showToast(`已自动建立 ${createdCount} 条顺承连线`, 'success');
      await refreshData();
      onRefresh();
    } else {
      showToast('当前步骤之间已有连线', 'info');
    }
  };

  const handleOpenEditStep = (step: QuestStep) => {
    setSelectedStepForEdit(step);
    setStepModalOpen(true);
  };

  const handleOpenEditConnection = (conn: QuestConnection) => {
    setSelectedConnForEdit(conn);
    setDefaultFromStepId(conn.fromStepId);
    setDefaultToStepId(conn.toStepId);
    setConnModalOpen(true);
  };

  const handleOpenNewStep = () => {
    setSelectedStepForEdit(null);
    setStepModalOpen(true);
  };

  return (
    <div id="twine-quest-flowchart" className="space-y-3">
      {/* Top Toolbar */}
      <div
        className="p-3.5 rounded-2xl glass-card flex flex-wrap items-center justify-between gap-3 shadow-sm border"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center space-x-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-inner"
            style={{ background: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
          >
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span>Twine 自由布局节点网络 (Freeform Node Canvas)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border theme-badge-secondary">
                {steps.length} 个正方形方框 · {connections.length} 条箭头连线
              </span>
              {selfLoopsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  <span>{selfLoopsCount} 个自身循环</span>
                </span>
              )}
            </h4>
            <p className="text-[11px] opacity-70 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              自由拖拽正方形节点摆放；支持 1对多 分支、多对1 汇聚、自身循环回路与音美标记联动。
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Zoom & Reset Tools */}
          <div className="flex items-center space-x-1 p-1 rounded-xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg hover:bg-black/5 active:scale-95 transition-all"
              title="缩小 (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
            </button>
            <span className="text-[10px] font-mono font-bold px-1.5 min-w-[40px] text-center" style={{ color: 'var(--text-primary)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg hover:bg-black/5 active:scale-95 transition-all"
              title="放大 (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 40, y: 40 });
              }}
              className="p-1.5 rounded-lg hover:bg-black/5 active:scale-95 transition-all"
              title="重置视角 (Reset View)"
            >
              <RotateCcw className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>

          <button
            onClick={handleAutoLayout}
            className="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:bg-black/5 flex items-center space-x-1"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            title="一键智能排布方块节点"
          >
            <LayoutGrid className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
            <span>智能排布</span>
          </button>

          {steps.length >= 2 && connections.length === 0 && (
            <button
              onClick={handleAutoConnectSequential}
              className="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:bg-black/5 flex items-center space-x-1"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>顺承串联</span>
            </button>
          )}

          <button
            onClick={handleOpenNewStep}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 theme-btn-primary flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>添加方框节点</span>
          </button>
        </div>
      </div>

      {/* Connecting Mode Banner */}
      {connectingFromId && (
        <div 
          className="p-2.5 rounded-2xl border flex items-center justify-between text-xs animate-pulse"
          style={{
            background: 'var(--theme-secondary-bg)',
            borderColor: 'var(--theme-primary)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-center space-x-2">
            <LinkIcon className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
            <span>
              已选定起点方块 <strong>「{stepMap.get(connectingFromId)?.title || '未命名'}」</strong>：请点击任意目标方块以完成连线（点击自身可创建循环连线）。
            </span>
          </div>
          <button
            onClick={() => setConnectingFromId(null)}
            className="px-2 py-1 rounded-lg border font-bold text-[11px] hover:bg-black/10 flex items-center gap-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <X className="w-3 h-3" />
            <span>取消</span>
          </button>
        </div>
      )}

      {/* Interactive Infinite Canvas Container */}
      {steps.length === 0 ? (
        <div
          className="p-16 text-center rounded-3xl border border-dashed flex flex-col items-center justify-center space-y-4"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <GitBranch className="w-12 h-12 opacity-25" style={{ color: 'var(--theme-primary)' }} />
          <div>
            <h5 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              暂无剧情方块节点
            </h5>
            <p className="text-xs opacity-60 mt-1 max-w-md" style={{ color: 'var(--text-secondary)' }}>
              点击下方按钮创建第一个 Twine 正方形节点，开启自由拖拽摆放与多对多/循环箭头连线编排。
            </p>
          </div>
          <button
            onClick={handleOpenNewStep}
            className="px-5 py-2.5 rounded-2xl text-xs font-bold shadow-lg theme-btn-primary flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>创建首个方块节点</span>
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          onMouseDown={handleCanvasMouseDown}
          className="relative w-full h-[620px] max-h-[620px] rounded-3xl border overflow-hidden select-none cursor-grab active:cursor-grabbing flowchart-canvas-bg"
          style={{
            height: '620px',
            maxHeight: '620px',
            minHeight: '620px',
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-canvas)',
          }}
        >
          {/* Transform Layer for Zoom & Pan */}
          <div
            className="absolute inset-0 origin-top-left will-change-transform"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: '4000px',
              height: '4000px',
            }}
          >
            {/* SVG Arrow Connections Layer */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              <defs>
                {/* Dynamic Arrow Markers */}
                {Object.entries(connTypeStyles).map(([typeKey, cfg]) => (
                  <marker
                    key={typeKey}
                    id={`arrow-${typeKey}`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill={cfg.stroke} />
                  </marker>
                ))}

                {/* Connecting Drag Line Marker */}
                <marker
                  id="arrow-connecting"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--theme-primary)" />
                </marker>
              </defs>

              {/* Render All Established Connection Lines */}
              {renderedConnections.map((rc) => {
                if (!rc) return null;
                const { conn, path, midX, midY, style, isSelfLoop } = rc;

                return (
                  <g key={conn.id} className="pointer-events-auto group">
                    {/* Shadow / Click Area Line */}
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="18"
                      className="cursor-pointer"
                      onClick={() => handleOpenEditConnection(conn)}
                    />
                    
                    {/* Visual Connection Line */}
                    <path
                      d={path}
                      fill="none"
                      stroke={style.stroke}
                      strokeWidth={isSelfLoop ? '2.5' : '2'}
                      strokeDasharray={conn.type === 'Choice' || conn.type === 'Branch' ? '5,4' : undefined}
                      markerEnd={`url(#arrow-${conn.type || 'Next'})`}
                      className="transition-all group-hover:stroke-[3.5] opacity-90 group-hover:opacity-100"
                    />

                    {/* Interactive Midpoint Pill Badge */}
                    <foreignObject
                      x={midX - 45}
                      y={midY - 14}
                      width="90"
                      height="28"
                      className="overflow-visible pointer-events-auto"
                    >
                      <div
                        onClick={() => handleOpenEditConnection(conn)}
                        className={`cursor-pointer px-2 py-0.5 rounded-full border text-[9px] font-bold font-mono text-center truncate shadow-sm transition-all hover:scale-110 flex items-center justify-center gap-1 ${style.bg} ${style.text} ${style.border}`}
                        style={{
                          backdropFilter: 'blur(6px)',
                          background: 'var(--bg-surface-elevated)',
                        }}
                        title={`点击编辑流向连线: ${conn.type} (${conn.label || '无标签'})`}
                      >
                        {isSelfLoop && <Repeat className="w-2.5 h-2.5 flex-shrink-0" />}
                        <span className="truncate">{conn.label || style.label}</span>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}

              {/* Live Interactive Connecting Guide Line */}
              {connectingFromId && nodePositions[connectingFromId] && (
                <path
                  d={`M ${nodePositions[connectingFromId].x + NODE_SIZE / 2} ${
                    nodePositions[connectingFromId].y + NODE_SIZE / 2
                  } L ${cursorCanvasPos.x} ${cursorCanvasPos.y}`}
                  fill="none"
                  stroke="var(--theme-primary)"
                  strokeWidth="2.5"
                  strokeDasharray="6,4"
                  markerEnd="url(#arrow-connecting)"
                  className="animate-pulse"
                />
              )}
            </svg>

            {/* Render Nodes as Square Boxes */}
            {steps.map((step, idx) => {
              const pos = nodePositions[step.id] || { x: 50 + idx * 280, y: 50 };
              const badge = stepTypeBadges[step.type || step.stepType || 'normal'] || stepTypeBadges.normal;
              const stepReqs = avRequirements.filter((r) => r.stepId === step.id);
              const isSourceInConnectMode = connectingFromId === step.id;
              const isTargetHoverInConnectMode = connectingFromId && connectingFromId !== step.id;

              return (
                <div
                  key={step.id}
                  id={`twine-node-${step.id}`}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    width: `${NODE_SIZE}px`,
                    height: `${NODE_SIZE}px`,
                    background: 'var(--bg-surface-elevated)',
                    borderColor: isSourceInConnectMode ? 'var(--theme-primary)' : 'var(--border-subtle)',
                  }}
                  onClick={(e) => {
                    if (connectingFromId) {
                      handleNodeConnectClick(e, step.id);
                    }
                  }}
                  className={`absolute rounded-3xl border p-3.5 flex flex-col justify-between select-none shadow-md transition-all duration-200 ${
                    isSourceInConnectMode
                      ? 'ring-4 ring-pink-500 border-pink-500 scale-105 z-30 shadow-2xl'
                      : isTargetHoverInConnectMode
                      ? 'hover:ring-2 hover:ring-cyan-400 hover:scale-[1.02] cursor-crosshair z-20'
                      : 'hover:shadow-2xl hover:-translate-y-0.5 z-10'
                  }`}
                >
                  {/* Node Header with Grab Handle & Type Badge */}
                  <div
                    onMouseDown={(e) => handleNodeMouseDown(e, step.id)}
                    className="flex items-center justify-between pb-2 border-b cursor-grab active:cursor-grabbing gap-1.5 group/handle"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <GripHorizontal className="w-3.5 h-3.5 opacity-40 group-hover/handle:opacity-100 transition-opacity flex-shrink-0" />
                      <span
                        className="w-5 h-5 rounded-lg font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0 transition-transform group-hover/handle:scale-110"
                        style={{
                          background: 'var(--theme-secondary-bg)',
                          color: 'var(--theme-primary)',
                        }}
                      >
                        #{idx + 1}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono border font-bold truncate max-w-[105px] shadow-xs ${badge.color}`}>
                      {badge.label.split(' ')[0]}
                    </span>
                  </div>

                  {/* Node Main Content */}
                  <div
                    onClick={() => {
                      if (!connectingFromId) handleOpenEditStep(step);
                    }}
                    className="flex-1 py-1.5 flex flex-col justify-center cursor-pointer space-y-1 overflow-hidden group/content"
                  >
                    <h5
                      className="font-bold text-xs line-clamp-2 font-display leading-tight group-hover/content:text-[var(--theme-primary)] transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      title={step.title}
                    >
                      {step.title}
                    </h5>

                    <p
                      className="text-[10px] opacity-75 line-clamp-2 leading-relaxed font-serif"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {step.summary || '（点击编辑剧情与对白）'}
                    </p>

                    {/* Character / Location / Conditions */}
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {step.characters && step.characters.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-md font-medium opacity-85 shadow-xs" style={{ background: 'var(--theme-secondary-bg)', color: 'var(--theme-primary)' }}>
                          <Users className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[55px]">{step.characters[0]}</span>
                        </span>
                      )}

                      {step.locations && step.locations.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-md font-medium opacity-75 border shadow-xs" style={{ borderColor: 'var(--border-subtle)' }}>
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[55px]">{step.locations[0]}</span>
                        </span>
                      )}

                      {stepReqs.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-md font-medium border theme-badge-secondary shadow-xs">
                          <Music className="w-2.5 h-2.5" />
                          <span>{stepReqs.length}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Node Footer Actions */}
                  <div
                    className="flex items-center justify-between pt-1.5 border-t text-[10px] gap-1"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditStep(step);
                      }}
                      className="p-1 rounded-lg border hover:bg-black/5 active:scale-90 transition-all text-secondary"
                      style={{ borderColor: 'var(--border-subtle)' }}
                      title="编辑步骤详情"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={(e) => handleNodeConnectClick(e, step.id)}
                      className={`px-2 py-1 rounded-xl border font-bold text-[10px] transition-all flex items-center space-x-1 active:scale-95 ${
                        isSourceInConnectMode
                          ? 'bg-pink-500 text-white border-pink-500 shadow-md'
                          : 'hover:bg-black/5 hover:border-[var(--theme-primary)]'
                      }`}
                      style={!isSourceInConnectMode ? { borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' } : {}}
                      title="从此方块引出箭头连线（支持1对多、多对1或自身循环）"
                    >
                      <LinkIcon className="w-2.5 h-2.5" style={!isSourceInConnectMode ? { color: 'var(--theme-primary)' } : {}} />
                      <span>{isSourceInConnectMode ? '选定中' : '引出连线'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <QuestStepModal
        isOpen={stepModalOpen}
        onClose={() => setStepModalOpen(false)}
        questId={quest.id}
        projectId={quest.projectId}
        step={selectedStepForEdit}
        allSteps={steps}
        onSaved={onRefresh}
      />

      <QuestConnectionModal
        isOpen={connModalOpen}
        onClose={() => setConnModalOpen(false)}
        questId={quest.id}
        projectId={quest.projectId}
        steps={steps}
        connection={selectedConnForEdit}
        defaultFromStepId={defaultFromStepId}
        onSaved={onRefresh}
      />
    </div>
  );
};
