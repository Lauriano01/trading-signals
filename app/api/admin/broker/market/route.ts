import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { adminDb } from "../../../../../lib/firebaseAdmin";

const ADMIN_EMAIL = "laelsonlavosier@gmail.com";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);

    const decodedToken =
      await getAuth().verifyIdToken(idToken);

    if (decodedToken.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const snapshot = await adminDb
      .collection("brokerMarketSettings")
      .doc("global")
      .get();

    if (!snapshot.exists) {
      return NextResponse.json({
        success: true,
        settings: null,
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        id: snapshot.id,
        ...snapshot.data(),
      },
    });
  } catch (error) {
    console.error(
      "Erro ao carregar configurações do mercado:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível carregar as configurações do mercado.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);

    const decodedToken =
      await getAuth().verifyIdToken(idToken);

    if (decodedToken.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      mode,
      direction,
      volatility,
      targetPrice,
      correctionPercent,
      startTime,
      peakTime,
      endTime,
      enabled,
    } = body;

    if (
      mode !== "MANUAL" &&
      mode !== "AUTO"
    ) {
      return NextResponse.json(
        { error: "Modo de mercado inválido." },
        { status: 400 }
      );
    }

    if (
      direction !== "UP" &&
      direction !== "DOWN" &&
      direction !== "NEUTRAL" &&
      direction !== "VOLATILE"
    ) {
      return NextResponse.json(
        { error: "Direção inválida." },
        { status: 400 }
      );
    }

    if (
      volatility !== "LOW" &&
      volatility !== "MEDIUM" &&
      volatility !== "HIGH"
    ) {
      return NextResponse.json(
        { error: "Volatilidade inválida." },
        { status: 400 }
      );
    }

    const numericTargetPrice = Number(targetPrice);
    const numericCorrection = Number(correctionPercent);

    if (
      !Number.isFinite(numericTargetPrice) ||
      numericTargetPrice <= 0
    ) {
      return NextResponse.json(
        { error: "Preço alvo inválido." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(numericCorrection) ||
      numericCorrection < 0
    ) {
      return NextResponse.json(
        { error: "Correção inválida." },
        { status: 400 }
      );
    }

    const marketEnabled =
      enabled === true;

    await adminDb
      .collection("brokerMarketSettings")
      .doc("global")
      .set(
        {
          mode,
          direction,
          volatility,

          targetPrice:
            numericTargetPrice,

          correctionPercent:
            numericCorrection,

          startTime:
            startTime || "09:00",

          peakTime:
            peakTime || "16:00",

          endTime:
            endTime || "22:00",

          enabled:
            marketEnabled,

          updatedAt:
            new Date(),

          updatedBy:
            decodedToken.uid,

          updatedByEmail:
            decodedToken.email,
        },
        { merge: true }
      );

    return NextResponse.json({
      success: true,

      enabled:
        marketEnabled,

      message:
        "Configurações do mercado salvas com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro ao salvar configurações do mercado:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível salvar as configurações.",
      },
      { status: 500 }
    );
  }
}