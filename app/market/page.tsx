"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";

type Opportunity = {
  id: string;
  market: string;
  asset: string;
  direction: string;
  entry: string;
  stopLoss: string;
  takeProfit: string;
  risk: string;
  analysis: string;
};

type AccessRequest = {
  id: string;
  userId: string;
  opportunityId: string;
  status: string;
};

const markets = [
  {
    name: "Crypto",
    icon: "₿",
    description: "Bitcoin, Ethereum e outras criptomoedas",
  },
  {
    name: "Forex",
    icon: "💱",
    description: "Pares de moedas internacionais",
  },
  {
    name: "Acoes",
    icon: "📈",
    description: "Mercados de ações",
  },
  {
    name: "Indices",
    icon: "📊",
    description: "Principais índices mundiais",
  },
  {
    name: "Commodities",
    icon: "🥇",
    description: "Ouro, petróleo e outros ativos",
  },
];

export default function MarketPage() {
  const router = useRouter();

  const [selectedMarket, setSelectedMarket] = useState("Crypto");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeAccesses, setActiveAccesses] = useState<string[]>([]);
  const [checkingAccess, setCheckingAccess] = useState(false);

  /*
   * VERIFICAR LOGIN
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);

      if (!currentUser) {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  /*
   * CARREGAR OPORTUNIDADES
   */
  useEffect(() => {
    async function loadOpportunities() {
      try {
        setLoading(true);
        setError("");

        const opportunitiesRef = collection(db, "opportunities");

        const opportunitiesQuery = query(
          opportunitiesRef,
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(opportunitiesQuery);

        const data: Opportunity[] = snapshot.docs.map((item) => {
          const data = item.data();

          return {
            id: item.id,
            market: data.market || "",
            asset: data.asset || "",
            direction: data.direction || "",
            entry: data.entry || "",
            stopLoss: data.stopLoss || "",
            takeProfit: data.takeProfit || "",
            risk: data.risk || "",
            analysis: data.analysis || "",
          };
        });

        setOpportunities(data);
      } catch (err) {
        console.error("Erro ao carregar oportunidades:", err);
        setError("Não foi possível carregar as oportunidades.");
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

  /*
   * VERIFICAR ACESSOS DO CLIENTE
   */
  useEffect(() => {
    async function loadAccesses() {
      if (!user) {
        setActiveAccesses([]);
        return;
      }

      try {
        setCheckingAccess(true);

        const accessesRef = collection(db, "accesses");

        const accessesQuery = query(
          accessesRef,
          where("userId", "==", user.uid),
          where("status", "==", "active")
        );

        const snapshot = await getDocs(accessesQuery);

        const activeIds: string[] = snapshot.docs
          .map((item) => {
            const data = item.data() as AccessRequest;
            return data.opportunityId;
          })
          .filter(Boolean);

        setActiveAccesses(activeIds);
      } catch (err) {
        console.error("Erro ao verificar acessos:", err);
        setActiveAccesses([]);
      } finally {
        setCheckingAccess(false);
      }
    }

    loadAccesses();
  }, [user]);

  /*
   * LOGOUT
   */
  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  }

  /*
   * DESBLOQUEAR
   */
  function handleUnlock(opportunity: Opportunity) {
    if (!user) {
      router.push("/login");
      return;
    }

    router.push(
      `/deposit?opportunityId=${encodeURIComponent(
        opportunity.id
      )}&asset=${encodeURIComponent(
        opportunity.asset
      )}&market=${encodeURIComponent(
        opportunity.market
      )}`
    );
  }

  /*
   * VERIFICAR SE O CLIENTE TEM ACESSO
   */
  function hasAccess(opportunityId: string) {
    return activeAccesses.includes(opportunityId);
  }

  const marketOpportunities = opportunities.filter(
    (opportunity) => opportunity.market === selectedMarket
  );

  /*
   * AGUARDANDO LOGIN
   */
  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-white/10 border-t-blue-500 sm:h-10 sm:w-10" />

          <p className="mt-4 text-sm text-slate-400">
            Verificando sessão...
          </p>
        </div>
      </main>
    );
  }

  /*
   * SEM LOGIN
   */
  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">

      {/* HEADER */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">

          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              Trade<span className="text-blue-500">Signal</span>
            </h1>

            <p className="text-[11px] text-slate-400 sm:text-xs">
              Daily Market Opportunities
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">

            <Link
              href="/"
              className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-xs text-slate-300 transition hover:bg-white/5 sm:flex-none sm:px-4 sm:text-sm"
            >
              ← Início
            </Link>

            <Link
              href="/broker"
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-blue-500 sm:flex-none sm:px-4 sm:text-sm"
            >
              Negocie agora
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400 transition hover:bg-red-500/20 sm:flex-none sm:px-4 sm:text-sm"
            >
              Sair
            </button>

          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">

        <div className="text-center">

          <div className="mb-4 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400 sm:px-4 sm:py-2 sm:text-sm">
            Análises de hoje
          </div>

          <h2 className="text-3xl font-bold sm:text-5xl">
            Escolha o seu mercado
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400 sm:mt-4 sm:text-base">
            Selecione um mercado para consultar as oportunidades preparadas
            para hoje.
          </p>

        </div>

        {/* MERCADOS */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">

          {markets.map((market) => (

            <button
              key={market.name}
              type="button"
              onClick={() => setSelectedMarket(market.name)}
              className={`rounded-2xl border p-4 text-left transition sm:p-5 ${
                selectedMarket === market.name
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-blue-500/40"
              }`}
            >

              <div className="text-2xl sm:text-3xl">
                {market.icon}
              </div>

              <h3 className="mt-3 text-sm font-semibold sm:mt-4 sm:text-base">
                {market.name}
              </h3>

              <p className="mt-1 text-[11px] leading-4 text-slate-400 sm:text-xs sm:leading-5">
                {market.description}
              </p>

            </button>

          ))}

        </div>

        {/* OPORTUNIDADES */}
        <div className="mt-8 sm:mt-10">

          <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">

            <div className="min-w-0">
              <h3 className="text-xl font-bold sm:text-2xl">
                Oportunidades — {selectedMarket}
              </h3>

              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                Oportunidades preparadas para este mercado.
              </p>
            </div>

            <div className="w-fit rounded-full bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400 sm:px-4 sm:py-2 sm:text-sm">
              {marketOpportunities.length}{" "}
              {marketOpportunities.length === 1
                ? "oportunidade"
                : "oportunidades"}
            </div>

          </div>

          {/* LOADING */}
          {loading && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-10">

              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-white/10 border-t-blue-500 sm:h-10 sm:w-10" />

              <p className="mt-4 text-sm text-slate-400">
                Carregando oportunidades...
              </p>

            </div>
          )}

          {/* ERRO */}
          {!loading && error && (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-center text-sm text-red-400 sm:p-6">
              {error}
            </div>
          )}

          {/* SEM OPORTUNIDADES */}
          {!loading &&
            !error &&
            marketOpportunities.length === 0 && (

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-10">

                <div className="text-3xl sm:text-4xl">
                  📭
                </div>

                <h3 className="mt-4 text-lg font-bold sm:text-xl">
                  Nenhuma oportunidade
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                  Ainda não existem oportunidades cadastradas para{" "}
                  {selectedMarket}.
                </p>

              </div>
            )}

          {/* CARDS */}
          {!loading &&
            !error &&
            marketOpportunities.length > 0 && (

              <div className="grid gap-4 sm:gap-5">

                {marketOpportunities.map((opportunity) => {

                  const unlocked = hasAccess(opportunity.id);

                  return (
                    <div
                      key={opportunity.id}
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6"
                    >

                      {/* CABEÇALHO */}
                      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">

                        <div className="min-w-0">

                          <p className="text-[11px] uppercase tracking-wider text-slate-500 sm:text-xs">
                            Ativo
                          </p>

                          <h4 className="mt-1 break-words text-xl font-bold sm:text-2xl">
                            {opportunity.asset}
                          </h4>

                        </div>

                        <div
                          className={`rounded-full px-3 py-1.5 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm ${
                            opportunity.direction === "LONG"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {opportunity.direction}
                        </div>

                      </div>

                      {/* INFORMAÇÕES */}
                      <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-3">

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">

                          <p className="text-xs text-slate-500">
                            Risco
                          </p>

                          <p className="mt-1 text-sm font-semibold sm:text-base">
                            {opportunity.risk}
                          </p>

                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">

                          <p className="text-xs text-slate-500">
                            Mercado
                          </p>

                          <p className="mt-1 text-sm font-semibold sm:text-base">
                            {opportunity.market}
                          </p>

                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">

                          <p className="text-xs text-slate-500">
                            Status
                          </p>

                          <p
                            className={`mt-1 text-sm font-semibold sm:text-base ${
                              unlocked
                                ? "text-green-400"
                                : "text-yellow-400"
                            }`}
                          >
                            {checkingAccess
                              ? "Verificando..."
                              : unlocked
                              ? "✅ Desbloqueado"
                              : "🔒 Bloqueado"}
                          </p>

                        </div>

                      </div>

                      {/* SINAL DESBLOQUEADO */}
                      {unlocked ? (

                        <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 sm:mt-6 sm:p-6">

                          <div className="mb-4 flex items-center gap-2 sm:mb-5">

                            <span className="text-xl sm:text-2xl">
                              🔓
                            </span>

                            <div>
                              <p className="text-sm font-semibold text-green-400 sm:text-base">
                                Análise desbloqueada
                              </p>

                              <p className="text-[11px] text-slate-400 sm:text-xs">
                                Você possui acesso a este sinal.
                              </p>
                            </div>

                          </div>

                          <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">

                            <div>
                              <p className="text-xs text-slate-500">
                                Entrada
                              </p>

                              <p className="mt-1 text-sm font-semibold sm:text-base">
                                {opportunity.entry}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-500">
                                Stop Loss
                              </p>

                              <p className="mt-1 text-sm font-semibold sm:text-base">
                                {opportunity.stopLoss}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-500">
                                Take Profit
                              </p>

                              <p className="mt-1 text-sm font-semibold sm:text-base">
                                {opportunity.takeProfit}
                              </p>
                            </div>

                          </div>

                          <div className="mt-5 sm:mt-6">

                            <p className="text-sm font-semibold">
                              Análise
                            </p>

                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300 sm:leading-7">
                              {opportunity.analysis}
                            </p>

                          </div>

                        </div>

                      ) : (

                        /* SINAL BLOQUEADO */
                        <div className="relative mt-5 overflow-hidden rounded-2xl border border-yellow-500/20 bg-yellow-500/5 sm:mt-6">

                          <div className="select-none p-4 blur-sm sm:p-6">

                            <p className="text-sm font-semibold">
                              Entrada
                            </p>

                            <p className="mt-1 text-sm sm:text-base">
                              {opportunity.entry}
                            </p>

                            <p className="mt-4 text-sm font-semibold">
                              Stop Loss
                            </p>

                            <p className="mt-1 text-sm sm:text-base">
                              {opportunity.stopLoss}
                            </p>

                            <p className="mt-4 text-sm font-semibold">
                              Take Profit
                            </p>

                            <p className="mt-1 text-sm sm:text-base">
                              {opportunity.takeProfit}
                            </p>

                            <p className="mt-4 text-sm font-semibold">
                              Análise
                            </p>

                            <p className="mt-1 text-sm sm:text-base">
                              {opportunity.analysis}
                            </p>

                          </div>

                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-4">

                            <div className="max-w-sm text-center">

                              <div className="text-2xl sm:text-3xl">
                                🔒
                              </div>

                              <p className="mt-2 text-sm font-semibold sm:text-base">
                                Análise bloqueada
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                Faça o pagamento para desbloquear este sinal.
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  handleUnlock(opportunity)
                                }
                                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold transition hover:bg-blue-500 sm:px-6 sm:py-3 sm:text-sm"
                              >
                                💳 Desbloquear análise
                              </button>

                            </div>

                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}

              </div>
            )}

        </div>

      </section>

    </main>
  );
}