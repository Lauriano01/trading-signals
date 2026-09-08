"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";

type BrokerAsset = {
  id: string;
  symbol: string;
  name: string;
  category: string;
  price: number;
  previousPrice: number;
  direction: "UP" | "DOWN" | "NEUTRAL";
  active: boolean;
};

type TradeSide = "LONG" | "SHORT";

type BrokerPosition = {
  id: string;
  userId: string;
  assetId: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  quantity: number;
  amountUsd: number;
  status: "OPEN" | "CLOSED";
};

export default function BrokerPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [assets, setAssets] = useState<BrokerAsset[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAsset, setSelectedAsset] =
    useState<BrokerAsset | null>(null);

  const [tradeSide, setTradeSide] =
    useState<TradeSide>("LONG");

  const [tradeAmount, setTradeAmount] =
    useState("");

  const [openingPosition, setOpeningPosition] =
    useState(false);

  const [closingPositionId, setClosingPositionId] =
    useState<string | null>(null);

  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    if (price >= 10) {
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // =========================
  // AUTENTICAÇÃO + CONTA
  // =========================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.push("/login");
          return;
        }

        setUser(currentUser);

        try {
          const accountRef = doc(
            db,
            "brokerAccounts",
            currentUser.uid
          );

          const accountSnap = await getDoc(accountRef);

          if (!accountSnap.exists()) {
            await setDoc(accountRef, {
              userId: currentUser.uid,
              balance: 0,
              currency: "USD",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            setBalance(0);
          } else {
            const data = accountSnap.data();

            setBalance(
              typeof data.balance === "number"
                ? data.balance
                : 0
            );
          }
        } catch (error) {
          console.error(
            "Erro ao carregar conta do broker:",
            error
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribeAuth();
  }, [router]);

  // =========================
  // OUVIR SALDO EM TEMPO REAL
  // =========================
  useEffect(() => {
    if (!user) {
      return;
    }

    const accountRef = doc(
      db,
      "brokerAccounts",
      user.uid
    );

    const unsubscribeAccount = onSnapshot(
      accountRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setBalance(0);
          return;
        }

        const data = snapshot.data();

        setBalance(
          typeof data.balance === "number"
            ? data.balance
            : 0
        );
      },
      (error) => {
        console.error(
          "Erro ao acompanhar saldo:",
          error
        );
      }
    );

    return () => unsubscribeAccount();
  }, [user]);

  // =========================
  // CARREGAR ATIVOS
  // =========================
  useEffect(() => {
    const assetsRef = collection(db, "brokerAssets");

    const unsubscribeAssets = onSnapshot(
      assetsRef,
      (snapshot) => {
        const loadedAssets: BrokerAsset[] =
          snapshot.docs
            .map((assetDoc) => {
              const data = assetDoc.data();

              return {
                id: assetDoc.id,
                symbol: data.symbol,
                name: data.name,
                category: data.category,
                price: data.price,
                previousPrice: data.previousPrice,
                direction:
                  data.direction ?? "NEUTRAL",
                active:
                  data.active ?? true,
              };
            })
            .filter((asset) => asset.active);

        setAssets(loadedAssets);

        console.log(
          "[BROKER CLIENT] Preços atualizados:",
          loadedAssets.map((asset) => ({
            symbol: asset.symbol,
            price: asset.price,
            previousPrice: asset.previousPrice,
            direction: asset.direction,
          }))
        );
      },
      (error) => {
        console.error(
          "Erro ao carregar ativos:",
          error
        );
      }
    );

    return () => unsubscribeAssets();
  }, []);

  // =========================
  // CARREGAR POSIÇÕES
  // =========================
  useEffect(() => {
    if (!user) {
      return;
    }

    const positionsQuery = query(
      collection(db, "brokerPositions"),
      where("userId", "==", user.uid)
    );

    const unsubscribePositions = onSnapshot(
      positionsQuery,
      (snapshot) => {
        const loadedPositions: BrokerPosition[] =
          snapshot.docs
            .map((positionDoc) => {
              const data = positionDoc.data();

              return {
                id: positionDoc.id,
                userId: data.userId,
                assetId: data.assetId,
                symbol: data.symbol,
                side: data.side,
                entryPrice: data.entryPrice,
                quantity: data.quantity,
                amountUsd: data.amountUsd,
                status: data.status,
              };
            })
            .filter(
              (position) =>
                position.status === "OPEN"
            );

        setPositions(loadedPositions);
      },
      (error) => {
        console.error(
          "Erro ao carregar posições:",
          error
        );
      }
    );

    return () => unsubscribePositions();
  }, [user]);

  // =========================
  // CALCULAR P/L VISUAL
  // =========================
  const calculatePositionPnL = (
    position: BrokerPosition
  ) => {
    const asset = assets.find(
      (item) => item.id === position.assetId
    );

    if (!asset) {
      return {
        currentPrice: position.entryPrice,
        pnl: 0,
        pnlPercent: 0,
      };
    }

    const currentPrice = asset.price;

    let pnl = 0;

    if (position.side === "LONG") {
      pnl =
        (currentPrice - position.entryPrice) *
        position.quantity;
    } else {
      pnl =
        (position.entryPrice - currentPrice) *
        position.quantity;
    }

    const pnlPercent =
      position.amountUsd > 0
        ? (pnl / position.amountUsd) * 100
        : 0;

    return {
      currentPrice,
      pnl,
      pnlPercent,
    };
  };

  const openTradePanel = (asset: BrokerAsset) => {
    setSelectedAsset(asset);
    setTradeSide("LONG");
    setTradeAmount("");
  };

  const closeTradePanel = () => {
    if (openingPosition) {
      return;
    }

    setSelectedAsset(null);
    setTradeAmount("");
  };

  const tradeAmountNumber = Number(tradeAmount);

  const quantity =
    selectedAsset &&
    tradeAmountNumber > 0 &&
    selectedAsset.price > 0
      ? tradeAmountNumber / selectedAsset.price
      : 0;

  // =========================
  // ABRIR POSIÇÃO
  // =========================
  const handleOpenPosition = async () => {
    if (!selectedAsset || !user) {
      return;
    }

    if (!tradeAmountNumber || tradeAmountNumber <= 0) {
      alert("Digite um valor válido para a operação.");
      return;
    }

    if (
      balance !== null &&
      tradeAmountNumber > balance
    ) {
      alert("Saldo insuficiente.");
      return;
    }

    try {
      setOpeningPosition(true);

      const idToken = await user.getIdToken();

      const response = await fetch(
        "/api/broker/trade",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            action: "OPEN",
            assetId: selectedAsset.id,
            side: tradeSide,
            amountUsd: tradeAmountNumber,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Não foi possível abrir a posição."
        );
      }

      console.log(
        "Posição criada com sucesso:",
        data.positionId
      );

      if (typeof data.balance === "number") {
        setBalance(data.balance);
      }

      alert(
        `${tradeSide} aberto com sucesso em ${selectedAsset.symbol}.`
      );

      setSelectedAsset(null);
      setTradeAmount("");
    } catch (error) {
      console.error(
        "Erro ao abrir posição:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a posição."
      );
    } finally {
      setOpeningPosition(false);
    }
  };

  // =========================
  // FECHAR POSIÇÃO
  // =========================
  const handleClosePosition = async (
    position: BrokerPosition
  ) => {
    const asset = assets.find(
      (item) => item.id === position.assetId
    );

    if (!asset) {
      alert("Ativo da posição não encontrado.");
      return;
    }

    const {
      currentPrice,
      pnl,
      pnlPercent,
    } = calculatePositionPnL(position);

    const confirmed = window.confirm(
      `Fechar ${position.side} em ${position.symbol}?\n\n` +
      `Preço atual: $${formatPrice(currentPrice)}\n` +
      `P/L: ${pnl >= 0 ? "+" : "-"}$${formatMoney(
        Math.abs(pnl)
      )} (${pnl >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%)`
    );

    if (!confirmed) {
      return;
    }

    try {
      setClosingPositionId(position.id);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Usuário não autenticado."
        );
      }

      const idToken =
        await currentUser.getIdToken();

      const response = await fetch(
        "/api/broker/trade",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            action: "CLOSE",
            positionId: position.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Não foi possível fechar a posição."
        );
      }

      const serverPnl =
        typeof data.pnl === "number"
          ? data.pnl
          : 0;

      const serverPnlPercent =
        typeof data.pnlPercent === "number"
          ? data.pnlPercent
          : 0;

      if (typeof data.balance === "number") {
        setBalance(data.balance);
      }

      alert(
        `Posição fechada com sucesso.\nP/L: ${
          serverPnl >= 0 ? "+" : "-"
        }$${formatMoney(
          Math.abs(serverPnl)
        )} (${serverPnl >= 0 ? "+" : ""}${serverPnlPercent.toFixed(
          2
        )}%)`
      );
    } catch (error) {
      console.error(
        "Erro ao fechar posição:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível fechar a posição."
      );
    } finally {
      setClosingPositionId(null);
    }
  };

  const categories = [
    "Crypto",
    "Forex",
    "Acoes",
    "Commodities",
  ];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <p className="text-sm sm:text-base">
          Carregando conta...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 px-3 py-4 text-white sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-6xl">

        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold sm:text-3xl">
              TradeSignal Broker
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Conta de trading simulada
            </p>
          </div>

          <button
            onClick={() => router.push("/market")}
            className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm transition hover:bg-slate-700 sm:w-auto sm:py-2"
          >
            Voltar
          </button>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:mb-8 sm:p-6">
          <p className="text-sm text-slate-400">
            Saldo disponível
          </p>

          <div className="mt-2 break-words text-3xl font-bold sm:text-4xl">
            {balance !== null
              ? `$${balance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "$0.00"}
          </div>

          <p className="mt-1.5 text-sm text-slate-500 sm:mt-2">
            USD
          </p>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6">

          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
            <p className="text-sm text-slate-400">
              Conta
            </p>

            <p className="mt-2 break-words text-base font-semibold sm:text-lg">
              {user?.email}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
            <p className="text-sm text-slate-400">
              Moeda
            </p>

            <p className="mt-2 text-base font-semibold sm:text-lg">
              USD
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
            <p className="text-sm text-slate-400">
              Status
            </p>

            <p className="mt-2 text-base font-semibold text-green-400 sm:text-lg">
              Ativa
            </p>
          </div>

        </section>

        {/* =========================
            POSIÇÕES ABERTAS
        ========================= */}

        <section className="mt-6 sm:mt-8">

          <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="min-w-0">
              <h2 className="text-xl font-bold sm:text-2xl">
                Posições abertas
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Suas operações em andamento
              </p>
            </div>

            <div className="text-xs text-slate-400 sm:text-sm">
              {positions.length} posições
            </div>

          </div>

          {positions.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center sm:p-8">
              <p className="text-sm text-slate-400 sm:text-base">
                Você não possui posições abertas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">

              {positions.map((position) => {

                const {
                  currentPrice,
                  pnl,
                  pnlPercent,
                } = calculatePositionPnL(position);

                const isProfit = pnl >= 0;

                return (
                  <div
                    key={position.id}
                    className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0">
                        <p className="break-words text-base font-bold sm:text-lg">
                          {position.symbol}
                        </p>

                        <p
                          className={`mt-1 text-xs font-semibold sm:text-sm ${
                            position.side === "LONG"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {position.side === "LONG"
                            ? "▲ LONG"
                            : "▼ SHORT"}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400 sm:text-xs">
                        ABERTA
                      </span>

                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4">

                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 sm:text-xs">
                          Preço de entrada
                        </p>

                        <p className="mt-1 break-all text-sm font-semibold sm:text-base">
                          ${formatPrice(position.entryPrice)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 sm:text-xs">
                          Preço atual
                        </p>

                        <p className="mt-1 break-all text-sm font-semibold sm:text-base">
                          ${formatPrice(currentPrice)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 sm:text-xs">
                          Quantidade
                        </p>

                        <p className="mt-1 break-all text-sm font-semibold sm:text-base">
                          {position.quantity.toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 8,
                            }
                          )}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 sm:text-xs">
                          Valor da operação
                        </p>

                        <p className="mt-1 break-all text-sm font-semibold sm:text-base">
                          ${formatMoney(position.amountUsd)}
                        </p>
                      </div>

                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-4 sm:mt-5">

                      <div className="flex items-center justify-between gap-4">

                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-500 sm:text-xs">
                            P/L
                          </p>

                          <p
                            className={`mt-1 break-all text-lg font-bold sm:text-xl ${
                              isProfit
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {isProfit ? "+" : "-"}$
                            {formatMoney(Math.abs(pnl))}
                          </p>
                        </div>

                        <div className="min-w-0 text-right">

                          <p className="text-[11px] text-slate-500 sm:text-xs">
                            Variação
                          </p>

                          <p
                            className={`mt-1 text-base font-bold sm:text-lg ${
                              isProfit
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {isProfit ? "+" : ""}
                            {pnlPercent.toFixed(2)}%
                          </p>

                        </div>

                      </div>

                    </div>

                    <button
                      onClick={() =>
                        handleClosePosition(position)
                      }
                      disabled={
                        closingPositionId === position.id
                      }
                      className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold transition hover:bg-red-500 disabled:opacity-50 sm:mt-5 sm:py-3"
                    >
                      {closingPositionId === position.id
                        ? "Fechando posição..."
                        : "Fechar posição"}
                    </button>

                  </div>
                );
              })}

            </div>
          )}

        </section>

        {/* =========================
            MERCADO
        ========================= */}

        <section className="mt-6 sm:mt-8">

          <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-xl font-bold sm:text-2xl">
                Mercado
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Ativos disponíveis para negociação
              </p>
            </div>

            <div className="text-xs text-slate-400 sm:text-sm">
              {assets.length} ativos
            </div>

          </div>

          {assets.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center sm:p-8">
              <p className="text-sm text-slate-400 sm:text-base">
                Nenhum ativo disponível.
              </p>
            </div>
          ) : (
            categories.map((category) => {

              const categoryAssets =
                assets.filter(
                  (asset) =>
                    asset.category === category
                );

              if (categoryAssets.length === 0) {
                return null;
              }

              return (
                <div
                  key={category}
                  className="mb-6 sm:mb-8"
                >

                  <h3 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">
                    {category === "Acoes"
                      ? "Ações"
                      : category}
                  </h3>

                  <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">

                    {categoryAssets.map(
                      (asset) => (

                        <div
                          key={asset.id}
                          className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700 sm:p-5"
                        >

                          <div className="flex items-start justify-between gap-3">

                            <div className="min-w-0">
                              <p className="break-words text-base font-bold sm:text-lg">
                                {asset.symbol}
                              </p>

                              <p className="mt-1 break-words text-xs text-slate-400 sm:text-sm">
                                {asset.name}
                              </p>

                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold sm:text-xs ${
                                asset.direction === "UP"
                                  ? "bg-green-500/10 text-green-400"
                                  : asset.direction === "DOWN"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {asset.direction === "UP"
                                ? "SUBINDO"
                                : asset.direction === "DOWN"
                                ? "DESCENDO"
                                : "NEUTRO"}
                            </span>

                          </div>

                          <div className="mt-4 sm:mt-5">

                            <p className="text-[11px] text-slate-500 sm:text-xs">
                              Preço
                            </p>

                            <p className="mt-1 break-all text-xl font-bold sm:text-2xl">
                              $
                              {formatPrice(
                                asset.price
                              )}
                            </p>

                          </div>

                          <button
                            onClick={() =>
                              openTradePanel(asset)
                            }
                            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-blue-500 sm:mt-5 sm:py-2"
                          >
                            Negociar
                          </button>

                        </div>

                      )
                    )}

                  </div>

                </div>
              );
            })
          )}

        </section>

        {selectedAsset && (

          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4">

            <div className="my-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-6">

              <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">

                <div className="min-w-0">
                  <h2 className="text-xl font-bold sm:text-2xl">
                    Negociar
                  </h2>

                  <p className="mt-1 break-words text-xs text-slate-400 sm:text-sm">
                    {selectedAsset.symbol} —{" "}
                    {selectedAsset.name}
                  </p>

                </div>

                <button
                  onClick={closeTradePanel}
                  disabled={openingPosition}
                  className="shrink-0 text-xl text-slate-400 hover:text-white disabled:opacity-50 sm:text-2xl"
                >
                  ×
                </button>

              </div>

              <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:mb-5 sm:p-4">

                <p className="text-[11px] text-slate-500 sm:text-xs">
                  Preço atual
                </p>

                <p className="mt-1 break-all text-2xl font-bold sm:text-3xl">
                  $
                  {formatPrice(
                    selectedAsset.price
                  )}
                </p>

              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-5 sm:gap-3">

                <button
                  onClick={() =>
                    setTradeSide("LONG")
                  }
                  disabled={openingPosition}
                  className={`rounded-lg py-2.5 text-sm font-bold transition sm:py-3 ${
                    tradeSide === "LONG"
                      ? "bg-green-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  } disabled:opacity-50`}
                >
                  ▲ LONG
                </button>

                <button
                  onClick={() =>
                    setTradeSide("SHORT")
                  }
                  disabled={openingPosition}
                  className={`rounded-lg py-2.5 text-sm font-bold transition sm:py-3 ${
                    tradeSide === "SHORT"
                      ? "bg-red-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  } disabled:opacity-50`}
                >
                  ▼ SHORT
                </button>

              </div>

              <label className="mb-2 block text-sm text-slate-400">
                Valor da operação (USD)
              </label>

              <input
                type="number"
                min="1"
                step="0.01"
                value={tradeAmount}
                onChange={(event) =>
                  setTradeAmount(
                    event.target.value
                  )
                }
                placeholder="Ex: 100"
                disabled={openingPosition}
                className="w-full rounded-lg bg-white px-3 py-2.5 text-sm text-black outline-none disabled:opacity-50 sm:px-4 sm:py-3"
              />

              <div className="mt-4 space-y-2.5 text-xs sm:mt-5 sm:space-y-3 sm:text-sm">

                <div className="flex items-center justify-between gap-4">

                  <span className="text-slate-400">
                    Direção
                  </span>

                  <span
                    className={
                      tradeSide === "LONG"
                        ? "font-semibold text-green-400"
                        : "font-semibold text-red-400"
                    }
                  >
                    {tradeSide}
                  </span>

                </div>

                <div className="flex items-center justify-between gap-4">

                  <span className="text-slate-400">
                    Valor
                  </span>

                  <span className="break-all text-right">
                    $
                    {tradeAmountNumber > 0
                      ? tradeAmountNumber.toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )
                      : "0.00"}
                  </span>

                </div>

                <div className="flex items-center justify-between gap-4">

                  <span className="text-slate-400">
                    Quantidade
                  </span>

                  <span className="break-all text-right">
                    {quantity > 0
                      ? quantity.toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 8,
                          }
                        )
                      : "0"}
                  </span>

                </div>

                <div className="flex items-center justify-between gap-4">

                  <span className="text-slate-400">
                    Saldo disponível
                  </span>

                  <span className="break-all text-right">
                    $
                    {balance !== null
                      ? balance.toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )
                      : "0.00"}
                  </span>

                </div>

              </div>

              <button
                onClick={handleOpenPosition}
                disabled={openingPosition}
                className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-bold transition sm:mt-6 sm:py-3 ${
                  tradeSide === "LONG"
                    ? "bg-green-600 hover:bg-green-500"
                    : "bg-red-600 hover:bg-red-500"
                } disabled:opacity-50`}
              >
                {openingPosition
                  ? "Abrindo posição..."
                  : `Abrir ${tradeSide}`}
              </button>

              <button
                onClick={closeTradePanel}
                disabled={openingPosition}
                className="mt-2 w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm transition hover:bg-slate-700 disabled:opacity-50 sm:py-3"
              >
                Cancelar
              </button>

            </div>

          </div>

        )}

      </div>
    </main>
  );
}