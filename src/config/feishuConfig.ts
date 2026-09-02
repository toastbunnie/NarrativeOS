/**
 * 飞书多维表格 - 前端固定配置 (Frontend Unified Config)
 * ============================================================================
 * 本文件供前端（feishuAdapter / SettingsView）读取飞书 APP_TOKEN / TABLE_ID，
 * 用于在设置页只读展示，确保电脑与手机访问同一 Vercel 部署时配置一致。
 *
 * 🔧 修改指南：
 *   修改 Key / Table ID 时，请同步更新两处（值必须完全一致）：
 *     1. 本文件（前端显示用）
 *     2. api/feishu.ts 顶部的 FEISHU_* 常量（服务端 Serverless Proxy 使用）
 *
 *   - FEISHU_APP_TOKEN : 多维表格 Base ID (URL 中的 app_token，如 /base/QPlNbg...)
 *   - FEISHU_TABLE_ID  : 默认数据表 ID (URL 中的 table_id，作为 fallback 使用)
 *
 * ℹ️ APP_ID / APP_SECRET 属于服务端密钥，仅写在 api/feishu.ts 中，
 *    不在此文件出现，避免被打入前端 bundle 造成泄露。
 *
 * ℹ️ 12 张标准表的实际 Table ID 由 Serverless Proxy 根据 Base 内表名自动发现映射，
 *    无需在此手动列出。FEISHU_TABLE_ID 仅作为兜底默认值。
 * ============================================================================
 */

export const FEISHU_CONFIG = {
  APP_TOKEN: 'QPlNbgIxqaHqxGs6phMcfieenXb',
  TABLE_ID: 'tblNndQs54eNclUB',
} as const;

/** 飞书多维表格 Base ID / App Token（前端展示用） */
export const FEISHU_APP_TOKEN: string = FEISHU_CONFIG.APP_TOKEN;

/** 默认数据表 ID（fallback，12 张表的实际 ID 由 Proxy 自动发现） */
export const FEISHU_TABLE_ID: string = FEISHU_CONFIG.TABLE_ID;

