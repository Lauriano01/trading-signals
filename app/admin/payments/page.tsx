
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";

const ADMIN_EMAIL = "laelsonlavosier@gmail.com";

type AccessRequest = {
  id: string;
  userId: string;
  userEmail?: string;
  opportunityId: string;
  asset?: string;
  market?: string;
  amount?: number;
  currency?: string;
  method?: string;
  status: string;
  createdAt?: {
    seconds: number;
    nanoseconds?: number;
  };
};

export default function PaymentsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");

  /*
   * =========================
   * VERIFICAR ADMINISTRADOR
   * =========================
   */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      const email = currentUser.email?.toLowerCase() || "";

      if (email !== ADMIN_EMAIL.toLowerCase()) {
        router.replace("/market");
        return;
      }

      setUser(currentUser);
      setChecking(false);
    });

    return () => unsubscribe();
  }, [router]);

  /*
   * =========================
   * CARREGAR PEDIDOS
   * =========================
   */

  async function loadRequests() {
    try {
      setLoading(true);
      setError("");

      if (!user) {
        return;
      }

      /*
       * Segurança adicional no frontend.
       *
       * Mesmo que alguém tente acessar
       * /admin/payments diretamente,
       * somente o administrador continua.
       */

      const email = user.email?.toLowerCase() || "";

      if (email !== ADMIN_EMAIL.toLowerCase()) {
        router.replace("/market");
        return;
      }

      const accessesRef = collection(db, "accesses");

      const requestsQuery = query(
        accessesRef,
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(requestsQuery);

      const data: AccessRequest[] = snapshot.docs.map((item) => {
        const firestoreData = item.data();

        return {
          id: item.id,
          userId: firestoreData.userId || "",
          userEmail: firestoreData.userEmail || "",
          opportunityId: firestoreData.opportunityId || "",
          asset: firestoreData.asset || "",
          market: firestoreData.market || "",
          amount: firestoreData.amount || 0,
          currency: firestoreData.currency || "USD",
          method: firestoreData.method || "",
          status: firestoreData.status || "pending",
          createdAt: firestoreData.createdAt,
        };
      });

      setRequests(data);
    } catch (error: unknown) {
      console.error("Erro ao carregar pedidos:", error);

      if (
        error &&
        typeof error === "object" &&
        "code" in error
      ) {
        const firebaseError = error as { code: string };

        if (
          firebaseError.code ===
          "permission-denied"
        ) {
          setError(
            "O Firebase recusou o acesso. Verifique se está conectado com o administrador e se as regras do Firestore foram publicadas."
          );
        } else {
          setError(
            "Não foi possível carregar os pedidos."
          );
        }
      } else {
        setError(
          "Não foi possível carregar os pedidos."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && !checking) {
      loadRequests();
    }
  }, [user, checking]);

  /*
   * =========================
   * APROVAR PEDIDO
   * =========================
   */

  async function approveRequest(requestId: string) {
    try {
      setProcessing(requestId);
      setError("");

      await updateDoc(
        doc(db, "accesses", requestId),
        {
          status: "active",
        }
      );

      setRequests((previous) =>
        previous.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: "active",
              }
            : request
        )
      );

      alert(
        "Pagamento aprovado. O acesso à análise foi liberado."
      );
    } catch (error: unknown) {
      console.error(
        "Erro ao aprovar pedido:",
        error
      );

      setError(
        "Não foi possível aprovar o pedido. Verifique as regras do Firestore."
      );
    } finally {
      setProcessing(null);
    }
  }

  /*
   * =========================
   * REJEITAR PEDIDO
   * =========================
   */

  async function rejectRequest(requestId: string) {
    try {
      setProcessing(requestId);
      setError("");

      await updateDoc(
        doc(db, "accesses", requestId),
        {
          status: "rejected",
        }
      );

      setRequests((previous) =>
        previous.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: "rejected",
              }
            : request
        )
      );

      alert("Pedido rejeitado.");
    } catch (error: unknown) {
      console.error(
        "Erro ao rejeitar pedido:",
        error
      );

      setError(
        "Não foi possível rejeitar o pedido. Verifique as regras do Firestore."
      );
    } finally {
      setProcessing(null);
    }
  }

  /*
   * =========================
   * LOADING DE AUTENTICAÇÃO
   * =========================
   */

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-blue-500" />

          <p className="mt-4 text-sm text-slate-400">
            Verificando acesso administrativo...
          </p>
        </div>
      </main>
    );
  }

  /*
   * =========================
   * SEM USUÁRIO
   * =========================
   */

  if (!user) {
    return null;
  }

  /*
   * =========================
   * PEDIDOS PENDENTES
   * =========================
   */

  const pendingRequests = requests.filter(
    (request) =>
      request.status === "pending"
  );

  /*
   * =========================
   * INTERFACE
   * =========================
   */

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Trade
              <span className="text-blue-500">
                Signal
              </span>{" "}
              Admin
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Pagamentos e desbloqueios
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/admin")
            }
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
          >
            ← Voltar ao Admin
          </button>
        </header>

        {/* ADMIN LOGADO */}

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Administrador conectado
          </p>

          <p className="mt-2 font-medium text-white">
            {user.email}
          </p>
        </div>

        {/* CONTADOR */}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
            <p className="text-sm text-yellow-400">
              Pendentes
            </p>

            <p className="mt-2 text-3xl font-bold">
              {pendingRequests.length}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
            <p className="text-sm text-green-400">
              Aprovados
            </p>

            <p className="mt-2 text-3xl font-bold">
              {
                requests.filter(
                  (request) =>
                    request.status === "active"
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
            <p className="text-sm text-red-400">
              Rejeitados
            </p>

            <p className="mt-2 text-3xl font-bold">
              {
                requests.filter(
                  (request) =>
                    request.status === "rejected"
                ).length
              }
            </p>
          </div>

        </div>

        {/* ERRO */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-400">
            <p className="font-semibold">
              Erro
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        )}

        {/* LOADING */}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">

            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-blue-500" />

            <p className="mt-4 text-sm text-slate-400">
              Carregando pedidos...
            </p>

          </div>
        ) : requests.length === 0 ? (

          /* SEM PEDIDOS */

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">

            <div className="text-4xl">
              📭
            </div>

            <h2 className="mt-4 text-xl font-bold">
              Nenhum pedido
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Quando um cliente solicitar o
              desbloqueio de uma análise,
              o pedido aparecerá aqui.
            </p>

          </div>

        ) : (

          /* LISTA DE PEDIDOS */

          <div className="grid gap-5">

            {requests.map((request) => (

              <div
                key={request.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >

                {/* TOPO */}

                <div className="flex flex-wrap items-start justify-between gap-4">

                  <div>

                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Cliente
                    </p>

                    <p className="mt-1 font-semibold">
                      {request.userEmail ||
                        "E-mail não disponível"}
                    </p>

                    <p className="mt-1 break-all text-xs text-slate-500">
                      UID: {request.userId}
                    </p>

                  </div>

                  {/* STATUS */}

                  <div
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      request.status ===
                      "pending"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : request.status ===
                          "active"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {request.status ===
                    "pending"
                      ? "⏳ Pendente"
                      : request.status ===
                        "active"
                      ? "✅ Ativo"
                      : "❌ Rejeitado"}
                  </div>

                </div>

                {/* INFORMAÇÕES */}

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-slate-500">
                      Ativo
                    </p>

                    <p className="mt-1 font-semibold">
                      {request.asset ||
                        "Não informado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-slate-500">
                      Mercado
                    </p>

                    <p className="mt-1 font-semibold">
                      {request.market ||
                        "Não informado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-slate-500">
                      Valor
                    </p>

                    <p className="mt-1 font-semibold">
                      $
                      {Number(
                        request.amount || 0
                      ).toFixed(2)}{" "}
                      {request.currency ||
                        "USD"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-slate-500">
                      Método
                    </p>

                    <p className="mt-1 font-semibold">
                      {request.method ===
                      "card"
                        ? "💳 Cartão"
                        : request.method ===
                          "crypto"
                        ? "₿ Cripto"
                        : request.method ||
                          "Não informado"}
                    </p>
                  </div>

                </div>

                {/* IDS */}

                <div className="mt-4 grid gap-4 sm:grid-cols-2">

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-slate-500">
                      ID da oportunidade
                    </p>

                    <p className="mt-1 break-all text-sm">
                      {request.opportunityId}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-slate-500">
                      ID do pedido
                    </p>

                    <p className="mt-1 break-all text-sm">
                      {request.id}
                    </p>
                  </div>

                </div>

                {/* AÇÕES */}

                {request.status ===
                  "pending" && (

                  <div className="mt-6 flex flex-wrap gap-3">

                    <button
                      type="button"
                      onClick={() =>
                        approveRequest(
                          request.id
                        )
                      }
                      disabled={
                        processing ===
                        request.id
                      }
                      className="rounded-xl bg-green-600 px-6 py-3 font-semibold transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processing ===
                      request.id
                        ? "Processando..."
                        : "✅ Aprovar e desbloquear"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        rejectRequest(
                          request.id
                        )
                      }
                      disabled={
                        processing ===
                        request.id
                      }
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-6 py-3 font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ❌ Rejeitar
                    </button>

                  </div>
                )}

              </div>

            ))}

          </div>
        )}

      </div>
    </main>
  );
}

