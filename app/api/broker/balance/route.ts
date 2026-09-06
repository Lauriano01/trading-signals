import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../../../lib/firebaseAdmin";

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

    const decodedToken = await getAuth().verifyIdToken(idToken);

    const userId = decodedToken.uid;

    const body = await request.json();

    const amount = Number(body.amount);
    const operation = body.operation;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Valor inválido." },
        { status: 400 }
      );
    }

    if (operation !== "ADD" && operation !== "REMOVE") {
      return NextResponse.json(
        { error: "Operação inválida." },
        { status: 400 }
      );
    }

    const accountRef = adminDb
      .collection("brokerAccounts")
      .doc(userId);

    await adminDb.runTransaction(async (transaction) => {
      const accountSnap = await transaction.get(accountRef);

      if (!accountSnap.exists) {
        throw new Error("Conta do broker não encontrada.");
      }

      const accountData = accountSnap.data();

      const currentBalance = Number(accountData?.balance ?? 0);

      let newBalance = currentBalance;

      if (operation === "ADD") {
        newBalance = currentBalance + amount;
      }

      if (operation === "REMOVE") {
        if (amount > currentBalance) {
          throw new Error("Saldo insuficiente.");
        }

        newBalance = currentBalance - amount;
      }

      transaction.update(accountRef, {
        balance: newBalance,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const updatedAccount = await accountRef.get();

    return NextResponse.json({
      success: true,
      balance: updatedAccount.data()?.balance ?? 0,
    });
  } catch (error) {
    console.error("Erro na API de saldo:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Erro interno.";

    if (message === "Saldo insuficiente.") {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    if (message === "Conta do broker não encontrada.") {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Não foi possível atualizar o saldo." },
      { status: 500 }
    );
  }
}