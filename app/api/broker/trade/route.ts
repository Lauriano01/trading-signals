import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../../../lib/firebaseAdmin";

type TradeSide = "LONG" | "SHORT";
type TradeAction = "OPEN" | "CLOSE";

export async function POST(request: NextRequest) {
  try {
    // =========================
    // AUTENTICAÇÃO
    // =========================
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);

    const decodedToken = await getAuth().verifyIdToken(idToken);

    const userId = decodedToken.uid;

    // =========================
    // DADOS DA REQUISIÇÃO
    // =========================
    const body = await request.json();

    const action = body.action as TradeAction;

    if (action !== "OPEN" && action !== "CLOSE") {
      return NextResponse.json(
        { error: "Ação inválida." },
        { status: 400 }
      );
    }

    // ============================================================
    // ABRIR OPERAÇÃO
    // ============================================================
    if (action === "OPEN") {
      const assetId = String(body.assetId || "");
      const side = body.side as TradeSide;
      const amountUsd = Number(body.amountUsd);

      if (!assetId) {
        return NextResponse.json(
          { error: "Ativo inválido." },
          { status: 400 }
        );
      }

      if (side !== "LONG" && side !== "SHORT") {
        return NextResponse.json(
          { error: "Direção da operação inválida." },
          { status: 400 }
        );
      }

      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        return NextResponse.json(
          { error: "Valor da operação inválido." },
          { status: 400 }
        );
      }

      const accountRef = adminDb
        .collection("brokerAccounts")
        .doc(userId);

      const assetRef = adminDb
        .collection("brokerAssets")
        .doc(assetId);

      const positionRef = adminDb
        .collection("brokerPositions")
        .doc();

      let result: {
        positionId: string;
        balance: number;
        entryPrice: number;
        quantity: number;
      };

      await adminDb.runTransaction(async (transaction) => {
        const accountSnap = await transaction.get(accountRef);
        const assetSnap = await transaction.get(assetRef);

        if (!accountSnap.exists) {
          throw new Error("Conta do broker não encontrada.");
        }

        if (!assetSnap.exists) {
          throw new Error("Ativo não encontrado.");
        }

        const accountData = accountSnap.data();
        const assetData = assetSnap.data();

        const currentBalance = Number(accountData?.balance ?? 0);
        const entryPrice = Number(assetData?.price ?? 0);
        const symbol = String(assetData?.symbol ?? "");

        if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
          throw new Error("Preço do ativo inválido.");
        }

        if (!symbol) {
          throw new Error("Símbolo do ativo inválido.");
        }

        if (amountUsd > currentBalance) {
          throw new Error("Saldo insuficiente.");
        }

        const quantity = amountUsd / entryPrice;

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error("Quantidade inválida.");
        }

        // O valor da operação é reservado no saldo
        const newBalance = currentBalance - amountUsd;

        transaction.update(accountRef, {
          balance: newBalance,
          updatedAt: FieldValue.serverTimestamp(),
        });

        transaction.set(positionRef, {
          userId,
          assetId,
          symbol,
          side,
          entryPrice,
          quantity,
          amountUsd,
          status: "OPEN",
          createdAt: FieldValue.serverTimestamp(),
        });

        result = {
          positionId: positionRef.id,
          balance: newBalance,
          entryPrice,
          quantity,
        };
      });

      return NextResponse.json({
        success: true,
        action: "OPEN",
        positionId: result!.positionId,
        balance: result!.balance,
        entryPrice: result!.entryPrice,
        quantity: result!.quantity,
      });
    }

    // ============================================================
    // FECHAR OPERAÇÃO
    // ============================================================
    if (action === "CLOSE") {
      const positionId = String(body.positionId || "");

      if (!positionId) {
        return NextResponse.json(
          { error: "Posição inválida." },
          { status: 400 }
        );
      }

      const positionRef = adminDb
        .collection("brokerPositions")
        .doc(positionId);

      const accountRef = adminDb
        .collection("brokerAccounts")
        .doc(userId);

      let result: {
        balance: number;
        pnl: number;
        pnlPercent: number;
        closePrice: number;
      };

      await adminDb.runTransaction(async (transaction) => {
        const positionSnap = await transaction.get(positionRef);
        const accountSnap = await transaction.get(accountRef);

        if (!positionSnap.exists) {
          throw new Error("Posição não encontrada.");
        }

        if (!accountSnap.exists) {
          throw new Error("Conta do broker não encontrada.");
        }

        const positionData = positionSnap.data();
        const accountData = accountSnap.data();

        // Verifica que a posição pertence ao usuário
        if (positionData?.userId !== userId) {
          throw new Error("Você não tem permissão para fechar esta posição.");
        }

        if (positionData?.status !== "OPEN") {
          throw new Error("Esta posição já está fechada.");
        }

        const assetId = String(positionData?.assetId || "");
        const side = positionData?.side as TradeSide;
        const entryPrice = Number(positionData?.entryPrice ?? 0);
        const quantity = Number(positionData?.quantity ?? 0);
        const amountUsd = Number(positionData?.amountUsd ?? 0);

        if (!assetId) {
          throw new Error("Ativo da posição não encontrado.");
        }

        if (side !== "LONG" && side !== "SHORT") {
          throw new Error("Direção da posição inválida.");
        }

        if (entryPrice <= 0 || quantity <= 0 || amountUsd <= 0) {
          throw new Error("Dados da posição inválidos.");
        }

        const assetRef = adminDb
          .collection("brokerAssets")
          .doc(assetId);

        const assetSnap = await transaction.get(assetRef);

        if (!assetSnap.exists) {
          throw new Error("Ativo não encontrado.");
        }

        const assetData = assetSnap.data();

        // IMPORTANTE:
        // O preço usado para fechar vem do servidor,
        // não do navegador do usuário.
        const closePrice = Number(assetData?.price ?? 0);

        if (!Number.isFinite(closePrice) || closePrice <= 0) {
          throw new Error("Preço atual do ativo inválido.");
        }

        // =========================
        // CALCULAR LUCRO / PREJUÍZO
        // =========================
        let pnl = 0;

        if (side === "LONG") {
          pnl = (closePrice - entryPrice) * quantity;
        } else {
          pnl = (entryPrice - closePrice) * quantity;
        }

        const pnlPercent = (pnl / amountUsd) * 100;

        const currentBalance = Number(accountData?.balance ?? 0);

        /*
         * Na abertura:
         * saldo - amountUsd
         *
         * No fechamento:
         * saldo + amountUsd + pnl
         *
         * Exemplo de lucro:
         * 10.000
         * -1.000 abertura
         * = 9.000
         * +1.000 +100 lucro
         * = 10.100
         *
         * Exemplo de prejuízo:
         * 10.000
         * -1.000 abertura
         * = 9.000
         * +1.000 -100 prejuízo
         * = 9.900
         */

        const returnedAmount = amountUsd + pnl;

        const newBalance = currentBalance + returnedAmount;

        if (newBalance < 0) {
          throw new Error("Saldo resultante inválido.");
        }

        transaction.update(accountRef, {
          balance: newBalance,
          updatedAt: FieldValue.serverTimestamp(),
        });

        transaction.update(positionRef, {
          status: "CLOSED",
          closePrice,
          pnl,
          pnlPercent,
          closedAt: FieldValue.serverTimestamp(),
        });

        result = {
          balance: newBalance,
          pnl,
          pnlPercent,
          closePrice,
        };
      });

      return NextResponse.json({
        success: true,
        action: "CLOSE",
        balance: result!.balance,
        pnl: result!.pnl,
        pnlPercent: result!.pnlPercent,
        closePrice: result!.closePrice,
      });
    }

    return NextResponse.json(
      { error: "Ação não suportada." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erro na API de trading:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Erro interno.";

    if (
      message === "Saldo insuficiente." ||
      message === "Valor da operação inválido."
    ) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    if (
      message === "Conta do broker não encontrada." ||
      message === "Posição não encontrada." ||
      message === "Ativo não encontrado."
    ) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }

    if (message === "Você não tem permissão para fechar esta posição.") {
      return NextResponse.json(
        { error: message },
        { status: 403 }
      );
    }

    if (message === "Esta posição já está fechada.") {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: message || "Não foi possível executar a operação." },
      { status: 500 }
    );
  }
}