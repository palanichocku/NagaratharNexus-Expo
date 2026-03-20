import { supabase } from '../lib/supabase';

export type SystemConfig = {
  maintenanceMode: boolean;
  allowRegistration: boolean;
  requireApproval: boolean;
  autoPauseThreshold: string;
  favoritesLimit: string;
  welcomeMessage: string;
  themeName: string;
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  maintenanceMode: false,
  allowRegistration: true,
  requireApproval: true,
  autoPauseThreshold: '3',
  favoritesLimit: '5',
  welcomeMessage: '',
  themeName: 'warm',
};

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const { data, error } = await supabase.rpc('get_public_system_config');

    if (error) throw error;

    const cfg = (data ?? {}) as any;

    return {
  maintenanceMode: !!cfg.maintenanceMode,
  allowRegistration:
    typeof cfg.allowRegistration === 'boolean'
      ? cfg.allowRegistration
      : typeof cfg.registrationEnabled === 'boolean'
        ? cfg.registrationEnabled
        : true,
  requireApproval:
    typeof cfg.requireApproval === 'boolean'
      ? cfg.requireApproval
      : typeof cfg.requireApprovalForSearch === 'boolean'
        ? cfg.requireApprovalForSearch
        : true,
  autoPauseThreshold: String(
    cfg.autoPauseThreshold ?? cfg.autoFlagThreshold ?? 3
  ),
  favoritesLimit: String(cfg.favoritesLimit ?? 5),
  welcomeMessage: String(cfg.welcomeMessage ?? ''),
  themeName: String(cfg.themeName ?? 'warm'),
};
  } catch (err) {
    console.error('[SYSTEM_CONFIG] Failed to fetch public config:', err);
    return DEFAULT_SYSTEM_CONFIG;
  }
}