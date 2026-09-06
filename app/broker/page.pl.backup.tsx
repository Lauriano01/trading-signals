
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
import { openBrokerPosition } from "../../lib/brokerTrading";

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
              balance: 10000,
              currency: "USD",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            setBalance(10000);
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
  // CARREGAR POSIÇÕES DO USUÁRIO
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

      const positionId = await openBrokerPosition(
        user.uid,
        selectedAsset.id,
        selectedAsset.symbol,
        tradeSide,
        selectedAsset.price,
        tradeAmountNumber
      );

      console.log(
        "Posição criada com sucesso:",
        positionId
      );

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
        "Não foi possível abrir a posição."
      );
    } finally {
      setOpeningPosition(false);
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
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p>Carregando conta...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">

        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              TradeSignal Broker
            </h1>

            <p className="text-slate-400 mt-1">
              Conta de trading simulada
            </p>
          </div>

          <button
            onClick={() => router.push("/market")}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            Voltar
          </button>
        </header>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
          <p className="text-slate-400 text-sm">
            Saldo disponível
          </p>

          <div className="text-4xl font-bold mt-2">
            {balance !== null
              ? `$${balance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "$0.00"}
          </div>

          <p className="text-slate-500 mt-2">
            USD
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">
              Conta
            </p>

            <p className="text-lg font-semibold mt-2">
              {user?.email}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">
              Moeda
            </p>

            <p className="text-lg font-semibold mt-2">
              USD
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">
              Status
            </p>

            <p className="text-lg font-semibold text-green-400 mt-2">
              Ativa
            </p>
          </div>

        </section>

        {/* =========================
            POSIÇÕES ABERTAS
        ========================= */}

        <section className="mt-8">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-2xl font-bold">
                Posições abertas
              </h2>

              <p className="text-slate-400 mt-1">
                Suas operações em andamento
              </p>
            </div>

            <div className="text-sm text-slate-400">
              {positions.length} posições
            </div>

          </div>

          {positions.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <p className="text-slate-400">
                Você não possui posições abertas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {positions.map((position) => (
                <div
                  key={position.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
                >

                  <div className="flex items-start justify-between">

                    <div>
                      <p className="font-bold text-lg">
                        {position.symbol}
                      </p>

                      <p
                        className={`text-sm font-semibold mt-1 ${
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

                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/10 text-green-400">
                      ABERTA
                    </span>

                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-5">

                    <div>
                      <p className="text-xs text-slate-500">
                        Preço de entrada
                      </p>

                      <p className="font-semibold mt-1">
                        ${formatPrice(position.entryPrice)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Quantidade
                      </p>

                      <p className="font-semibold mt-1">
                        {position.quantity.toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 8,
                          }
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Valor da operação
                      </p>

                      <p className="font-semibold mt-1">
                        $
                        {position.amountUsd.toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Status
                      </p>

                      <p className="font-semibold text-green-400 mt-1">
                        OPEN
                      </p>
                    </div>

                  </div>

                </div>
              ))}

            </div>
          )}

        </section>

        {/* =========================
            MERCADO
        ========================= */}

        <section className="mt-8">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-2xl font-bold">
                Mercado
              </h2>

              <p className="text-slate-400 mt-1">
                Ativos disponíveis para negociação
              </p>
            </div>

            <div className="text-sm text-slate-400">
              {assets.length} ativos
            </div>

          </div>

          {assets.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <p className="text-slate-400">
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
                  className="mb-8"
                >

                  <h3 className="text-lg font-semibold mb-4">
                    {category === "Acoes"
                      ? "Ações"
                      : category}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                    {categoryAssets.map(
                      (asset) => (

                        <div
                          key={asset.id}
                          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition"
                        >

                          <div className="flex items-start justify-between">

                            <div>

                              <p className="font-bold text-lg">
                                {asset.symbol}
                              </p>

                              <p className="text-sm text-slate-400 mt-1">
                                {asset.name}
                              </p>

                            </div>

                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full ${
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

                          <div className="mt-5">

                            <p className="text-xs text-slate-500">
                              Preço
                            </p>

                            <p className="text-2xl font-bold mt-1">
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
                            className="w-full mt-5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition font-semibold"
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

          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">

            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">

              <div className="flex items-center justify-between mb-6">

                <div>

                  <h2 className="text-2xl font-bold">
                    Negociar
                  </h2>

                  <p className="text-slate-400 mt-1">
                    {selectedAsset.symbol} —{" "}
                    {selectedAsset.name}
                  </p>

                </div>

                <button
                  onClick={closeTradePanel}
                  disabled={openingPosition}
                  className="text-slate-400 hover:text-white text-2xl disabled:opacity-50"
                >
                  ×
                </button>

              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-5">

                <p className="text-xs text-slate-500">
                  Preço atual
                </p>

                <p className="text-3xl font-bold mt-1">
                  $
                  {formatPrice(
                    selectedAsset.price
                  )}
                </p>

              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">

                <button
                  onClick={() =>
                    setTradeSide("LONG")
                  }
                  disabled={openingPosition}
                  className={`py-3 rounded-lg font-bold transition ${
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
                  className={`py-3 rounded-lg font-bold transition ${
                    tradeSide === "SHORT"
                      ? "bg-red-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  } disabled:opacity-50`}
                >
                  ▼ SHORT
                </button>

              </div>

              <label className="block text-sm text-slate-400 mb-2">
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
                className="w-full bg-white text-black rounded-lg px-4 py-3 outline-none disabled:opacity-50"
              />

              <div className="mt-5 space-y-3 text-sm">

                <div className="flex justify-between">

                  <span className="text-slate-400">
                    Direção
                  </span>

                  <span
                    className={
                      tradeSide === "LONG"
                        ? "text-green-400 font-semibold"
                        : "text-red-400 font-semibold"
                    }
                  >
                    {tradeSide}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-slate-400">
                    Valor
                  </span>

                  <span>
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

                <div className="flex justify-between">

                  <span className="text-slate-400">
                    Quantidade
                  </span>

                  <span>
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

                <div className="flex justify-between">

                  <span className="text-slate-400">
                    Saldo disponível
                  </span>

                  <span>
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
                className={`w-full mt-6 px-4 py-3 rounded-lg transition font-bold ${
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
                className="w-full mt-2 px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition disabled:opacity-50"
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

