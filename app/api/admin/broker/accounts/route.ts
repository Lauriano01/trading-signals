import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { adminDb } from "../../../../../lib/firebaseAdmin";

const ADMIN_EMAIL = "laelsonlavosier@gmail.com";

export async function GET(request: NextRequest) {
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
        {
          error:
            "Acesso negado. Somente o administrador.",
        },
        { status: 403 }
      );
    }

    // =========================
    // CONTAS DO BROKER
    // =========================

    const snapshot = await adminDb
      .collection("brokerAccounts")
      .get();

    const accounts = await Promise.all(
      snapshot.docs.map(async (item) => {
        const data = item.data();

        const userId = String(
          data.userId ?? item.id
        );

        let name = "Usuário";
        let email = "";

        // =========================
        // BUSCAR DADOS DO FIREBASE AUTH
        // =========================

        try {
          const userRecord =
            await getAuth().getUser(userId);

          name =
            userRecord.displayName ||
            "Usuário";

          email =
            userRecord.email || "";
        } catch (error) {
          console.error(
            `Não foi possível carregar usuário ${userId}:`,
            error
          );
        }

        return {
          id: item.id,
          userId,
          name,
          email,
          balance: Number(
            data.balance ?? 0
          ),
          currency:
            data.currency ?? "USD",
        };
      })
    );

    // =========================
    // RESPOSTA
    // =========================

    return NextResponse.json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error(
      "Erro ao carregar contas do broker:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível carregar as contas.",
      },
      { status: 500 }
    );
  }
}