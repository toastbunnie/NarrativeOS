import React, { useState, useEffect, useRef } from 'react';
import {
  Network,
  Filter,
  Maximize2,
  Minimize2,
  RotateCcw,
  Plus,
  Info,
  Search,
  Users,
  MapPin,
  Compass,
  Shield,
  BookMarked,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Character, WorldLocation, Quest, WorldFaction, RelationType } from '../types';
import { putToStore } from '../services/db';

interface GraphNode {
  id: string;
  name: string;
  type: 'character' | 'location' | 'quest' | 'faction' | 'lore';
  color: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  data: any;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
  label: string;
  color: string;
}

export const GraphView: React.FC = () => {
  const {
    t,
    characters,
    locations,
    quests,
    factions,
    lore,
    activeProjectId,
    refreshData,
    showToast,
  } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filters
  const [filterTypes, setFilterTypes] = useState<Record<string, boolean>>({
    character: true,
    location: true,
    quest: true,
    faction: true,
    lore: true,
  });

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkSource, setLinkSource] = useState('');
  const [linkTarget, setLinkTarget] = useState('');
  const [linkType, setLinkType] = useState<RelationType>('knows');
  const [linkDesc, setLinkDesc] = useState('');

  // Simulation state
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const dragNodeRef = useRef<GraphNode | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Prepare graph data
  useEffect(() => {
    const width = containerRef.current?.clientWidth || 800;
    const height = 550;

    const newNodes: GraphNode[] = [];
    const newLinks: GraphLink[] = [];

    // Characters
    characters.forEach((c) => {
      newNodes.push({
        id: c.id,
        name: c.name,
        type: 'character',
        color: '#F04E98',
        radius: 16,
        x: width / 2 + (Math.random() - 0.5) * 300,
        y: height / 2 + (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
        data: c,
      });

      // Character relationships
      c.relationships?.forEach((rel) => {
        const targetNode = characters.find((o) => o.id === rel.targetId || o.name === rel.targetName);
        if (targetNode) {
          newLinks.push({
            source: c.id,
            target: targetNode.id,
            type: rel.type,
            label: t.relations[rel.type] || rel.type,
            color: '#F04E98',
          });
        }
      });
    });

    // Locations
    locations.forEach((loc) => {
      newNodes.push({
        id: loc.id,
        name: loc.name,
        type: 'location',
        color: '#00FFBF',
        radius: 14,
        x: width / 2 + (Math.random() - 0.5) * 350,
        y: height / 2 + (Math.random() - 0.5) * 350,
        vx: 0,
        vy: 0,
        data: loc,
      });
    });

    // Quests
    quests.forEach((q) => {
      newNodes.push({
        id: q.id,
        name: q.name,
        type: 'quest',
        color: '#38BDF8',
        radius: 15,
        x: width / 2 + (Math.random() - 0.5) * 320,
        y: height / 2 + (Math.random() - 0.5) * 320,
        vx: 0,
        vy: 0,
        data: q,
      });

      // Links to characters
      q.characters?.forEach((charName) => {
        const charObj = characters.find((c) => c.name === charName || c.id === charName);
        if (charObj) {
          newLinks.push({
            source: q.id,
            target: charObj.id,
            type: 'appears_in',
            label: '参与',
            color: '#38BDF8',
          });
        }
      });
    });

    // Factions
    factions.forEach((f) => {
      newNodes.push({
        id: f.id,
        name: f.name,
        type: 'faction',
        color: '#F59E0B',
        radius: 15,
        x: width / 2 + (Math.random() - 0.5) * 280,
        y: height / 2 + (Math.random() - 0.5) * 280,
        vx: 0,
        vy: 0,
        data: f,
      });
    });

    // Lore
    lore.forEach((l) => {
      newNodes.push({
        id: l.id,
        name: l.title,
        type: 'lore',
        color: '#A855F7',
        radius: 12,
        x: width / 2 + (Math.random() - 0.5) * 360,
        y: height / 2 + (Math.random() - 0.5) * 360,
        vx: 0,
        vy: 0,
        data: l,
      });
    });

    nodesRef.current = newNodes;
    linksRef.current = newLinks;
  }, [characters, locations, quests, factions, lore, t.relations]);

  // Force simulation animation loop
  useEffect(() => {
    let animId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Physics step
      const visibleNodes = nodesRef.current.filter((n) => filterTypes[n.type]);
      const nodeMap = new Map<string, GraphNode>(visibleNodes.map((n) => [n.id, n]));

      // Repulsion between nodes
      for (let i = 0; i < visibleNodes.length; i++) {
        for (let j = i + 1; j < visibleNodes.length; j++) {
          const n1 = visibleNodes[i];
          const n2 = visibleNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 200) {
            const force = (200 - dist) / dist * 0.05;
            n1.vx -= dx * force;
            n1.vy -= dy * force;
            n2.vx += dx * force;
            n2.vy += dy * force;
          }
        }
      }

      // Link attraction
      linksRef.current.forEach((link) => {
        const n1 = nodeMap.get(link.source);
        const n2 = nodeMap.get(link.target);
        if (n1 && n2) {
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 120;
          const force = (dist - targetDist) * 0.005;
          n1.vx += dx * force;
          n1.vy += dy * force;
          n2.vx -= dx * force;
          n2.vy -= dy * force;
        }
      });

      // Centering & damping
      visibleNodes.forEach((n) => {
        if (n !== dragNodeRef.current) {
          n.vx += (width / 2 - n.x) * 0.001;
          n.vy += (height / 2 - n.y) * 0.001;
          n.vx *= 0.88;
          n.vy *= 0.88;
          n.x += n.vx;
          n.y += n.vy;
        }
      });

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.scale, transformRef.current.scale);

      // Draw Grid Background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = -width; x < width * 2; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -height);
        ctx.lineTo(x, height * 2);
        ctx.stroke();
      }
      for (let y = -height; y < height * 2; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-width, y);
        ctx.lineTo(width * 2, y);
        ctx.stroke();
      }

      // Draw Links
      linksRef.current.forEach((link) => {
        const n1 = nodeMap.get(link.source);
        const n2 = nodeMap.get(link.target);
        if (n1 && n2) {
          ctx.strokeStyle = link.color ? `${link.color}66` : 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.stroke();

          // Link Label
          if (link.label) {
            const midX = (n1.x + n2.x) / 2;
            const midY = (n1.y + n2.y) / 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(link.label, midX, midY - 3);
          }
        }
      });

      // Draw Nodes
      visibleNodes.forEach((node) => {
        const isSelected = selectedNode?.id === node.id;

        // Outer glow on select
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = `${node.color}33`;
          ctx.fill();
        }

        // Node Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // Node Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, node.x, node.y + node.radius + 14);
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [filterTypes, selectedNode]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = 550;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.scale;
    const mouseY = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.scale;

    // Check if clicked a node
    const visibleNodes = nodesRef.current.filter((n) => filterTypes[n.type]);
    const clicked = visibleNodes.find((n) => {
      const dx = n.x - mouseX;
      const dy = n.y - mouseY;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 5;
    });

    if (clicked) {
      dragNodeRef.current = clicked;
      setSelectedNode(clicked);
    } else {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
      setSelectedNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (dragNodeRef.current) {
      const mouseX = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.scale;
      const mouseY = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.scale;
      dragNodeRef.current.x = mouseX;
      dragNodeRef.current.y = mouseY;
    } else if (isDraggingRef.current) {
      transformRef.current.x = e.clientX - dragStartRef.current.x;
      transformRef.current.y = e.clientY - dragStartRef.current.y;
    }
  };

  const handleMouseUp = () => {
    dragNodeRef.current = null;
    isDraggingRef.current = false;
  };

  const handleZoom = (delta: number) => {
    transformRef.current.scale = Math.max(0.4, Math.min(2.5, transformRef.current.scale + delta));
  };

  const handleReset = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    setSelectedNode(null);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkSource || !linkTarget) {
      showToast(t.common.requiredField, 'error');
      return;
    }

    const sourceChar = characters.find((c) => c.id === linkSource || c.name === linkSource);
    const targetObj = characters.find((c) => c.id === linkTarget || c.name === linkTarget);

    if (sourceChar && targetObj) {
      const updatedRels = [
        ...(sourceChar.relationships || []),
        {
          targetId: targetObj.id,
          targetName: targetObj.name,
          type: linkType,
          description: linkDesc.trim(),
          weight: 3,
        },
      ];
      await putToStore('characters', { ...sourceChar, relationships: updatedRels });
      showToast(`已建立关系连线`, 'success');
      setLinkModalOpen(false);
      await refreshData();
    } else {
      showToast(`未能找到角色实体`, 'error');
    }
  };

  return (
    <div id="graph-view-container" className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Network className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
            <span>{t.knowledgeGraph?.title || t.graph?.title}</span>
          </h2>
          <p className="text-xs opacity-75 mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t.knowledgeGraph?.subtitle || t.graph?.subtitle}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="graph-add-rel-btn"
            onClick={() => setLinkModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-md theme-btn-primary active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{t.knowledgeGraph?.addRelationship || t.graph?.addRelationship || '添加关系'}</span>
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl glass-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs flex items-center gap-1 font-mono font-medium opacity-80">
            <Filter className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
            {t.knowledgeGraph?.filterByType || t.graph?.filterByType}:
          </span>

          {[
            { type: 'character', label: t.home?.stats?.characters || '角色', color: '#F04E98' },
            { type: 'location', label: t.home?.stats?.locations || '地点', color: '#00FFBF' },
            { type: 'quest', label: t.home?.stats?.quests || '任务', color: '#38BDF8' },
            { type: 'faction', label: '阵营势力', color: '#F59E0B' },
            { type: 'lore', label: '世界设定', color: '#A855F7' },
          ].map((item) => {
            const active = filterTypes[item.type];
            return (
              <button
                key={item.type}
                onClick={() => setFilterTypes({ ...filterTypes, [item.type]: !active })}
                style={
                  active
                    ? {
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: item.color,
                        boxShadow: `0 2px 8px -1px ${item.color}40`,
                        color: 'var(--text-primary)',
                      }
                    : {
                        opacity: 0.5,
                        borderColor: 'transparent',
                        color: 'var(--text-muted)',
                      }
                }
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all border flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Viewport Control Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleZoom(0.15)}
            className="p-1.5 rounded-lg border hover:bg-black/5 active:scale-95 transition-all"
            style={{ borderColor: 'var(--border-subtle)' }}
            title={t.knowledgeGraph?.zoomIn || '放大'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 rounded-lg border hover:bg-black/5 active:scale-95 transition-all"
            style={{ borderColor: 'var(--border-subtle)' }}
            title={t.knowledgeGraph?.zoomOut || '缩小'}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg border hover:bg-black/5 active:scale-95 transition-all"
            style={{ borderColor: 'var(--border-subtle)' }}
            title={t.knowledgeGraph?.reset || '重置'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Force Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div ref={containerRef} className="lg:col-span-8 relative rounded-2xl glass-card overflow-hidden h-[550px]" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          />
        </div>

        {/* Node Detail Inspector */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl glass-card h-[550px] overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
              <Info className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
              <span>{t.knowledgeGraph?.inspector || t.graph?.inspector}</span>
            </h3>

            {selectedNode ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white font-display shadow"
                    style={{ backgroundColor: selectedNode.color }}
                  >
                    {selectedNode.name.slice(0, 1)}
                  </div>
                  <div>
                    <h4 className="font-bold font-display text-sm" style={{ color: 'var(--text-primary)' }}>
                      {selectedNode.name}
                    </h4>
                    <span className="text-[10px] font-mono uppercase opacity-70" style={{ color: 'var(--text-secondary)' }}>
                      类型: {selectedNode.type}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border space-y-1" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <span className="text-[10px] font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>实体概述</span>
                  <p className="font-serif leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {selectedNode.data?.description || selectedNode.data?.bio || selectedNode.data?.content || '暂无详细描述'}
                  </p>
                </div>

                {selectedNode.data?.relationships && selectedNode.data.relationships.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                      羁绊关联 ({selectedNode.data.relationships.length})
                    </span>
                    <div className="space-y-1">
                      {selectedNode.data.relationships.map((r: any, idx: number) => (
                        <div key={idx} className="p-2 rounded border text-[11px] flex items-center justify-between" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
                          <span className="font-medium">{r.targetName}</span>
                          <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--theme-primary)' }}>{r.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                <Network className="w-10 h-10 mb-2" style={{ color: 'var(--theme-primary)' }} />
                <p className="text-xs">{t.knowledgeGraph?.nodeDetails || t.graph?.nodeDetails}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Relationship Link Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl border"
            style={{ 
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold text-sm font-display">
                {t.knowledgeGraph?.addRelationship || t.graph?.addRelationship || '添加实体关系'}
              </h3>
              <button onClick={() => setLinkModalOpen(false)} className="opacity-60 hover:opacity-100 text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLink} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1 opacity-90">起始角色 *</label>
                <select
                  required
                  value={linkSource}
                  onChange={(e) => setLinkSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                >
                  <option value="">选择角色...</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">关系类型 *</label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value as RelationType)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                >
                  <option value="knows">{t.relations?.knows || '相识'}</option>
                  <option value="likes">{t.relations?.likes || '喜爱'}</option>
                  <option value="dislikes">{t.relations?.dislikes || '厌恶'}</option>
                  <option value="trusts">{t.relations?.trusts || '信赖'}</option>
                  <option value="conflicts_with">{t.relations?.conflicts_with || '冲突'}</option>
                  <option value="belongs_to">{t.relations?.belongs_to || '隶属'}</option>
                  <option value="reveals">{t.relations?.reveals || '揭露'}</option>
                  <option value="foreshadows">{t.relations?.foreshadows || '铺垫'}</option>
                  <option value="causes">{t.relations?.causes || '因果'}</option>
                  <option value="depends_on">{t.relations?.depends_on || '依赖'}</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">目标角色 *</label>
                <select
                  required
                  value={linkTarget}
                  onChange={(e) => setLinkTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                >
                  <option value="">选择目标角色...</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">关系说明</label>
                <input
                  type="text"
                  placeholder="如: 多年前并肩作战，因信念分道扬镳"
                  value={linkDesc}
                  onChange={(e) => setLinkDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
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
