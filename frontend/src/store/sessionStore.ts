import { create } from "zustand";

export type FatigueLevel = 0 | 1 | 2 | 3;

export interface RmssdPoint {
  t: number;   // unix ms
  v: number;   // RMSSD ms
}

interface SessionState {
  // Connection
  connected: boolean;
  sensorConnected: boolean;   // true after first RR packet received
  sensorModel: string | null; // sensor model name if provided
  demoMode: boolean;
  sessionId: string | null;

  // HRV
  rmssdHistory: RmssdPoint[];
  currentRmssd: number | null;
  currentFatigue: FatigueLevel;

  // GPS
  currentSpeed: number | null;
  currentLat: number | null;
  currentLng: number | null;
  drivingDetected: boolean;   // popup trigger
  drivingConfirmed: boolean;  // user clicked Yes

  // Alert
  alertActive: boolean;
  alertFatigueLevel: FatigueLevel;

  // Actions
  setConnected: (v: boolean) => void;
  setSensorConnected: (model: string | null) => void;
  setDemoMode: (v: boolean) => void;
  pushRR: (rmssd: number, fatigue: FatigueLevel, t: number) => void;
  pushGPS: (speed: number, lat: number, lng: number) => void;
  setDrivingDetected: (v: boolean) => void;
  setDrivingConfirmed: (v: boolean) => void;
  triggerAlert: (level: FatigueLevel) => void;
  dismissAlert: () => void;
  reset: () => void;
}

const MAX_HISTORY = 120;

export const useSessionStore = create<SessionState>((set) => ({
  connected: false,
  sensorConnected: false,
  sensorModel: null,
  demoMode: false,
  sessionId: null,
  rmssdHistory: [],
  currentRmssd: null,
  currentFatigue: 0,
  currentSpeed: null,
  currentLat: null,
  currentLng: null,
  drivingDetected: false,
  drivingConfirmed: false,
  alertActive: false,
  alertFatigueLevel: 0,

  setConnected: (v) => set({ connected: v }),
  setSensorConnected: (model) => set({ sensorConnected: true, sensorModel: model }),
  setDemoMode: (v) => set({ demoMode: v }),

  pushRR: (rmssd, fatigue, t) =>
    set((s) => ({
      currentRmssd: rmssd,
      currentFatigue: fatigue,
      rmssdHistory: [
        ...s.rmssdHistory.slice(-MAX_HISTORY + 1),
        { t, v: rmssd },
      ],
    })),

  pushGPS: (speed, lat, lng) =>
    set({ currentSpeed: speed, currentLat: lat, currentLng: lng }),

  setDrivingDetected: (v) => set({ drivingDetected: v }),
  setDrivingConfirmed: (v) => set({ drivingConfirmed: v }),

  triggerAlert: (level) => set({ alertActive: true, alertFatigueLevel: level }),
  dismissAlert: () => set({ alertActive: false }),

  reset: () =>
    set({
      connected: false,
      sensorConnected: false,
      sensorModel: null,
      sessionId: null,
      rmssdHistory: [],
      currentRmssd: null,
      currentFatigue: 0,
      currentSpeed: null,
      currentLat: null,
      currentLng: null,
      drivingDetected: false,
      drivingConfirmed: false,
      alertActive: false,
      alertFatigueLevel: 0,
    }),
}));
