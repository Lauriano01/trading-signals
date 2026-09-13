import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "laelsonlavosier@gmail.com";

/**
 * Margem mínima da operação.
 *
 * Quando a margem restante chegar a
 * US$ 0,50 ou menos, a operação será
 * liquidada automaticamente.
 */
const LIQUIDATION_MARGIN = 0.5;

/**
 * Alavancagem automática usada pelo simulador.
 *
 * O usuário não precisa configurar isso
 * na interface.
 */
const DEFAULT_LEVERAGE = 10;

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/**
 * Volatilidade por ciclo.
 *
 * LOW    -> 0.5% até 1.5%
 * MEDIUM -> 1% até 3%
 * HIGH   -> 3% até 5%
 */
function getVolatilityRange(
  volatility: string
) {
  switch (volatility) {
    case "LOW":
      return {
        min: 0.005,
        max: 0.015,
      };

    case "MEDIUM":
      return {
        min: 0.01,
        max: 0.03,
      };

    case "HIGH":
      return {
        min: 0.03,
        max: 0.05,
      };

    default:
      return {
        min: 0.01,
        max: 0.03,
      };
  }
}

/**
 * Limita o movimento máximo de um ciclo.
 */
function limitMovement(
  movement: number,
  maxMovement: number
) {
  return Math.max(
    -maxMovement,
    Math.min(maxMovement, movement)
  );
}

function calculateMovement(
  currentPrice: number,
  targetPrice: number,
  direction: string,
  volatility: string,
  correctionPercent: number
) {
  const volatilityRange =
    getVolatilityRange(volatility);

  /**
   * Sorteia a intensidade de cada ciclo.
   */
  const cycleVolatility =
    randomBetween(
      volatilityRange.min,
      volatilityRange.max
    );

  /**
   * Pequeno ruído adicional.
   */
  const noise =
    randomBetween(
      -cycleVolatility * 0.2,
      cycleVolatility * 0.2
    );

  /**
   * MERCADO NEUTRO
   */
  if (direction === "NEUTRAL") {
    return randomBetween(
      -cycleVolatility,
      cycleVolatility
    );
  }

  /**
   * MERCADO VOLÁTIL
   */
  if (direction === "VOLATILE") {
    const movement =
      randomBetween(
        -cycleVolatility,
        cycleVolatility
      ) + noise;

    return limitMovement(
      movement,
      volatilityRange.max
    );
  }

  /**
   * MERCADO EM ALTA
   */
  if (direction === "UP") {
    const distance =
      targetPrice > 0
        ? (targetPrice - currentPrice) /
          currentPrice
        : 0;

    const force =
      Math.abs(distance) * 0.02;

    let movement =
      force +
      randomBetween(
        cycleVolatility * 0.7,
        cycleVolatility
      ) +
      noise;

    /**
     * Correção temporária contra a tendência.
     */
    if (
      Math.random() <
      Math.min(
        0.5,
        correctionPercent / 100
      )
    ) {
      movement =
        -Math.abs(movement) * 0.35;
    }

    return limitMovement(
      movement,
      volatilityRange.max
    );
  }

  /**
   * MERCADO EM BAIXA
   */
  if (direction === "DOWN") {
    const distance =
      targetPrice > 0
        ? (currentPrice - targetPrice) /
          currentPrice
        : 0;

    const force =
      Math.abs(distance) * 0.02;

    let movement =
      -force -
      randomBetween(
        cycleVolatility * 0.7,
        cycleVolatility
      ) +
      noise;

    /**
     * Correção temporária contra a tendência.
     */
    if (
      Math.random() <
      Math.min(
        0.5,
        correctionPercent / 100
      )
    ) {
      movement =
        Math.abs(movement) * 0.35;
    }

    return limitMovement(
      movement,
      volatilityRange.max
    );
  }

  return randomBetween(
    -cycleVolatility,
    cycleVolatility
  );
}

/**
 * ============================================================
 * LIQUIDAÇÃO AUTOMÁTICA
 * ============================================================
 *
 * Verifica as posições OPEN de um ativo
 * usando o preço novo do mercado.
 *
 * A quantidade da posição já foi calculada
 * com a alavancagem na abertura.
 */
