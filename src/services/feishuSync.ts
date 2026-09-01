export {
  getStoredFeishuSettings,
  saveFeishuSettings,
  testFeishuConnection,
  syncWithFeishuNow,
  triggerAutoSyncDebounced,
  FEISHU_SETTINGS_KEY,
} from './feishuAdapter';

import { getStoredFeishuSettings, saveFeishuSettings, testFeishuConnection, syncWithFeishuNow } from './feishuAdapter';
import { FeishuSettings } from '../types';

export const FEISHU_STORAGE_KEY = 'narrative_os_feishu_config_v2';

export async function syncWithFeishu(settings?: FeishuSettings, _localData?: any): Promise<{ success: boolean; syncedRecords: number; message: string }> {
  if (settings) {
    saveFeishuSettings(settings);
  }
  const result = await syncWithFeishuNow();
  return {
    success: result.success,
    syncedRecords: result.totalSynced || 0,
    message: result.message,
  };
}

