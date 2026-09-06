export type MarketMode = "MANUAL" | "AUTO";

export type MarketDirection =
  | "UP"
  | "DOWN"
  | "NEUTRAL"
  | "VOLATILE";

export type MarketVolatility =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export type MarketSettings = {
  mode: MarketMode;
  direction: MarketDirection;
  volatility: MarketVolatility;

  targetPrice: number;
  correctionPercent: number;

  startTime: string;
  peakTime: string;
  endTime: string;

  enabled: boolean;

  updatedAt?: unknown;
  updatedBy?: string;
  updatedByEmail?: string;
};

export type MarketTick = {
  assetId: string;
  symbol: string;

  oldPrice: number;
  newPrice: number;

  changePercent: number;

  direction: MarketDirection;

  timestamp: Date;
};