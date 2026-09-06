import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { adminDb } from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "laelsonlavosier@gmail.com";

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function getVolatility(volatility: string) {
  switch (volatility) {
    case "LOW":
      return 0.00025;

    case "MEDIUM":
      return 0.0008;

    case "HIGH":
      return 0.002;

    default:
      return 0.0008;
  }
}

function calculateMovement(
  currentPrice: number,
  targetPrice: number,
  direction: string,
  volatility: string,
  correctionPercent: number
) {
  const volatilityAmount = getVolatility(volatility);

  const noise = randomBetween(
    -volatilityAmount,
    volatilityAmount
  );

  if (direction === "NEUTRAL") {
    return noise;
  }

  if (direction === "VOLATILE") {
    return randomBetween(
      -volatilityAmount * 3,
      volatilityAmount * 3
    );
  }

  if (direction === "UP") {
    const distance =
      (targetPrice - currentPrice) / currentPrice;

    const force = Math.abs(distance) * 0.02;

    let movement = force + noise;

    if (
      Math.random() <
      Math.min(0.5, correctionPercent / 100)
    ) {
      movement = -Math.abs(movement) * 0.35;
    }

    return movement;
  }

  if (direction === "DOWN") {
    const distance =
      (currentPrice - targetPrice) / currentPrice;

    const force = Math.abs(distance) * 0.02;

    let movement = -force + noise;

    if (
      Math.random() <
      Math.min(0.5, correctionPercent / 100)
    ) {
      movement = Math.abs(movement) * 0.35;
    }

    return movement;
  }

  return noise;
}

async function runMarketEngine() {
  const settingsSnapshot = await adminDb
    .collection("brokerMarketSettings")
    .doc("global")
    .get();

  if (!settingsSnapshot.exists) {
    return {
      success: true,
      running: false,
      updatedAssets: 0,
      message:
        "Nenhuma configuração de mercado encontrada.",
    };
  }

  const settings = settingsSnapshot.data();

  if (
    settings?.mode !== "AUTO" ||
    settings?.enabled !== true
  ) {
    return {
      success: true,
      running: false,
      updatedAssets: 0,
      message:
        "Motor automático desligado.",
    };
  }

  const globalDirection =
    settings.direction ?? "NEUTRAL";

  const globalVolatility =
    settings.volatility ?? "MEDIUM";

  const globalTargetPrice = Number(
    settings.targetPrice ?? 0
  );

  const correctionPercent = Number(
    settings.correctionPercent ?? 1
  );

  const assetsSnapshot = await adminDb
    .collection("brokerAssets")
    .where("active", "==", true)
    .get();

  const results = [];

  for (const assetDoc of assetsSnapshot.docs) {
    const asset = assetDoc.data();

    const currentPrice = Number(asset.price);

    if (
      !Number.isFinite(currentPrice) ||
      currentPrice <= 0
    ) {
      continue;
    }

    const direction =
      asset.marketDirection ??
      globalDirection;

    const volatility =
      asset.marketVolatility ??
      globalVolatility;

    const targetPrice = Number(
      asset.marketTargetPrice ??
        globalTargetPrice
    );

    if (
      (direction === "UP" ||
        direction === "DOWN") &&
      (!Number.isFinite(targetPrice) ||
        targetPrice <= 0)
    ) {
      continue;
    }

    const movement = calculateMovement(
      currentPrice,
      targetPrice,
      direction,
      volatility,
      correctionPercent
    );

    let newPrice =
      currentPrice * (1 + movement);

    newPrice = Math.max(
      0.0001,
      newPrice
    );

    if (
      direction === "UP" &&
      targetPrice > 0 &&
      newPrice > targetPrice
    ) {
      newPrice = targetPrice;
    }

    if (
      direction === "DOWN" &&
      targetPrice > 0 &&
      newPrice < targetPrice
    ) {
      newPrice = targetPrice;
    }

    const changePercent =
      ((newPrice - currentPrice) /
        currentPrice) *
      100;

    let priceDirection:
      | "UP"
      | "DOWN"
      | "NEUTRAL" = "NEUTRAL";

    if (changePercent > 0.001) {
      priceDirection = "UP";
    } else if (changePercent < -0.001) {
      priceDirection = "DOWN";
    }

    await assetDoc.ref.update({
      previousPrice: currentPrice,
      price: newPrice,
      direction: priceDirection,
      updatedAt: new Date(),
    });

    results.push({
      id: assetDoc.id,
      symbol: asset.symbol,
      oldPrice: currentPrice,
      newPrice,
      changePercent,
      marketDirection: direction,
      marketVolatility: volatility,
      targetPrice,
    });
  }

  return {
    success: true,
    running: true,
    updatedAssets: results.length,
    assets: results,
    timestamp: new Date().toISOString(),
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    console.log(
      "[MARKET ENGINE] POST recebido."
    );

    const authHeader =
      request.headers.get("authorization");

    if (
      !authHeader?.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          error: "Não autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    const idToken =
      authHeader.substring(7);

    const decodedToken =
      await getAuth().verifyIdToken(
        idToken
      );

    if (
      decodedToken.email !==
      ADMIN_EMAIL
    ) {
      return NextResponse.json(
        {
          error: "Acesso negado.",
        },
        {
          status: 403,
        }
      );
    }

    console.log(
      "[MARKET ENGINE] Admin autenticado."
    );

    const result =
      await runMarketEngine();

    console.log(
      "[MARKET ENGINE] Resultado:",
      {
        running: result.running,
        updatedAssets:
          result.updatedAssets,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[MARKET ENGINE] Erro:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        running: false,
        error:
          "Erro ao executar o motor automático.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const cronSecret =
      process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        {
          error:
            "CRON_SECRET não configurado.",
        },
        {
          status: 500,
        }
      );
    }

    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      authorization !==
      `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const result =
      await runMarketEngine();

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[MARKET ENGINE] Erro no cron:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        running: false,
        error:
          "Erro ao executar o cron do mercado.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}