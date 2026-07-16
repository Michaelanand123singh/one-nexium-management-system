/**
 * Workstation telemetry analytics — shared response shapes for GET /api/workstation/analytics.
 */

export type WorkstationTimeBucket = "hour" | "day";

export type WorkstationAnalyticsTimePoint = {
  bucket: string;
  total: number;
  idle: number;
  inProject: number;
  /** total - idle (approx. "active at keyboard" samples) */
  active: number;
  inProjectPct: number;
  /** Average keyboard+mouse events/min in this bucket (null if no data from new agent) */
  avgInputRate: number | null;
  /** Average app switches per sample in this bucket */
  avgAppSwitches: number | null;
};

export type WorkstationTopProcess = {
  processName: string;
  count: number;
};

export type WorkstationAnalyticsPayload = {
  range: {
    from: string;
    to: string;
    bucket: WorkstationTimeBucket;
  };
  summary: {
    totalSamples: number;
    idleSamples: number;
    inProjectSamples: number;
    pctIdle: number;
    pctInProject: number;
    /** Average keyboard+mouse events per minute across all samples with data */
    avgInputRate: number | null;
    /** Average app switches per sample across all samples with data */
    avgAppSwitches: number | null;
    /** Estimated active work hours in range (non-idle distinct hours) */
    activeHours: number;
    /** % of samples with low app switching and active input (focus indicator) */
    focusScore: number | null;
    /** % of samples where meeting was detected via metadata */
    meetingPct: number;
  };
  timeSeries: WorkstationAnalyticsTimePoint[];
  topProcesses: WorkstationTopProcess[];
};