async function liquidatePositionsForAsset(
  assetId: string,
  closePrice: number
) {
  if (
    !Number.isFinite(closePrice) ||
    closePrice <= 0
  ) {
    return 0;
  }

  const positionsSnapshot =
    await adminDb
      .collection("brokerPositions")
      .where(
        "assetId",
        "==",
        assetId
      )
      .where(
        "status",
        "==",
        "OPEN"
      )
      .get();

  let liquidatedCount = 0;

  for (
    const positionDoc of
      positionsSnapshot.docs
  ) {
    try {
      await adminDb.runTransaction(
        async (transaction) => {
          /**
           * Releitura dentro da transação.
           */
          const positionSnap =
            await transaction.get(
              positionDoc.ref
            );

          if (
            !positionSnap.exists
          ) {
            return;
          }

          const position =
            positionSnap.data();

          /**
           * Outra requisição pode ter fechado
           * a posição enquanto esta estava
           * sendo processada.
           */
          if (
            position?.status !==
            "OPEN"
          ) {
            return;
          }

          const userId =
            String(
              position?.userId || ""
            );

          const storedAssetId =
            String(
              position?.assetId || ""
            );

          const side =
            position?.side;

          const entryPrice =
            Number(
              position?.entryPrice ?? 0
            );

          const quantity =
            Number(
              position?.quantity ?? 0
            );

          const amountUsd =
            Number(
              position?.amountUsd ?? 0
            );

          const leverage =
            Number(
              position?.leverage ??
                DEFAULT_LEVERAGE
            );

          if (
            !userId ||
            storedAssetId !== assetId ||
            (side !== "LONG" &&
              side !== "SHORT") ||
            !Number.isFinite(
              entryPrice
            ) ||
            entryPrice <= 0 ||
            !Number.isFinite(
              quantity
            ) ||
            quantity <= 0 ||
            !Number.isFinite(
              amountUsd
            ) ||
            amountUsd <= 0
          ) {
            return;
          }

          /**
           * ==========================================
           * CALCULAR P/L
           * ==========================================
           *
           * A quantity já contém a exposição
           * da alavancagem.
           */
          let pnl = 0;

          if (side === "LONG") {
            pnl =
              (closePrice -
                entryPrice) *
              quantity;
          } else {
            pnl =
              (entryPrice -
                closePrice) *
              quantity;
          }

          if (
            !Number.isFinite(pnl)
          ) {
            return;
          }

          /**
           * ==========================================
           * MARGEM RESTANTE
           * ==========================================
           *
           * Exemplo:
           *
           * Margem = 10
           * P/L = -9.70
           *
           * Restante = 0.30
           */
          const remainingMargin =
            amountUsd + pnl;

          /**
           * Ainda existe mais de US$0,50
           * de margem.
           */
          if (
            remainingMargin >
            LIQUIDATION_MARGIN
          ) {
            return;
          }

          const accountRef =
            adminDb
              .collection(
                "brokerAccounts"
              )
              .doc(userId);

          const accountSnap =
            await transaction.get(
              accountRef
            );

          if (!accountSnap.exists) {
            return;
          }

          const accountData =
            accountSnap.data();

          const currentBalance =
            Number(
              accountData?.balance ??
                0
            );

          /**
           * ==========================================
           * VALOR DEVOLVIDO
           * ==========================================
           *
           * Nunca devolve valor negativo.
           */
          const returnedAmount =
            Math.max(
              0,
              remainingMargin
            );

          const newBalance =
            currentBalance +
            returnedAmount;

          const pnlPercent =
            (pnl /
              amountUsd) *
            100;

          if (
            !Number.isFinite(
              newBalance
            ) ||
            newBalance < 0
          ) {
            return;
          }

          /**
           * Atualiza o saldo.
           */
          transaction.update(
            accountRef,
            {
              balance:
                newBalance,

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );

          /**
           * Fecha a posição.
           */
          transaction.update(
            positionDoc.ref,
            {
              status: "CLOSED",

              closePrice,

              pnl,

              pnlPercent,

              closedAt:
                FieldValue.serverTimestamp(),

              autoClosed: true,

              liquidation: true,

              liquidationReason:
                "Margem insuficiente.",

              remainingMargin:
                returnedAmount,

              leverage:
                Number.isFinite(
                  leverage
                )
                  ? leverage
                  : DEFAULT_LEVERAGE,
            }
          );

          liquidatedCount++;

          console.log(
            "[BROKER LIQUIDATION]",
            {
              positionId:
                positionDoc.id,

              userId,

              assetId,

              side,

              entryPrice,

              closePrice,

              amountUsd,

              leverage,

              quantity,

              pnl,

              pnlPercent,

              remainingMargin,

              returnedAmount,

              newBalance,
            }
          );
        }
      );
    } catch (error) {
      console.error(
        "[BROKER LIQUIDATION] Erro ao liquidar posição:",
        positionDoc.id,
        error
      );
    }
  }

  return liquidatedCount;
}

async function runMarketEngine() {
  const settingsSnapshot =
    await adminDb
      .collection(
        "brokerMarketSettings"
      )
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

  const settings =
    settingsSnapshot.data();

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
    settings.direction ??
    "NEUTRAL";

  const globalVolatility =
    settings.volatility ??
    "MEDIUM";

  const globalTargetPrice =
    Number(
      settings.targetPrice ?? 0
    );

  const correctionPercent =
    Number(
      settings.correctionPercent ??
        1
    );

  const assetsSnapshot =
    await adminDb
      .collection("brokerAssets")
      .where(
        "active",
        "==",
        true
      )
      .get();

  const results = [];

  for (
    const assetDoc of
      assetsSnapshot.docs
  ) {
    const asset =
      assetDoc.data();

    const currentPrice =
      Number(asset.price);

    if (
      !Number.isFinite(
        currentPrice
      ) ||
      currentPrice <= 0
    ) {
      continue;
    }

    /**
     * A direção individual tem prioridade
     * sobre a direção global.
     */
    const direction =
      asset.marketDirection ??
      globalDirection;

    const volatility =
      asset.marketVolatility ??
      globalVolatility;

    /**
     * O preço-alvo individual tem prioridade
     * sobre o alvo global.
     */
    const targetPrice =
      Number(
        asset.marketTargetPrice ??
          globalTargetPrice
      );

    if (
      (direction === "UP" ||
        direction === "DOWN") &&
      (!Number.isFinite(
        targetPrice
      ) ||
        targetPrice <= 0)
    ) {
      continue;
    }

    const movement =
      calculateMovement(
        currentPrice,
        targetPrice,
        direction,
        volatility,
        correctionPercent
      );

    let newPrice =
      currentPrice *
      (1 + movement);

    newPrice = Math.max(
      0.0001,
      newPrice
    );

    /**
     * Mantém o preço dentro do alvo.
     */
    if (
      direction === "UP" &&
      targetPrice > 0 &&
      newPrice > targetPrice
    ) {
      newPrice =
        targetPrice;
    }

    if (
      direction === "DOWN" &&
      targetPrice > 0 &&
      newPrice < targetPrice
    ) {
      newPrice =
        targetPrice;
    }

    const changePercent =
      ((newPrice -
        currentPrice) /
        currentPrice) *
      100;

    let priceDirection:
      | "UP"
      | "DOWN"
      | "NEUTRAL" =
      "NEUTRAL";

    if (
      changePercent >
      0.001
    ) {
      priceDirection =
        "UP";
    } else if (
      changePercent <
      -0.001
    ) {
      priceDirection =
        "DOWN";
    }

    /**
     * Atualiza o preço.
     */
    await assetDoc.ref.update({
      previousPrice:
        currentPrice,

      price:
        newPrice,

      direction:
        priceDirection,

      updatedAt:
        new Date(),
    });

    /**
     * ==========================================
     * VERIFICAR LIQUIDAÇÃO
     * ==========================================
     *
     * O preço já foi atualizado.
     * Agora todas as posições desse ativo
     * são avaliadas usando o novo preço.
     */
    const liquidatedPositions =
      await liquidatePositionsForAsset(
        assetDoc.id,
        newPrice
      );

    results.push({
      id: assetDoc.id,

      symbol:
        asset.symbol,

      oldPrice:
        currentPrice,

      newPrice,

      changePercent,

      marketDirection:
        direction,

      marketVolatility:
        volatility,

      targetPrice,

      liquidatedPositions,
    });
  }

  return {
    success: true,

    running: true,

    updatedAssets:
      results.length,

    assets:
      results,

    timestamp:
      new Date().toISOString(),
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
      request.headers.get(
        "authorization"
      );

    if (
      !authHeader?.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Não autenticado.",
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
          error:
            "Acesso negado.",
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
        running:
          result.running,

        updatedAssets:
          result.updatedAssets,
      }
    );

    return NextResponse.json(
      result
    );
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
          error:
            "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const result =
      await runMarketEngine();

    return NextResponse.json(
      result
    );
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