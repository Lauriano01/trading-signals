import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";

import {
  MarketDirection,
  MarketSettings,
  MarketVolatility,
} from "./types";

function randomBetween(
  min: number,
  max: number
): number {
  return (
    Math.random() * (max - min) + min
  );
}

function getVolatilityRange(
  volatility: MarketVolatility
) {
  switch (volatility) {
    case "LOW":
      return {
        min: 0.01,
        max: 0.05,
      };

    case "MEDIUM":
      return {
        min: 0.03,
        max: 0.15,
      };

    case "HIGH":
      return {
        min: 0.08,
        max: 0.40,
      };

    default:
      return {
        min: 0.03,
        max: 0.10,
      };
  }
}

function getMinutesFromTime(
  time: string
): number {
  const [hours, minutes] =
    time.split(":").map(Number);

  return hours * 60 + minutes;
}

function getCurrentMinutes(): number {
  const now = new Date();

  return (
    now.getHours() * 60 +
    now.getMinutes()
  );
}

function calculateProgress(
  currentMinutes: number,
  startMinutes: number,
  peakMinutes: number
): number {
  if (peakMinutes <= startMinutes) {
    return 1;
  }

  if (currentMinutes <= startMinutes) {
    return 0;
  }

  if (currentMinutes >= peakMinutes) {
    return 1;
  }

  return (
    (currentMinutes - startMinutes) /
    (peakMinutes - startMinutes)
  );
}

function calculateMovement(
  currentPrice: number,
  targetPrice: number,
  direction: MarketDirection,
  volatility: MarketVolatility,
  progress: number
): number {
  if (currentPrice <= 0) {
    return 0;
  }

  const range =
    getVolatilityRange(volatility);

  const randomNoise =
    randomBetween(
      range.min,
      range.max
    ) / 100;

  let movement = 0;

  if (direction === "UP") {
    const distance =
      targetPrice - currentPrice;

    const directionalForce =
      Math.abs(distance) /
      Math.max(targetPrice, currentPrice);

    movement =
      randomNoise +
      directionalForce *
        (0.10 + progress * 0.20);

    if (currentPrice >= targetPrice) {
      movement =
        -randomNoise * 0.5;
    }
  }

  if (direction === "DOWN") {
    const distance =
      currentPrice - targetPrice;

    const directionalForce =
      Math.abs(distance) /
      Math.max(targetPrice, currentPrice);

    movement =
      randomNoise +
      directionalForce *
        (0.10 + progress * 0.20);

    if (currentPrice <= targetPrice) {
      movement =
        -randomNoise * 0.5;
    }
  }

  if (direction === "NEUTRAL") {
    movement =
      randomBetween(
        -randomNoise,
        randomNoise
      );
  }

  if (direction === "VOLATILE") {
    movement =
      randomBetween(
        -randomNoise * 1.5,
        randomNoise * 1.5
      );
  }

  if (
    direction === "UP" &&
    Math.random() < 0.30
  ) {
    movement *= -0.5;
  }

  if (
    direction === "DOWN" &&
    Math.random() < 0.30
  ) {
    movement *= -0.5;
  }

  if (
    direction === "UP" &&
    currentPrice < targetPrice
  ) {
    return Math.abs(movement);
  }

  if (
    direction === "DOWN" &&
    currentPrice > targetPrice
  ) {
    return -Math.abs(movement);
  }

  return movement;
}

export async function runMarketEngine(
  assetId: string
) {
  try {
    const settingsRef = doc(
      db,
      "brokerMarketSettings",
      "global"
    );

    const settingsSnapshot =
      await getDoc(settingsRef);

    if (!settingsSnapshot.exists()) {
      return null;
    }

    const settings =
      settingsSnapshot.data() as MarketSettings;

    if (
      settings.mode !== "AUTO" ||
      settings.enabled !== true
    ) {
      return null;
    }

    const assetRef = doc(
      db,
      "brokerAssets",
      assetId
    );

    const assetSnapshot =
      await getDoc(assetRef);

    if (!assetSnapshot.exists()) {
      return null;
    }

    const asset =
      assetSnapshot.data();

    const currentPrice =
      Number(asset.price);

    if (
      !Number.isFinite(currentPrice) ||
      currentPrice <= 0
    ) {
      return null;
    }

    const currentMinutes =
      getCurrentMinutes();

    const startMinutes =
      getMinutesFromTime(
        settings.startTime
      );

    const peakMinutes =
      getMinutesFromTime(
        settings.peakTime
      );

    const endMinutes =
      getMinutesFromTime(
        settings.endTime
      );

    if (
      currentMinutes < startMinutes ||
      currentMinutes > endMinutes
    ) {
      return null;
    }

    const progress =
      calculateProgress(
        currentMinutes,
        startMinutes,
        peakMinutes
      );

    let movement =
      calculateMovement(
        currentPrice,
        Number(settings.targetPrice),
        settings.direction,
        settings.volatility,
        progress
      );

    const correction =
      Number(
        settings.correctionPercent
      ) / 100;

    if (
      correction > 0 &&
      Math.random() < 0.15
    ) {
      movement =
        -Math.abs(movement) *
        correction;
    }

    let newPrice =
      currentPrice *
      (1 + movement);

    const targetPrice =
      Number(settings.targetPrice);

    if (
      settings.direction === "UP" &&
      newPrice > targetPrice
    ) {
      newPrice =
        targetPrice;
    }

    if (
      settings.direction === "DOWN" &&
      newPrice < targetPrice
    ) {
      newPrice =
        targetPrice;
    }

    newPrice =
      Math.max(
        0.0001,
        newPrice
      );

    const changePercent =
      ((newPrice - currentPrice) /
        currentPrice) *
      100;

    let priceDirection:
      | "UP"
      | "DOWN"
      | "NEUTRAL" =
      "NEUTRAL";

    if (changePercent > 0.001) {
      priceDirection = "UP";
    } else if (
      changePercent < -0.001
    ) {
      priceDirection = "DOWN";
    }

    await updateDoc(
      assetRef,
      {
        previousPrice: currentPrice,
        price: newPrice,
        direction: priceDirection,
        updatedAt: serverTimestamp(),
      }
    );

    return {
      assetId,
      symbol: asset.symbol,
      oldPrice: currentPrice,
      newPrice,
      changePercent,
      direction: priceDirection,
    };
  } catch (error) {
    console.error(
      "Erro no motor de mercado:",
      error
    );

    return null;
  }
}