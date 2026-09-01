import React, { useState } from 'react';
import {
  Settings,
  Palette,
  Globe,
  KeyRound,
  Download,
  Upload,
  CheckCircle2,
  Sparkles,
  Link,
  ShieldCheck,
  Zap,
  Activity,
  Eye,
  EyeOff,
  Cpu,
  RefreshCw,
  Clock,
  Shield,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppTheme } from '../types';
import { exportAllDatabase, importAllDatabase } from '../services/db';
import { testQwenConnection, DEFAULT_AI_API_KEY, DEFAULT_QWEN_ENDPOINT, DEFAULT_QWEN_MODEL } from '../services/aiService';
import { testFeishuConnection, syncWithFeishuNow, saveFeishuSettings, STANDARD_12_TABLES } from '../services/feishuAdapter';

export const SettingsView: React.FC = () => {
  const {
    t,
    theme,
    setTheme,
    language,
    setLanguage,
    aiSettings,
    updateAISettings,
    feishuSettings,
    updateFeishuSettings,
    refreshData,
    showToast,
  } = useApp();

  // Feishu configuration state (App Token & Table ID only - App Secret is securely loaded from Vercel Serverless environment variables)
  const [feishuAppToken, setFeishuAppToken] = useState(() => feishuSettings.appToken || '');
  const [feishuTableId, setFeishuTableId] = useState(() => feishuSettings.tableId || '');
  const [feishuAutoSync, setFeishuAutoSync] = useState(() => !!feishuSettings.autoSync);
  const [testingFeishu, setTestingFeishu] = useState(false);
  const [syncingFeishu, setSyncingFeishu] = useState(false);
  const [feishuTestResult, setFeishuTestResult] = useState<{ success: boolean; message: string; connectionStatus?: string } | null>(null);

  // AI Configuration state
  const [qwenKey, setQwenKey] = useState(() => aiSettings.qwenApiKey || DEFAULT_AI_API_KEY);
  const [qwenModel, setQwenModel] = useState(() => aiSettings.qwenModel || DEFAULT_QWEN_MODEL);
  const [qwenEndpoint, setQwenEndpoint] = useState(() => aiSettings.qwenEndpoint || DEFAULT_QWEN_ENDPOINT);
  const [showKey, setShowKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleSaveAIConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateAISettings({
      provider: 'qwen',
      qwenApiKey: qwenKey.trim(),
      qwenModel: qwenModel.trim(),
      qwenEndpoint: qwenEndpoint.trim(),
    });
    showToast('AI 模型与 API 配置已成功保存！', 'success');
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testQwenConnection(qwenKey, qwenEndpoint, qwenModel);
      setTestResult(res);
      if (res.success) {
        showToast(res.message, 'success');
        updateAISettings({
          provider: 'qwen',
          qwenApiKey: qwenKey.trim(),
          qwenModel: qwenModel.trim(),
          qwenEndpoint: qwenEndpoint.trim(),
        });
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '网络连接异常' });
      showToast(`连通失败: ${err.message}`, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveFeishuConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...feishuSettings,
      appToken: feishuAppToken.trim(),
      tableId: feishuTableId.trim(),
      autoSync: feishuAutoSync,
    };
    updateFeishuSettings(updated);
    saveFeishuSettings(updated);
    showToast('飞书多维表格配置已保存', 'success');
  };

  const handleTestFeishu = async () => {
    setTestingFeishu(true);
    setFeishuTestResult(null);
    try {
      const res = await testFeishuConnection({
        appToken: feishuAppToken.trim(),
        tableId: feishuTableId.trim(),
      });
      setFeishuTestResult(res);
      if (res.success) {
        showToast(res.message, 'success');
        updateFeishuSettings({
          appToken: feishuAppToken.trim(),
          tableId: feishuTableId.trim(),
          tableMapping: res.tableMapping || {},
          tablesStatus: res.tablesStatus || {},
          missingTables: res.missingTables || [],
          matchedTablesCount: res.matchedCount ?? Object.keys(res.tableMapping || {}).length,
          totalTablesCount: res.totalCount ?? 12,
          connectionStatus: res.connectionStatus,
        });
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      const msg = err.message || '测试失败';
      setFeishuTestResult({ success: false, message: msg });
      showToast(`测试失败: ${msg}`, 'error');
    } finally {
      setTestingFeishu(false);
    }
  };

  const handleSyncFeishuNow = async () => {
    setSyncingFeishu(true);
    try {
      const res = await syncWithFeishuNow();
      if (res.success) {
        showToast(res.message, 'success');
        await refreshData();
      } else {
        showToast(res.message, 'info');
      }
    } catch (err: any) {
      showToast(`同步异常: ${err.message}`, 'error');
    } finally {
      setSyncingFeishu(false);
    }
  };


  const handleExportFullJSON = async () => {
    setIsExporting(true);
    try {
      const backupJsonString = await exportAllDatabase();
      const blob = new Blob([backupJsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Narrative_OS_Full_Backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('全量数据备份导出成功！', 'success');
    } catch (e: any) {
      showToast(`导出失败: ${e.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFullJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawContent = event.target?.result as string;
        setIsImporting(true);
        await importAllDatabase(rawContent);
        showToast('全量备份已成功恢复至本地数据库！', 'success');
        await refreshData();
      } catch (err: any) {
        showToast(`恢复失败: ${err.message}`, 'error');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const themesList: {
    id: AppTheme;
    name: string;
    desc: string;
    colors: string[];
  }[] = [
    {
      id: 'sunshine-greentea',
      name: t?.settings?.themes?.['sunshine-greentea'] || '日照绿茶 (Sunshine Green Tea)',
      desc: '元气绿茶荧光绿与活力亮粉碰撞，配以烫银渐变与墨黑',
      colors: ['#F04E98', '#00FFBF', '#E8E8E8', '#494949'],
    },
    {
      id: 'plain-cream',
      name: t?.settings?.themes?.['plain-cream'] || '素色奶油 (Plain Cream)',
      desc: '温暖米黄纸张、轻盈素白、柔和奶油杏黄与静谧雾蓝',
      colors: ['#F8F7E2', '#FFFDF3', '#FCF2D7', '#C0D0D3'],
    },
    {
      id: 'haze-coffee',
      name: t?.settings?.themes?.['haze-coffee'] || '雾霾咖蓝 (Haze Coffee Blue)',
      desc: '沉静雾霾灰蓝、灰白米调、暖棕拿铁与浓郁深咖',
      colors: ['#809AAA', '#C4BEB3', '#A38E82', '#473D37'],
    },
    {
      id: 'sweet-lolita',
      name: t?.settings?.themes?.['sweet-lolita'] || '甜心萝莉 (Sweet Lolita)',
      desc: '甜美蜜桃柔粉、轻透蕾丝淡粉、丁香浅紫与深粉玫瑰',
      colors: ['#F8D2E1', '#F9E6F2', '#D0CFE6', '#D48AA0'],
    },
  ];

  return (
    <div id="settings-view-container" className="space-y-6 pb-12" style={{ color: 'var(--text-primary)' }}>
      {/* Top Header */}
      <div className="glass-card p-6 rounded-3xl shadow-sm">
        <div 
          className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-bold mb-2 border"
          style={{
            background: 'var(--theme-secondary-bg)',
            color: 'var(--theme-secondary-text)',
            borderColor: 'var(--theme-secondary-border)'
          }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
          <span>SYSTEM & AI ENGINE SETTINGS</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Settings className="w-6 h-6" style={{ color: 'var(--theme-primary)' }} />
          <span>{t?.settings?.title || '系统与 AI 配置'}</span>
        </h2>
        <p className="text-xs opacity-75 mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
          配置通义千问 AI API 凭证、模型规格、测试连通性、主题色彩、飞书多维表格同步与全量数据迁移。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: 主题配色与语言设置 (Theme & Language Preferences in One Card) */}
        <div className="p-6 rounded-3xl glass-card shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <Palette className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>外观主题与多语言偏好</h3>
                <p className="text-[11px] opacity-75" style={{ color: 'var(--text-secondary)' }}>自定义系统视觉色彩风格与界面显示语言</p>
              </div>
            </div>

            {/* Theme Selection */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t?.settings?.theme || '视觉主题模式 (Visual Theme)'}
                </span>
                <span className="text-[10px] font-mono opacity-60">4 种艺术配色</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {themesList.map((th) => {
                  const isSelected = theme === th.id;
                  return (
                    <div
                      key={th.id}
                      id={`theme-card-${th.id}`}
                      onClick={() => setTheme(th.id)}
                      style={
                        isSelected
                          ? {
                              borderColor: 'var(--theme-primary)',
                              boxShadow: 'var(--theme-primary-shadow)',
                              background: 'var(--bg-surface-elevated)',
                            }
                          : {
                              borderColor: 'var(--border-subtle)',
                            }
                      }
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'scale-[1.02] ring-2'
                          : 'glass-card hover:opacity-90'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs" style={{ color: 'var(--text-primary)' }}>{th.name}</span>
                          {isSelected && (
                            <span 
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                              style={{ background: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                            >
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] opacity-75 mb-2.5" style={{ color: 'var(--text-secondary)' }}>{th.desc}</p>
                      </div>

                      <div className="flex items-center space-x-1.5 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        {th.colors.map((c, i) => (
                          <span
                            key={i}
                            className="w-4 h-4 rounded-full border border-black/10 shadow-inner"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Language Selection */}
            <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Globe className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                  <span>{t?.settings?.language || '界面显示语言 (Language)'}</span>
                </span>
                <span className="text-[10px] font-mono opacity-60">双语即时切换</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setLanguage('zh')}
                  className={`p-3.5 rounded-2xl border text-center transition-all ${
                    language === 'zh'
                      ? 'shadow-sm font-bold ring-2'
                      : 'font-medium opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    background: language === 'zh' ? 'var(--theme-secondary-bg)' : 'var(--bg-surface-elevated)',
                    borderColor: language === 'zh' ? 'var(--theme-primary)' : 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="text-xs block font-bold">简体中文</span>
                  <span className="text-[10px] opacity-60 font-mono mt-0.5 block">Chinese Simplified</span>
                </button>

                <button
                  onClick={() => setLanguage('en')}
                  className={`p-3.5 rounded-2xl border text-center transition-all ${
                    language === 'en'
                      ? 'shadow-sm font-bold ring-2'
                      : 'font-medium opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    background: language === 'en' ? 'var(--theme-secondary-bg)' : 'var(--bg-surface-elevated)',
                    borderColor: language === 'en' ? 'var(--theme-primary)' : 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="text-xs block font-bold">English</span>
                  <span className="text-[10px] opacity-60 font-mono mt-0.5 block">International</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: 千问接入与数据备份 (AI Model Engine & Data Backup in One Card) */}
        <div className="p-6 rounded-3xl glass-card shadow-sm space-y-6">
          {/* AI Settings Part */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
                <div>
                  <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>通义千问接入与数据备份</h3>
                  <p className="text-[11px] opacity-75" style={{ color: 'var(--text-secondary)' }}>配置 AI 大模型 API 凭证与本地全量数据迁移</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span 
                  className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border"
                  style={{
                    background: 'var(--theme-secondary-bg)',
                    color: 'var(--theme-secondary-text)',
                    borderColor: 'var(--theme-secondary-border)'
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: 'var(--theme-primary)' }} />
                  <span>ACTIVE KEY</span>
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveAIConfig} className="space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold" style={{ color: 'var(--text-primary)' }}>API Key (DashScope / 通义千问凭证) *</label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] hover:underline flex items-center gap-1 font-semibold"
                    style={{ color: 'var(--theme-primary)' }}
                  >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showKey ? '隐藏' : '查看'}</span>
                  </button>
                </div>
                <input
                  type={showKey ? 'text' : 'password'}
                  required
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={qwenKey}
                  onChange={(e) => setQwenKey(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl glass-input font-mono text-xs focus:outline-none focus:ring-2 shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1" style={{ color: 'var(--text-primary)' }}>模型规格 (Model Name)</label>
                  <select
                    value={qwenModel}
                    onChange={(e) => setQwenModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs focus:outline-none focus:ring-2 font-medium"
                  >
                    <option value="qwen-plus">qwen-plus (平衡推荐，推理与速度均衡)</option>
                    <option value="qwen-max">qwen-max (超大规模旗舰模型，深度逻辑分析)</option>
                    <option value="qwen-turbo">qwen-turbo (极速响应，实时提取)</option>
                    <option value="qwen-long">qwen-long (超长文本上下文支持)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1" style={{ color: 'var(--text-primary)' }}>API Endpoint 接口地址</label>
                  <input
                    type="text"
                    value={qwenEndpoint}
                    onChange={(e) => setQwenEndpoint(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input font-mono text-xs focus:outline-none focus:ring-2"
                  />
                </div>
              </div>

              {testResult && (
                <div
                  className="p-3 rounded-xl border flex items-center space-x-2 text-xs"
                  style={{
                    background: testResult.success ? 'var(--theme-secondary-bg)' : 'rgba(244,63,94,0.1)',
                    borderColor: testResult.success ? 'var(--theme-primary)' : 'rgba(244,63,94,0.4)',
                    color: testResult.success ? 'var(--text-primary)' : '#e11d48'
                  }}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--theme-primary)' }} />
                  ) : (
                    <Activity className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                  )}
                  <span className="flex-1 font-mono text-[11px]">{testResult.message}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  id="settings-test-ai-btn"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full border font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <Zap className={`w-3.5 h-3.5 ${testingConnection ? 'animate-bounce' : ''}`} style={{ color: 'var(--theme-primary)' }} />
                  <span>{testingConnection ? '测试中...' : '测试 API 连通性'}</span>
                </button>

                <button
                  type="submit"
                  id="settings-save-ai-btn"
                  className="px-5 py-1.5 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all theme-btn-primary"
                >
                  保存 AI 模型配置
                </button>
              </div>
            </form>
          </div>

          {/* Data Backup Part */}
          <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
              <h4 className="font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                {t?.settings?.backup?.title || 'IndexedDB 本地数据备份与全量迁移'}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl border space-y-2 flex flex-col justify-between" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
                <div>
                  <h5 className="font-bold text-[11px]" style={{ color: 'var(--text-primary)' }}>{t?.settings?.backup?.exportJSON || '导出全库 JSON 备份包'}</h5>
                  <p className="text-[10px] opacity-75 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    导出当前全部项目、剧本、人物、设定与事件线。
                  </p>
                </div>
                <button
                  id="settings-export-backup-btn"
                  onClick={handleExportFullJSON}
                  disabled={isExporting}
                  className="inline-flex items-center justify-center space-x-1 px-3 py-1.5 rounded-full border font-bold text-[11px] shadow-sm active:scale-95 disabled:opacity-50 transition-all theme-badge-secondary w-full"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? t.common.loading : (t?.settings?.backup?.exportJSON || '导出全库 JSON')}</span>
                </button>
              </div>

              <div className="p-3 rounded-2xl border space-y-2 flex flex-col justify-between" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
                <div>
                  <h5 className="font-bold text-[11px]" style={{ color: 'var(--text-primary)' }}>{t?.settings?.backup?.importJSON || '导入并恢复 JSON 备份包'}</h5>
                  <p className="text-[10px] opacity-75 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    上传之前导出的备份文件，恢复全部设定数据库。
                  </p>
                </div>
                <label
                  id="settings-import-backup-label"
                  className="inline-flex items-center justify-center space-x-1 px-3 py-1.5 rounded-full border text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow-sm w-full"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <Upload className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                  <span>{isImporting ? t.common.loading : (t?.settings?.backup?.importJSON || '导入恢复 JSON')}</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportFullJSON}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: 飞书多维表格适配器 (Feishu Bitable Adapter - Standalone Full Card) */}
        <div className="p-6 rounded-3xl glass-card shadow-sm space-y-5 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center space-x-2">
              <Link className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  {t?.settings?.feishu?.title || '飞书多维表格 (Feishu Bitable) 适配器'}
                </h3>
                <p className="text-[11px] opacity-75" style={{ color: 'var(--text-secondary)' }}>
                  支持双向增量同步、12 表标准字段映射与 Vercel Serverless 安全代理
                </p>
              </div>
            </div>
            
            {/* Feishu Connection Status Badge */}
            <div className="flex items-center space-x-1.5">
              {feishuSettings.connectionStatus === 'connected' ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>已连接 12/12 表自动映射</span>
                </span>
              ) : feishuSettings.connectionStatus === 'partial' ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>部分映射 ({feishuSettings.matchedTablesCount || Object.keys(feishuSettings.tableMapping || {}).length}/12 表)</span>
                </span>
              ) : feishuSettings.connectionStatus === 'error' ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <AlertCircle className="w-3 h-3" />
                  <span>连接异常 / 请检查配置</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold opacity-75 border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <span>IndexedDB 纯本地模式 (未连接)</span>
                </span>
              )}
            </div>
          </div>

          {/* 12-Table Auto-Mapping Status Matrix */}
          <div className="p-3.5 rounded-2xl border space-y-2.5 text-xs" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <div className="font-bold flex items-center space-x-1.5" style={{ color: 'var(--text-primary)' }}>
                <Activity className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                <span>NARRATIVE OS 12 张标准数据表自动映射</span>
              </div>
              <span className="text-[10px] opacity-75 font-mono">
                已映射: {feishuSettings.matchedTablesCount ?? Object.keys(feishuSettings.tableMapping || {}).length} / 12
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
              {STANDARD_12_TABLES.map((std) => {
                const isMapped = !!feishuSettings.tableMapping?.[std.key];
                const mappedTableId = feishuSettings.tableMapping?.[std.key];
                return (
                  <div
                    key={std.key}
                    className={`p-2 rounded-xl border text-[11px] flex items-center justify-between transition-all ${
                      isMapped
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium'
                        : 'border-dashed opacity-70 text-secondary'
                    }`}
                    style={!isMapped ? { background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' } : {}}
                    title={isMapped ? `已映射表: ${std.name} (${mappedTableId})` : `多维表格中暂未匹配「${std.name}」，本地使用 IndexedDB`}
                  >
                    <div className="truncate pr-1">
                      <span className="font-bold block truncate">{std.name}</span>
                      <span className="text-[9px] opacity-75 block truncate">{std.labelZh.split(' ')[0]}</span>
                    </div>
                    {isMapped ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 opacity-60 flex-shrink-0">
                        本地
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {feishuSettings.missingTables && feishuSettings.missingTables.length > 0 && (
              <div className="text-[11px] opacity-80 pt-1 text-amber-600 dark:text-amber-400">
                <span>提示：多维表格中缺少 <strong>{feishuSettings.missingTables.join(', ')}</strong> 表。这些模块将安全保存在本地 IndexedDB 中，无需担心数据丢失。</span>
              </div>
            )}
          </div>

          {/* Security Notice Banner */}
          <div 
            className="p-3.5 rounded-2xl border text-xs flex items-start space-x-2.5"
            style={{
              background: 'var(--theme-secondary-bg)',
              borderColor: 'var(--theme-secondary-border)',
              color: 'var(--text-primary)',
            }}
          >
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--theme-primary)' }} />
            <div className="space-y-1 text-[11px] leading-relaxed">
              <p className="font-bold">🔒 Vercel Serverless 安全隔离架构：</p>
              <p className="opacity-80">
                飞书应用密钥（<code>FEISHU_APP_SECRET</code>）仅保存在服务端环境变量中，禁止进入前端 bundle、本地存储或日志。Serverless 代理端自动获取 <code>tenant_access_token</code> 并完成 CRUD 及增量同步。
              </p>
              <p className="opacity-80">
                若飞书未配置或网络故障，NARRATIVE OS 将自动平滑运行在浏览器本地 <strong>IndexedDB</strong>，绝不影响系统正常使用。
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveFeishuConfig} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {t?.settings?.feishu?.appToken || 'App Token / Base ID (多维表格标识)'}
                </label>
                <input
                  type="text"
                  placeholder="例如: bascnxxxxxxxx 或留空使用环境变量"
                  value={feishuAppToken}
                  onChange={(e) => setFeishuAppToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-mono text-xs focus:outline-none"
                />
                <span className="text-[10px] opacity-60 mt-1 block">多维表格 URL 中的 app_token (如 /base/bascnXXXX)</span>
              </div>

              <div>
                <label className="block font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {t?.settings?.feishu?.tableId || 'Table ID (数据表标识)'}
                </label>
                <input
                  type="text"
                  placeholder="例如: tblxxxxxxxx 或留空使用环境变量"
                  value={feishuTableId}
                  onChange={(e) => setFeishuTableId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-mono text-xs focus:outline-none"
                />
                <span className="text-[10px] opacity-60 mt-1 block">多维表格 URL 中的 table_id (如 ?table=tblXXXX)</span>
              </div>
            </div>

            {/* Auto-Sync Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
              <div className="space-y-0.5">
                <div className="font-bold flex items-center space-x-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Zap className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary)' }} />
                  <span>实时自动同步 (Auto-Sync)</span>
                </div>
                <p className="text-[10px] opacity-70" style={{ color: 'var(--text-secondary)' }}>
                  在创作剧本、编辑人物或推进设定时，在后台静默增量同步至飞书多维表格。
                </p>
              </div>
              <input
                type="checkbox"
                checked={feishuAutoSync}
                onChange={(e) => setFeishuAutoSync(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer accent-pink-500"
              />
            </div>

            {/* Last Sync Info & Test Result */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl border text-xs" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 opacity-60" />
                <div>
                  <span className="opacity-60 block text-[10px]">最近一次同步 (Last Sync):</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                    {feishuSettings.lastSyncTime
                      ? new Date(feishuSettings.lastSyncTime).toLocaleString()
                      : '尚未执行同步'}
                  </span>
                </div>
              </div>

              {feishuSettings.lastSyncMessage && (
                <div className="text-[11px] opacity-75 font-mono line-clamp-1 max-w-sm" title={feishuSettings.lastSyncMessage}>
                  {feishuSettings.lastSyncMessage}
                </div>
              )}
            </div>

            {feishuTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                  feishuTestResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}
              >
                {feishuTestResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span>{feishuTestResult.message}</span>
              </div>
            )}

            {/* Action Buttons: Test Connection, Sync Now, Save Config */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleTestFeishu}
                  disabled={testingFeishu}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingFeishu ? 'animate-spin' : ''}`} style={{ color: 'var(--theme-primary)' }} />
                  <span>{testingFeishu ? '正在连通测试...' : '测试连接 (Test Connection)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncFeishuNow}
                  disabled={syncingFeishu}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 theme-btn-primary"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingFeishu ? 'animate-spin' : ''}`} />
                  <span>{syncingFeishu ? '正在双向增量同步...' : '立即同步 (Sync Now)'}</span>
                </button>
              </div>

              <button
                type="submit"
                className="px-5 py-1.5 rounded-full border font-bold text-xs shadow-sm active:scale-95 transition-all theme-badge-secondary"
              >
                保存配置 (Save)
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
