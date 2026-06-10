// App-state bucket for the detection log.
// - `foreground` — app active.
// - `background` — backgrounded, screen unlocked.
// - `backgroundLocked` — backgrounded AND screen locked.
// - `terminated` — fired during system-initiated relaunch (BLE/region wake-up).
export type AppStateBucket =
  | 'foreground'
  | 'background'
  | 'backgroundLocked'
  | 'terminated';

export type DetectionLogEntry = {
  id: string;
  timestamp: number;
  state: AppStateBucket;
  type: string;
  detail: string;
};

export const APP_STATE_LABEL: Record<AppStateBucket, string> = {
  foreground: 'Foreground',
  background: 'Background',
  backgroundLocked: 'Background (tela bloqueada)',
  terminated: 'Terminated (relaunch)',
};

export const APP_STATE_COLOR: Record<AppStateBucket, string> = {
  foreground: '#4caf50',
  background: '#ff9800',
  backgroundLocked: '#607d8b',
  terminated: '#9c27b0',
};

// Shared geofence / two-eyes event model used by App and the Two-Eyes modal.

export type GeofenceEventKind =
  | 'region-enter'
  | 'region-exit'
  | 'scan-active'
  | 'scan-paused'
  // v2.5 — Bluetooth "two eyes" zone (iOS-only)
  | 'bt-zone-enter'
  | 'bt-zone-exit';

export type GeofenceEventEntry = {
  id: string;
  kind: GeofenceEventKind;
  timestamp: number;
  detail: string;
};

export const geofenceEventTitle = (kind: GeofenceEventKind): string => {
  switch (kind) {
    case 'region-enter':
      return '👁 LOCATION — ENTROU';
    case 'region-exit':
      return '👁 LOCATION — SAIU';
    case 'scan-active':
      return 'SCAN LIGADO';
    case 'scan-paused':
      return 'SCAN PAUSADO';
    case 'bt-zone-enter':
      return '👁 BLUETOOTH — ENTROU';
    case 'bt-zone-exit':
      return '👁 BLUETOOTH — SAIU';
  }
};

export const geofenceEventColor = (kind: GeofenceEventKind): string => {
  switch (kind) {
    case 'region-enter':
    case 'scan-active':
      return '#4caf50';
    case 'region-exit':
      return '#ff9800';
    case 'scan-paused':
      return '#9e9e9e';
    case 'bt-zone-enter':
      return '#2196f3';
    case 'bt-zone-exit':
      return '#ff9800';
  }
};
