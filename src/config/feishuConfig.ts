/**
 * 飞书多维表格统一固定配置 (Unified Feishu Bitable Configuration)
 * ============================================================================
 * 本文件是 NARRATIVE OS 全项目唯一的飞书配置入口。
 * 电脑与手机访问同一 Vercel 部署时，所有 AI 解析、飞书读写均从此处读取配置。
 *
 * 🔧 修改指南：
 *   仅需修改下方常量值即可，无需改动其他文件。
 *   - FEISHU_APP_ID     : 飞书自建应用 App ID
 *   - FEISHU_APP_SECRET : 飞书自建应用 App Secret
 *   - FEISHU_APP_TOKEN  : 多维表格 Base ID (URL 中的 app_token，如 /base/QPlNbg...)
 *   - FEISHU_TABLE_ID   : 默认数据表 ID (URL 中的 table_id，作为 fallback 使用)
 *
 * ℹ️ 12 张标准表的 Table ID 由 Serverless Proxy 根据 Base 内表名自动发现映射，
 *    无需在此手动列出。FEISHU_TABLE_ID 仅作为兜底默认值。
 * ============================================================================
 */

export const FEISHU_CONFIG = {
  APP_ID: 'cli_aafa7acc1978dcb5',
  APP_SECRET: 'VNu9VPsHlhBULPz01BuufhZtAFVDad7u',
  APP_TOKEN: 'QPlNbgIxqaHqxGs6phMcfieenXb',
  TABLE_ID: 'tblNndQs54eNclUB',
} as const;

/** 飞书自建应用 App ID */
export const FEISHU_APP_ID: string = FEISHU_CONFIG.APP_ID;

/** 飞书自建应用 App Secret（仅服务端 Serverless Proxy 使用） */
export const FEISHU_APP_SECRET: string = FEISHU_CONFIG.APP_SECRET;

/** 飞书多维表格 Base ID / App Token */
export const FEISHU_APP_TOKEN: string = FEISHU_CONFIG.APP_TOKEN;

/** 默认数据表 ID（fallback，12 张表的实际 ID 由 Proxy 自动发现） */
export const FEISHU_TABLE_ID: string = FEISHU_CONFIG.TABLE_ID;
