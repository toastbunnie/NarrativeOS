import React, { useState, useRef } from 'react';
import {
  BookOpen,
  FileUp,
  FileText,
  Search,
  Tag,
  Plus,
  Trash2,
  Download,
  FlaskConical,
  Highlighter,
  MessageSquare,
  Sparkles,
  Layers,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LibraryDocument, Annotation, AnnotationType, DocumentFileType } from '../types';
import { parseFile, processRawText } from '../services/fileParser';
import { putToStore, deleteFromStore, archiveEntity, logActivity } from '../services/db';

export const LibraryView: React.FC = () => {
  const {
    t,
    documents,
    activeProjectId,
    annotations,
    refreshData,
    showToast,
    setCurrentTab,
    setSelectedDocForLab,
  } = useApp();

  const [selectedDoc, setSelectedDoc] = useState<LibraryDocument | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);

  // Manual doc form
  const [manualTitle, setManualTitle] = useState('');
  const [manualCategory, setManualCategory] = useState('script');
  const [manualText, setManualText] = useState('');

  // Text selection annotation state
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [annotationType, setAnnotationType] = useState<AnnotationType>('Dialogue');
  const [annotationNote, setAnnotationNote] = useState('');
  const [showAnnotationPopover, setShowAnnotationPopover] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerContentRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const parsed = await parseFile(file);

        if (parsed.warning) {
          showToast(parsed.warning, 'info');
        }

        if (parsed.error) {
          showToast(parsed.error, 'error');
          continue;
        }

        const now = Date.now();
        const docId = 'doc_' + now + '_' + Math.random().toString(36).slice(2, 6);
        const newDoc: LibraryDocument = {
          id: docId,
          projectId: activeProjectId || '',
          title: parsed.title,
          fileType: parsed.fileType,
          category: 'raw',
          originalText: parsed.text,
          segments: parsed.segments,
          summary: parsed.text.slice(0, 150),
          tags: [parsed.fileType.toLowerCase()],
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            wordCount: parsed.wordCount,
            pageCount: parsed.pageCount,
            importedAt: now,
          },
          createdAt: now,
          updatedAt: now,
        };

        await putToStore('documents', newDoc);
        await logActivity('IMPORT_DOCUMENT', 'document', newDoc.title, activeProjectId || undefined);
      }

      showToast(`成功导入 ${files.length} 个文件`, 'success');
      await refreshData();
    } catch (err: any) {
      showToast(`导入失败: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveManualDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualText.trim()) {
      showToast(t.common.requiredField, 'error');
      return;
    }

    const now = Date.now();
    const processed = processRawText(manualText, manualTitle.trim(), 'TXT');
    const docId = 'doc_' + now + '_' + Math.random().toString(36).slice(2, 6);

    const newDoc: LibraryDocument = {
      id: docId,
      projectId: activeProjectId || '',
      title: manualTitle.trim(),
      fileType: 'TXT',
      category: manualCategory,
      originalText: manualText,
      segments: processed.segments,
      summary: manualText.slice(0, 150),
      tags: [manualCategory],
      metadata: {
        wordCount: processed.wordCount,
        importedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    try {
      await putToStore('documents', newDoc);
      await logActivity('CREATE_DOCUMENT', 'document', newDoc.title, activeProjectId || undefined);
      showToast(t.common.success, 'success');
      setManualModalOpen(false);
      setManualTitle('');
      setManualText('');
      setSelectedDoc(newDoc);
      await refreshData();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selectedDoc) {
      return;
    }
    const text = selection.toString().trim();
    if (text.length > 0) {
      const fullText = selectedDoc.originalText;
      const start = fullText.indexOf(text);
      const end = start + text.length;

      setSelectedRange({
        start: start >= 0 ? start : 0,
        end: end >= 0 ? end : text.length,
        text,
      });
      setShowAnnotationPopover(true);
    }
  };

  const handleCreateAnnotation = async () => {
    if (!selectedRange || !selectedDoc) return;

    const now = Date.now();
    const annotId = 'annot_' + now + '_' + Math.random().toString(36).slice(2, 6);
    const newAnnot: Annotation = {
      id: annotId,
      projectId: selectedDoc.projectId || '',
      sourceId: selectedDoc.id,
      start: selectedRange.start,
      end: selectedRange.end,
      text: selectedRange.text,
      type: annotationType,
      note: annotationNote.trim(),
      createdAt: now,
    };

    try {
      await putToStore('annotations', newAnnot);
      await logActivity('CREATE_ANNOTATION', 'annotation', `${annotationType}: ${selectedRange.text.slice(0, 20)}`, selectedDoc.projectId);
      showToast(`已建立叙事标注: [${t.annotations[annotationType] || annotationType}]`, 'success');
      setShowAnnotationPopover(false);
      setAnnotationNote('');
      setSelectedRange(null);
      await refreshData();
    } catch (e: any) {
      showToast(`标注失败: ${e.message}`, 'error');
    }
  };

  const handleDeleteDoc = async (doc: LibraryDocument) => {
    if (window.confirm(`确定要归档资料「${doc.title}」吗？`)) {
      await archiveEntity('document', doc, '用户归档资料');
      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(null);
      }
      showToast(`资料已移入归档室`, 'info');
      await refreshData();
    }
  };

  const handleSendToLab = (doc: LibraryDocument) => {
    setSelectedDocForLab(doc);
    setCurrentTab('LAB');
  };

  const handleExportMarkdown = (doc: LibraryDocument) => {
    const blob = new Blob([doc.originalText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDocs = documents.filter((d) => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.originalText?.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'all' || d.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const docAnnotations = annotations.filter((a) => a.sourceId === selectedDoc?.id);

  const annotationColors: Record<AnnotationType, string> = {
    Dialogue: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    Action: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    Conflict: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    Reveal: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    Foreshadowing: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    Choice: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    Consequence: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    Lore: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    'Character Beat': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    'Emotional Beat': 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
    'Quest Beat': 'bg-lime-500/20 text-lime-300 border-lime-500/40',
    Theme: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  };

  return (
    <div id="library-view-container" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.pdf,.doc,.docx,.json,.csv"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <BookOpen className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
            <span>{t.library.title}</span>
          </h2>
          <p className="text-xs opacity-75 mt-1" style={{ color: 'var(--text-secondary)' }}>{t.library.subtitle}</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="library-manual-doc-btn"
            onClick={() => setManualModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all theme-badge-secondary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.library.manualDoc}</span>
          </button>

          <button
            id="library-import-file-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 theme-btn-primary"
          >
            <FileUp className="w-4 h-4 stroke-[2.5]" />
            <span>{isUploading ? t.common.loading : t.library.importDoc}</span>
          </button>
        </div>
      </div>

      {/* Layout Split: Document list on left / Reader on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Documents Browser */}
        <div className="lg:col-span-4 space-y-4">
          {/* Dropzone Area */}
          <div
            id="library-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileUpload(e.dataTransfer.files);
            }}
            className="p-5 rounded-2xl border-2 border-dashed glass-card cursor-pointer transition-all text-center group"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <FileUp className="w-8 h-8 mx-auto mb-2 transition-transform group-hover:scale-110" style={{ color: 'var(--theme-primary)' }} />
            <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{t.library.dropzoneTitle}</h4>
            <p className="text-[10px] opacity-75 mt-1 font-mono" style={{ color: 'var(--text-secondary)' }}>{t.library.dropzoneSub}</p>
          </div>

          {/* Search & Filter */}
          <div className="p-3 rounded-xl glass-card space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                id="library-search-input"
                type="text"
                placeholder={t.common.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg glass-input text-xs"
              />
            </div>

            <select
              id="library-category-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs"
            >
              <option value="all">{t.library.categories.all}</option>
              <option value="script">{t.library.categories.script}</option>
              <option value="outline">{t.library.categories.outline}</option>
              <option value="lore">{t.library.categories.lore}</option>
              <option value="character_doc">{t.library.categories.character_doc}</option>
              <option value="quest_doc">{t.library.categories.quest_doc}</option>
              <option value="reference">{t.library.categories.reference}</option>
              <option value="raw">{t.library.categories.raw}</option>
            </select>
          </div>

          {/* Documents List */}
          <div className="space-y-2 max-h-[550px] overflow-y-auto custom-scrollbar pr-1">
            {filteredDocs.length === 0 ? (
              <div className="py-12 text-center rounded-xl glass-card text-xs opacity-75">
                {t.common.empty}
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    id={`library-doc-item-${doc.id}`}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'ring-2'
                        : 'glass-card'
                    }`}
                    style={{
                      background: isSelected ? 'var(--bg-surface-elevated)' : undefined,
                      borderColor: isSelected ? 'var(--theme-primary)' : 'var(--border-subtle)'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center space-x-2 truncate">
                        <span 
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border"
                          style={{
                            background: 'var(--theme-secondary-bg)',
                            color: 'var(--theme-secondary-text)',
                            borderColor: 'var(--theme-secondary-border)'
                          }}
                        >
                          {doc.fileType}
                        </span>
                        <h4 className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</h4>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDoc(doc);
                        }}
                        title={t.common.archive}
                        className="opacity-50 hover:opacity-100 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] opacity-75 line-clamp-2 mb-2 font-serif" style={{ color: 'var(--text-secondary)' }}>
                      {doc.summary || doc.originalText?.slice(0, 100)}
                    </p>

                    <div className="flex items-center justify-between text-[10px] opacity-60 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      <span>{doc.metadata?.wordCount || 0} 字</span>
                      <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Source Document Reader & Annotation Panel */}
        <div className="lg:col-span-8">
          {selectedDoc ? (
            <div id="library-reader-panel" className="rounded-2xl glass-card p-6 space-y-6">
              {/* Document Reader Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <div className="flex items-center space-x-2">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
                      style={{
                        background: 'var(--theme-secondary-bg)',
                        color: 'var(--theme-secondary-text)',
                        borderColor: 'var(--theme-secondary-border)'
                      }}
                    >
                      {selectedDoc.fileType}
                    </span>
                    <h3 className="text-base font-bold font-display" style={{ color: 'var(--text-primary)' }}>
                      {selectedDoc.title}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] opacity-75 font-mono mt-1" style={{ color: 'var(--text-secondary)' }}>
                    <span>字数: {selectedDoc.metadata?.wordCount || 0}</span>
                    <span>段落: {selectedDoc.segments?.length || 0}</span>
                    <span>导入于: {new Date(selectedDoc.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    id="reader-send-lab-btn"
                    onClick={() => handleSendToLab(selectedDoc)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium theme-badge-secondary"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>{t.library.reader.sendToLab}</span>
                  </button>

                  <button
                    id="reader-export-md-btn"
                    onClick={() => handleExportMarkdown(selectedDoc)}
                    title={t.library.reader.exportMarkdown}
                    className="p-1.5 rounded-xl border opacity-75 hover:opacity-100"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Reader Body & Annotations Split */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Text Viewport */}
                <div
                  ref={readerContentRef}
                  onMouseUp={handleTextSelection}
                  className="xl:col-span-8 p-5 rounded-xl border max-h-[600px] overflow-y-auto custom-scrollbar font-serif text-sm leading-relaxed select-text whitespace-pre-wrap"
                  style={{ 
                    background: 'var(--bg-surface-elevated)', 
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {selectedDoc.originalText}
                </div>

                {/* Right Annotation Inspector */}
                <div className="xl:col-span-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                      <Highlighter className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                      <span>{t.library.reader.annotationsPanel}</span>
                    </h4>
                    <span 
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono border"
                      style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                    >
                      {docAnnotations.length}
                    </span>
                  </div>

                  {docAnnotations.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed text-center text-xs opacity-75" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <Info className="w-5 h-5 mx-auto mb-1.5 opacity-60" />
                      {t.library.reader.noAnnotations}
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                      {docAnnotations.map((annot) => (
                        <div
                          key={annot.id}
                          className="p-3 rounded-xl border space-y-1.5 text-xs"
                          style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold border"
                              style={{
                                background: 'var(--theme-secondary-bg)',
                                color: 'var(--theme-secondary-text)',
                                borderColor: 'var(--theme-secondary-border)'
                              }}
                            >
                              {t.annotations[annot.type] || annot.type}
                            </span>
                            <button
                              onClick={async () => {
                                await deleteFromStore('annotations', annot.id);
                                await refreshData();
                              }}
                              className="opacity-50 hover:opacity-100 hover:text-rose-500"
                            >
                              ✕
                            </button>
                          </div>
                          <p className="font-serif italic border-l-2 pl-2 text-[11px]" style={{ borderColor: 'var(--theme-primary)', color: 'var(--text-primary)' }}>
                            "{annot.text}"
                          </p>
                          {annot.note && (
                            <p className="text-[10px] opacity-75 font-mono" style={{ color: 'var(--text-secondary)' }}>{annot.note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center rounded-2xl glass-card text-center p-6 opacity-75">
              <BookOpen className="w-12 h-12 mb-3 opacity-50" style={{ color: 'var(--theme-primary)' }} />
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>未选择资料</h3>
              <p className="text-xs opacity-75 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                从左侧资料列表中点击查看文档，或者直接拖拽导入剧本文案以开启原文阅读与批注模式。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Annotation Creation Popover Modal */}
      {showAnnotationPopover && selectedRange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl"
            style={{ 
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Highlighter className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                <span>{t.library.reader.annotateAction}</span>
              </h3>
              <button
                onClick={() => setShowAnnotationPopover(false)}
                className="opacity-60 hover:opacity-100 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] opacity-75 mb-1">{t.library.reader.selectedText}</label>
                <div 
                  className="p-2.5 rounded-lg border font-serif italic text-xs max-h-24 overflow-y-auto"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  "{selectedRange.text}"
                </div>
              </div>

              <div>
                <label className="block text-[11px] opacity-75 mb-1">叙事分类标注类型</label>
                <select
                  value={annotationType}
                  onChange={(e) => setAnnotationType(e.target.value as AnnotationType)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                >
                  <option value="Dialogue">{t.annotations.Dialogue}</option>
                  <option value="Action">{t.annotations.Action}</option>
                  <option value="Conflict">{t.annotations.Conflict}</option>
                  <option value="Reveal">{t.annotations.Reveal}</option>
                  <option value="Foreshadowing">{t.annotations.Foreshadowing}</option>
                  <option value="Choice">{t.annotations.Choice}</option>
                  <option value="Consequence">{t.annotations.Consequence}</option>
                  <option value="Lore">{t.annotations.Lore}</option>
                  <option value="Character Beat">{t.annotations['Character Beat']}</option>
                  <option value="Emotional Beat">{t.annotations['Emotional Beat']}</option>
                  <option value="Quest Beat">{t.annotations['Quest Beat']}</option>
                  <option value="Theme">{t.annotations.Theme}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] opacity-75 mb-1">备注 / 批注</label>
                <textarea
                  rows={3}
                  placeholder={t.library.reader.notePlaceholder}
                  value={annotationNote}
                  onChange={(e) => setAnnotationNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setShowAnnotationPopover(false)}
                  className="px-3 py-1.5 rounded-xl border hover:bg-black/5"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleCreateAnnotation}
                  className="px-4 py-1.5 rounded-xl font-bold text-xs shadow-md active:scale-95 theme-btn-primary"
                >
                  {t.common.confirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Document Creation Modal */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-xl rounded-2xl border p-6 space-y-4 shadow-2xl"
            style={{ 
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold text-sm font-display">
                {t.library.manualDoc}
              </h3>
              <button
                onClick={() => setManualModalOpen(false)}
                className="opacity-60 hover:opacity-100 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualDoc} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-medium mb-1 opacity-90">文档标题 *</label>
                  <input
                    type="text"
                    required
                    placeholder="如: 第一幕·神庙潜入对白"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 opacity-90">分类</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="script">{t.library.categories.script}</option>
                    <option value="outline">{t.library.categories.outline}</option>
                    <option value="lore">{t.library.categories.lore}</option>
                    <option value="character_doc">{t.library.categories.character_doc}</option>
                    <option value="quest_doc">{t.library.categories.quest_doc}</option>
                    <option value="reference">{t.library.categories.reference}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-90">文档正文内容 *</label>
                <textarea
                  rows={10}
                  required
                  placeholder="粘贴或编写剧本、对白、设定或任务文本..."
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-serif resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl border hover:bg-black/5"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold text-xs shadow-md active:scale-95 theme-btn-primary"
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
