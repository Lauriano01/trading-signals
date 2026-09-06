import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../lib/firebaseAdmin";

const ADMIN_EMAIL = "laelsonlavosier@gmail.com";

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

    const decodedToken =
      await getAuth().verifyIdToken(idToken);

    // =========================
    // VERIFICAR ADMIN
    // =========================
    if (decodedToken.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Acesso negado. Somente o administrador." },
        { status: 403 }
      );
    }

    // =========================
    // DADOS
    // =========================
    const body = await request.json();

    const userId = String(body.userId || "");
    const operation = body.operation;
    const amount = Number(body.amount);

    if (!userId) {
      return NextResponse.json(
        { error: "Usuário inválido." },
        { status: 400 }
      );
    }

    if (operation !== "ADD" && operation !== "REMOVE") {
      return NextResponse.json(
        { error: "Operação inválida." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Valor inválido." },
        { status: 400 }
      );
    }

    // =========================
    // CONTA DO USUÁRIO
    // =========================
    const accountRef = adminDb
      .collection("brokerAccounts")
      .doc(userId);

    let newBalance = 0;
    let oldBalance = 0;

    await adminDb.runTransaction(async (transaction) => {
      const accountSnap =
        await transaction.get(accountRef);

      if (!accountSnap.exists) {
        throw new Error(
          "Conta do broker não encontrada."
        );
      }

      const accountData = accountSnap.data();

      oldBalance = Number(
        accountData?.balance ?? 0
      );

      if (!Number.isFinite(oldBalance)) {
        throw new Error(
          "Saldo atual inválido."
        );
      }

      if (operation === "ADD") {
        newBalance = oldBalance + amount;
      } else {
        if (amount > oldBalance) {
          throw new Error(
            "Saldo insuficiente para remover este valor."
          );
        }

        newBalance = oldBalance - amount;
      }

      transaction.update(accountRef, {
        balance: newBalance,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // =========================
      // HISTÓRICO
      // =========================
      const historyRef = adminDb
        .collection("brokerBalanceHistory")
        .doc();

      transaction.set(historyRef, {
        userId,
        operation,
        amount,
        oldBalance,
        newBalance,
        adminUid: decodedToken.uid,
        adminEmail: decodedToken.email,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      userId,
      operation,
      amount,
      oldBalance,
      newBalance,
    });
  } catch (error) {
    console.error(
      "Erro administrativo de saldo:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Erro interno.";

    if (
      message ===
      "Conta do broker não encontrada."
    ) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }

    if (
      message ===
      "Saldo insuficiente para remover este valor."
    ) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Não foi possível alterar o saldo.",
      },
      { status: 500 }
    );
  }
}