"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { db, auth } from "../../../lib/firebase";
import { seedBrokerAssets } from "../../../lib/seedBrokerAssets";

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

type BrokerAccount = {
  id: string;
  userId: string;
  name: string;
  email: string;
  balance: number;
  currency: string;
};

type MarketSettings = {
  mode: "MANUAL" | "AUTO";
  direction:
    | "UP"
    | "DOWN"
    | "NEUTRAL"
    | "VOLATILE";
  volatility: "LOW" | "MEDIUM" | "HIGH";
  targetPrice: number;
  correctionPercent: number;
  startTime: string;
  peakTime: string;
  endTime: string;
  enabled: boolean;
};

export default function AdminBrokerPage() {
  const router = useRouter();

  const [assets, setAssets] = useState<BrokerAsset[]>([]);
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [balanceMessage, setBalanceMessage] = useState("");

  const [selectedUserId, setSelectedUserId] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");

  // =========================
  // CONFIGURAÇÃO DO MERCADO
  // =========================

  const [marketLoading, setMarketLoading] = useState(false);
  const [marketMessage, setMarketMessage] = useState("");
  const [engineLoading, setEngineLoading] = useState(false);

  const [marketSettings, setMarketSettings] =
    useState<MarketSettings>({
      mode: "MANUAL",
      direction: "UP",
      volatility: "MEDIUM",
      targetPrice: 0,
      correctionPercent: 1,
      startTime: "09:00",
      peakTime: "16:00",
      endTime: "22:00",
      enabled: false,
    });

  // =========================
  // CONTROLE DO MOTOR CONTÍNUO
  // =========================

  const automaticEngineRef =
    useRef(false);

  const engineIntervalRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const engineRequestRunningRef =
    useRef(false);

  // =========================
  // CARREGAR ATIVOS
  // =========================

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "brokerAssets"),
      (snapshot) => {
        const loadedAssets: BrokerAsset[] =
          snapshot.docs.map((item) => {
            const data = item.data();

            return {
              id: item.id,
              symbol: data.symbol,
              name: data.name,
              category: data.category,
              price: Number(data.price ?? 0),
              previousPrice: Number(
                data.previousPrice ??
                  data.price ??
                  0
              ),
              direction:
                data.direction ?? "NEUTRAL",
              active:
                data.active ?? true,
            };
          });

        setAssets(loadedAssets);
      },
      (error) => {
        console.error(
          "Erro ao carregar ativos:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================
  // CARREGAR CONTAS
  // =========================

  async function loadAccounts() {
    try {
      setLoadingAccounts(true);
      setBalanceMessage("");

      const user = auth.currentUser;

      if (!user) {
        setBalanceMessage(
          "Administrador não autenticado."
        );
        return;
      }

      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "/api/admin/broker/accounts",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${idToken}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Erro ao carregar contas."
        );
      }

      setAccounts(
        data.accounts || []
      );

      if (
        data.accounts?.length > 0 &&
        !selectedUserId
      ) {
        setSelectedUserId(
          data.accounts[0].userId
        );
      }
    } catch (error) {
      console.error(
        "Erro ao carregar contas:",
        error
      );

      setBalanceMessage(
        error instanceof Error
          ? error.message
          : "Erro ao carregar contas."
      );
    } finally {
      setLoadingAccounts(false);
    }
  }

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            loadAccounts();
          }
        }
      );

    return () => unsubscribe();
  }, []);

  // =========================
  // CARREGAR CONFIGURAÇÃO DO MERCADO
  // =========================

  async function loadMarketSettings() {
    try {
      setMarketMessage("");

      const user = auth.currentUser;

      if (!user) {
        setMarketMessage(
          "Administrador não autenticado."
        );
        return;
      }

      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "/api/admin/broker/market",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${idToken}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Erro ao carregar configuração do mercado."
        );
      }

      if (data.settings) {
        setMarketSettings({
          mode:
            data.settings.mode ??
            "MANUAL",

          direction:
            data.settings.direction ??
            "UP",

          volatility:
            data.settings.volatility ??
            "MEDIUM",

          targetPrice:
            Number(
              data.settings.targetPrice ??
                0
            ),

          correctionPercent:
            Number(
              data.settings
                .correctionPercent ??
                1
            ),

          startTime:
            data.settings.startTime ??
            "09:00",

          peakTime:
            data.settings.peakTime ??
            "16:00",

          endTime:
            data.settings.endTime ??
            "22:00",

          enabled:
            data.settings.enabled ??
            false,
        });
      }
    } catch (error) {
      console.error(
        "Erro ao carregar mercado:",
        error
      );

      setMarketMessage(
        error instanceof Error
          ? error.message
          : "Erro ao carregar configuração."
      );
    }
  }

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            loadMarketSettings();
          }
        }
      );

    return () => unsubscribe();
  }, []);

  // =========================
  // SALVAR CONFIGURAÇÃO DO MERCADO
  // =========================

  async function saveMarketSettings() {
    try {
      setMarketLoading(true);
      setMarketMessage("");

      const user = auth.currentUser;

      if (!user) {
        setMarketMessage(
          "Administrador não autenticado."
        );
        return;
      }

      const targetPrice =
        Number(
          marketSettings.targetPrice
        );

      const correctionPercent =
        Number(
          marketSettings.correctionPercent
        );

      if (
        !Number.isFinite(targetPrice) ||
        targetPrice <= 0
      ) {
        setMarketMessage(
          "Digite um preço-alvo válido."
        );
        return;
      }

      if (
        !Number.isFinite(
          correctionPercent
        ) ||
        correctionPercent < 0
      ) {
        setMarketMessage(
          "Digite uma correção válida."
        );
        return;
      }

      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "/api/admin/broker/market",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${idToken}`,
          },

          body: JSON.stringify({
            mode:
              marketSettings.mode,

            direction:
              marketSettings.direction,

            volatility:
              marketSettings.volatility,

            targetPrice,

            correctionPercent,

            startTime:
              marketSettings.startTime,

            peakTime:
              marketSettings.peakTime,

            endTime:
              marketSettings.endTime,

            enabled:
              marketSettings.enabled,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Não foi possível salvar a configuração."
        );
      }

      setMarketMessage(
        "Configuração do mercado salva com sucesso."
      );
    } catch (error) {
      console.error(
        "Erro ao salvar mercado:",
        error
      );

      setMarketMessage(
        error instanceof Error
          ? error.message
          : "Erro ao salvar configuração."
      );
    } finally {
      setMarketLoading(false);
    }
  }

  // =========================
  // EXECUTAR 1 CICLO DO MOTOR
  // =========================

  async function executeEngineCycle(
    showMessage = false
  ) {
    if (
      engineRequestRunningRef.current
    ) {
      console.log(
        "[MARKET ENGINE] Ciclo anterior ainda está executando."
      );

      return;
    }

    engineRequestRunningRef.current =
      true;

    try {
      const user = auth.currentUser;

      if (!user) {
        if (showMessage) {
          setMarketMessage(
            "Administrador não autenticado."
          );
        }

        return;
      }

      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "/api/market/engine",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${idToken}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Erro ao executar o motor."
        );
      }

      if (!data.running) {
        if (showMessage) {
          setMarketMessage(
            data?.message ||
              "Motor automático não está executando."
          );
        }

        return;
      }

      console.log(
        `[MARKET ENGINE] Ciclo executado: ${
          data.updatedAssets ?? 0
        } ativos atualizados.`
      );

      if (showMessage) {
        setMarketMessage(
          `Motor executado com sucesso. ${
            data.updatedAssets ?? 0
          } ativos atualizados.`
        );
      }
    } catch (error) {
      console.error(
        "[MARKET ENGINE] Erro:",
        error
      );

      if (showMessage) {
        setMarketMessage(
          error instanceof Error
            ? error.message
            : "Erro ao executar o motor."
        );
      }
    } finally {
      engineRequestRunningRef.current =
        false;
    }
  }

  // =========================
  // MOTOR CONTÍNUO
  // =========================

  useEffect(() => {
    const shouldRun =
      marketSettings.mode === "AUTO" &&
      marketSettings.enabled === true;

    // =========================
    // DESATIVAR MOTOR
    // =========================

    if (!shouldRun) {
      automaticEngineRef.current =
        false;

      if (engineIntervalRef.current) {
        clearInterval(
          engineIntervalRef.current
        );

        engineIntervalRef.current =
          null;
      }

      return;
    }

    // =========================
    // EVITAR DUPLICAÇÃO
    // =========================

    if (automaticEngineRef.current) {
      return;
    }

    automaticEngineRef.current =
      true;

    console.log(
      "[MARKET ENGINE] Motor contínuo ATIVADO."
    );

    // =========================
    // PRIMEIRO CICLO IMEDIATO
    // =========================

    executeEngineCycle(false);

    // =========================
    // CICLO A CADA 5 SEGUNDOS
    // =========================

    engineIntervalRef.current =
      setInterval(() => {
        if (
          marketSettings.mode ===
            "AUTO" &&
          marketSettings.enabled === true
        ) {
          executeEngineCycle(false);
        }
      }, 5000);

    // =========================
    // LIMPEZA
    // =========================

    return () => {
      if (engineIntervalRef.current) {
        clearInterval(
          engineIntervalRef.current
        );

        engineIntervalRef.current =
          null;
      }

      automaticEngineRef.current =
        false;

      console.log(
        "[MARKET ENGINE] Motor contínuo DESATIVADO."
      );
    };
  }, [
    marketSettings.mode,
    marketSettings.enabled,
  ]);

  // =========================
  // EXECUTAR MOTOR AGORA
  // =========================

  async function runMarketEngine() {
    try {
      setEngineLoading(true);
      setMarketMessage("");

      const user = auth.currentUser;

      if (!user) {
        setMarketMessage(
          "Administrador não autenticado."
        );
        return;
      }

      if (
        marketSettings.mode !==
        "AUTO"
      ) {
        setMarketMessage(
          "Selecione o modo AUTOMÁTICO antes de executar o motor."
        );
        return;
      }

      const targetPrice =
        Number(
          marketSettings.targetPrice
        );

      const correctionPercent =
        Number(
          marketSettings.correctionPercent
        );

      if (
        !Number.isFinite(targetPrice) ||
        targetPrice <= 0
      ) {
        setMarketMessage(
          "Digite um preço-alvo válido."
        );
        return;
      }

      if (
        !Number.isFinite(
          correctionPercent
        ) ||
        correctionPercent < 0
      ) {
        setMarketMessage(
          "Digite uma correção válida."
        );
        return;
      }

      const idToken =
        await user.getIdToken();

      // =========================
      // SALVAR CONFIGURAÇÃO
      // =========================

      const saveResponse =
        await fetch(
          "/api/admin/broker/market",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body: JSON.stringify({
              mode:
                marketSettings.mode,

              direction:
                marketSettings.direction,

              volatility:
                marketSettings.volatility,

              targetPrice,

              correctionPercent,

              startTime:
                marketSettings.startTime,

              peakTime:
                marketSettings.peakTime,

              endTime:
                marketSettings.endTime,

              enabled: true,
            }),
          }
        );

      const saveData =
        await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(
          saveData.error ||
            "Não foi possível ativar o motor."
        );
      }

      // =========================
      // ATUALIZAR ESTADO
      // =========================

      setMarketSettings(
        (current) => ({
          ...current,

          mode: "AUTO",

          enabled: true,
        })
      );

      // =========================
      // EXECUTAR PRIMEIRO CICLO
      // =========================

      await executeEngineCycle(
        true
      );
    } catch (error) {
      console.error(
        "Erro ao executar motor:",
        error
      );

      setMarketMessage(
        error instanceof Error
          ? error.message
          : "Erro ao executar motor."
      );
    } finally {
      setEngineLoading(false);
    }
  }

  // =========================
  // CRIAR ATIVOS
  // =========================

  async function handleCreateAssets() {
    try {
      setLoading(true);
      setMessage("");

      await seedBrokerAssets();

      setMessage(
        "Ativos criados com sucesso!"
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Erro ao criar os ativos."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // ALTERAR PREÇO
  // =========================

  async function changePrice(
    asset: BrokerAsset,
    direction: "UP" | "DOWN"
  ) {
    try {
      const variation =
        asset.price * 0.01;

      const newPrice =
        direction === "UP"
          ? asset.price + variation
          : Math.max(
              0.0001,
              asset.price - variation
            );

      await updateDoc(
        doc(
          db,
          "brokerAssets",
          asset.id
        ),
        {
          previousPrice:
            asset.price,

          price: newPrice,

          direction,

          updatedAt:
            serverTimestamp(),
        }
      );
    } catch (error) {
      console.error(
        "Erro ao alterar preço:",
        error
      );

      setMessage(
        "Erro ao alterar o preço."
      );
    }
  }

  // =========================
  // DEFINIR NEUTRO
  // =========================

  async function setNeutral(
    asset: BrokerAsset
  ) {
    try {
      await updateDoc(
        doc(
          db,
          "brokerAssets",
          asset.id
        ),
        {
          direction: "NEUTRAL",

          updatedAt:
            serverTimestamp(),
        }
      );
    } catch (error) {
      console.error(
        "Erro ao alterar direção:",
        error
      );
    }
  }

  // =========================
  // ALTERAR SALDO
  // =========================

  async function changeUserBalance(
    operation: "ADD" | "REMOVE"
  ) {
    try {
      setBalanceLoading(true);
      setBalanceMessage("");

      if (!selectedUserId) {
        setBalanceMessage(
          "Selecione um usuário."
        );
        return;
      }

      const amount =
        Number(balanceAmount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        setBalanceMessage(
          "Digite um valor válido."
        );
        return;
      }

      const user =
        auth.currentUser;

      if (!user) {
        setBalanceMessage(
          "Administrador não autenticado."
        );
        return;
      }

      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/broker/balance",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body: JSON.stringify({
              userId:
                selectedUserId,

              operation,

              amount,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Não foi possível alterar o saldo."
        );
      }

      setBalanceMessage(
        operation === "ADD"
          ? `Saldo adicionado com sucesso. Novo saldo: $${Number(
              data.newBalance
            ).toLocaleString(
              "en-US",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`
          : `Saldo removido com sucesso. Novo saldo: $${Number(
              data.newBalance
            ).toLocaleString(
              "en-US",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`
      );

      setBalanceAmount("");

      await loadAccounts();
    } catch (error) {
      console.error(
        "Erro ao alterar saldo:",
        error
      );

      setBalanceMessage(
        error instanceof Error
          ? error.message
          : "Erro ao alterar saldo."
      );
    } finally {
      setBalanceLoading(false);
    }
  }

  // =========================
  // FORMATAR PREÇO
  // =========================

  const formatPrice = (
    price: number
  ) => {
    return price.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }
    );
  };

  // =========================
  // CONTA SELECIONADA
  // =========================

  const selectedAccount =
    accounts.find(
      (account) =>
        account.userId ===
        selectedUserId
    );

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* =========================
            HEADER
        ========================= */}

        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              Broker Admin
            </h1>

            <p className="text-slate-400 mt-1">
              Controle do mercado simulado
            </p>
          </div>

          <button
            onClick={() =>
              router.push("/admin")
            }
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            Voltar
          </button>
        </header>

        {/* =========================
            CONFIGURAÇÃO INICIAL
        ========================= */}

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold">
            Configuração inicial
          </h2>

          <p className="text-slate-400 mt-2">
            Criar os ativos padrão do broker no Firestore.
          </p>

          <button
            onClick={
              handleCreateAssets
            }
            disabled={loading}
            className="mt-6 px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition font-semibold"
          >
            {loading
              ? "Criando ativos..."
              : "Criar ativos"}
          </button>

          {message && (
            <p className="mt-4 text-green-400">
              {message}
            </p>
          )}
        </section>

        {/* =========================
            CONTROLE AUTOMÁTICO DO MERCADO
        ========================= */}

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">
                Controle automático do mercado
              </h2>

              <p className="text-slate-400 mt-1">
                Configure como os preços devem se movimentar durante o dia.
              </p>
            </div>

            <div
              className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                marketSettings.enabled &&
                marketSettings.mode ===
                  "AUTO"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {marketSettings.enabled &&
              marketSettings.mode ===
                "AUTO"
                ? "MERCADO AUTOMÁTICO ATIVO"
                : "MERCADO AUTOMÁTICO INATIVO"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* MODO */}

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Modo do mercado
              </label>

              <select
                value={
                  marketSettings.mode
                }
                onChange={(event) =>
                  setMarketSettings(
                    (current) => ({
                      ...current,

                      mode:
                        event.target
                          .value as
                          | "MANUAL"
                          | "AUTO",
                    })
                  )
                }
                className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-blue-500"
              >
                <option value="MANUAL">
                  MANUAL
                </option>

                <option value="AUTO">
                  AUTOMÁTICO
                </option>
              </select>
            </div>

            {/* DIREÇÃO */}

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Tendência do mercado
              </label>

              <select
                value={
                  marketSettings.direction
                }
                onChange={(event) =>
                  setMarketSettings(
                    (current) => ({
                      ...current,

                      direction:
                        event.target
                          .value as
                          | "UP"
                          | "DOWN"
                          | "NEUTRAL"
                          | "VOLATILE",
                    })
                  )
                }
                className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-blue-500"
              >
                <option value="UP">
                  SUBIR
                </option>

                <option value="DOWN">
                  DESCER
                </option>

                <option value="NEUTRAL">
                  NEUTRO
                </option>

                <option value="VOLATILE">
                  VOLÁTIL
                </option>
              </select>
            </div>

            {/* VOLATILIDADE */}

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Volatilidade
              </label>

              <select
                value={
                  marketSettings.volatility
                }
                onChange={(event) =>
                  setMarketSettings(
                    (current) => ({
                      ...current,

                      volatility:
                        event.target
                          .value as
                          | "LOW"
                          | "MEDIUM"
                          | "HIGH",
                    })
                  )
                }
                className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-blue-500"
              >
                <option value="LOW">
                  BAIXA
                </option>

                <option value="MEDIUM">
                  MÉDIA
                </option>

                <option value="HIGH">
                  ALTA
                </option>
              </select>
            </div>

            {/* PREÇO ALVO */}

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Preço-alvo
              </label>

              <input
                type="number"
                min="0"
                step="0.0001"
                value={
                  marketSettings.targetPrice
                }
                onChange={(event) =>
                  setMarketSettings(
                    (current) => ({
                      ...current,

                      targetPrice:
                        Number(
                          event.target.value
                        ),
                    })
                  )
                }
                placeholder="Ex: 110000"
                className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500"
              />

              <p className="text-xs text-slate-500 mt-2">
                O motor tenta aproximar o mercado deste preço.
              </p>
            </div>

            {/* CORREÇÃO */}

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Correção (%)
              </label>

              <input
                type="number"
                min="0"
                step="0.1"
                value={
                  marketSettings.correctionPercent
                }
                onChange={(event) =>
                  setMarketSettings(
                    (current) => ({
                      ...current,

                      correctionPercent:
                        Number(
                          event.target.value
                        ),
                    })
                  )
                }
                placeholder="Ex: 1"
                className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500"
              />

              <p className="text-xs text-slate-500 mt-2">
                Percentual usado para correções do movimento.
              </p>
            </div>

            {/* HORA INICIAL */}

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Início do mercado
              </label>

              <input
                type="time"
                value={
                  marketSettings.startTime
                }
                onChange={(event) =>
                  setMarketSettings(
                    (current) => ({
                      ...current,

                      startTime:
                        event.target.value,
                    })
                  )
                }
                className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* HORA DE PICO */}

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Horário de pico
              </label>

              <input
                type="time"
                value={
                  marketSettings.peakTime
                }
                onChange={(event) =>
                  setMarketSettings(
                    (current) => ({
                      ...current,

                      peakTime:
                        event.target.value,
                    })
                  )
                }
                className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-blue-500"
              />

              <p className="text-xs text-slate-500 mt-2">
                Momento em que o movimento pode ficar mais forte.
              </p>
            </div>

            {/* HORA FINAL */}

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Fim do mercado
              </label>

              <input
                type="time"
                value={
                  marketSettings.endTime
                }
                onChange={(event) =>
                  setMarketSettings(
                    (current) => ({
                      ...current,

                      endTime:
                        event.target.value,
                    })
                  )
                }
                className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-blue-500"
              />
            </div>

          </div>

          {/* ATIVAR MERCADO */}

          <div className="mt-6 bg-slate-950 border border-slate-800 rounded-xl p-5">

            <div className="flex items-center justify-between gap-4">

              <div>
                <p className="font-semibold text-white">
                  Motor automático
                </p>

                <p className="text-sm text-slate-400 mt-1">
                  Quando ativado e configurado como AUTO, o motor movimentará os preços automaticamente a cada 5 segundos.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMarketSettings(
                    (current) => ({
                      ...current,

                      enabled:
                        !current.enabled,
                    })
                  )
                }
                className={`px-5 py-3 rounded-lg font-semibold transition ${
                  marketSettings.enabled
                    ? "bg-green-600 hover:bg-green-500"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {marketSettings.enabled
                  ? "ATIVO"
                  : "DESATIVADO"}
              </button>

            </div>

          </div>

          {/* BOTÕES */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">

            <button
              onClick={
                saveMarketSettings
              }
              disabled={
                marketLoading
              }
              className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition font-semibold"
            >
              {marketLoading
                ? "Salvando..."
                : "SALVAR CONFIGURAÇÃO"}
            </button>

            <button
              onClick={
                runMarketEngine
              }
              disabled={
                engineLoading
              }
              className="px-5 py-3 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 transition font-semibold"
            >
              {engineLoading
                ? "Executando..."
                : "▶ EXECUTAR MOTOR AGORA"}
            </button>

          </div>

          {marketMessage && (
            <p
              className={`mt-4 text-sm ${
                marketMessage.includes(
                  "sucesso"
                )
                  ? "text-green-400"
                  : "text-slate-300"
              }`}
            >
              {marketMessage}
            </p>
          )}

        </section>

        {/* =========================
            CONTROLE DE SALDO
        ========================= */}

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-2xl font-bold">
                Controle de saldo
              </h2>

              <p className="text-slate-400 mt-1">
                Adicione ou remova saldo virtual das contas dos usuários.
              </p>
            </div>

            <button
              onClick={
                loadAccounts
              }
              disabled={
                loadingAccounts
              }
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition"
            >
              {loadingAccounts
                ? "Atualizando..."
                : "Atualizar"}
            </button>

          </div>

          {accounts.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">

              <p className="text-slate-400">
                Nenhuma conta do broker encontrada.
              </p>

              <p className="text-sm text-slate-500 mt-2">
                As contas aparecem aqui quando os usuários criarem/acessarem o broker.
              </p>

            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* USUÁRIO */}

              <div>

                <label className="block text-sm text-slate-400 mb-2">
                  Usuário
                </label>

                <select
                  value={
                    selectedUserId
                  }
                  onChange={(event) =>
                    setSelectedUserId(
                      event.target.value
                    )
                  }
                  className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-blue-500"
                >
                  {accounts.map(
                    (account) => (
                      <option
                        key={
                          account.userId
                        }
                        value={
                          account.userId
                        }
                      >
                        {account.name} —{" "}
                        {account.email}
                      </option>
                    )
                  )}
                </select>

                {selectedAccount && (
                  <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-5">

                    <p className="text-sm text-slate-400">
                      Usuário selecionado
                    </p>

                    <p className="text-lg font-semibold text-white mt-1">
                      {
                        selectedAccount.name
                      }
                    </p>

                    <p className="text-sm text-slate-400 mt-1">
                      {
                        selectedAccount.email
                      }
                    </p>

                    <p className="text-sm text-slate-400 mt-4">
                      Saldo atual
                    </p>

                    <p className="text-3xl font-bold mt-1">
                      $
                      {selectedAccount.balance.toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </p>

                    <p className="text-xs text-slate-600 mt-2">
                      ID:{" "}
                      {
                        selectedAccount.userId
                      }
                    </p>

                  </div>
                )}

              </div>

              {/* ALTERAR SALDO */}

              <div>

                <label className="block text-sm text-slate-400 mb-2">
                  Valor
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    balanceAmount
                  }
                  onChange={(event) =>
                    setBalanceAmount(
                      event.target.value
                    )
                  }
                  placeholder="Ex: 1000"
                  className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-blue-500"
                />

                <div className="grid grid-cols-2 gap-3 mt-4">

                  <button
                    onClick={() =>
                      changeUserBalance(
                        "ADD"
                      )
                    }
                    disabled={
                      balanceLoading
                    }
                    className="px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 transition font-semibold"
                  >
                    {balanceLoading
                      ? "Processando..."
                      : "＋ ADICIONAR SALDO"}
                  </button>

                  <button
                    onClick={() =>
                      changeUserBalance(
                        "REMOVE"
                      )
                    }
                    disabled={
                      balanceLoading
                    }
                    className="px-4 py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 transition font-semibold"
                  >
                    {balanceLoading
                      ? "Processando..."
                      : "− REMOVER SALDO"}
                  </button>

                </div>

                {balanceMessage && (
                  <p className="mt-4 text-sm text-green-400">
                    {
                      balanceMessage
                    }
                  </p>
                )}

              </div>

            </div>
          )}

        </section>

        {/* =========================
            CONTROLE DE ATIVOS
        ========================= */}

        <section>

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-2xl font-bold">
                Controle de ativos
              </h2>

              <p className="text-slate-400 mt-1">
                Controle o preço e a direção de cada ativo.
              </p>
            </div>

            <span className="text-sm text-slate-400">
              {assets.length} ativos
            </span>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

            {assets.map(
              (asset) => (
                <div
                  key={asset.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
                >

                  <div className="flex items-start justify-between">

                    <div>

                      <p className="text-lg font-bold">
                        {asset.symbol}
                      </p>

                      <p className="text-sm text-slate-400">
                        {asset.name}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        {asset.category}
                      </p>

                    </div>

                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        asset.direction ===
                        "UP"
                          ? "bg-green-500/10 text-green-400"
                          : asset.direction ===
                            "DOWN"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {asset.direction ===
                      "UP"
                        ? "SUBINDO"
                        : asset.direction ===
                          "DOWN"
                        ? "DESCENDO"
                        : "NEUTRO"}
                    </span>

                  </div>

                  <div className="mt-5">

                    <p className="text-xs text-slate-500">
                      Preço atual
                    </p>

                    <p className="text-2xl font-bold">
                      $
                      {formatPrice(
                        asset.price
                      )}
                    </p>

                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-5">

                    <button
                      onClick={() =>
                        changePrice(
                          asset,
                          "UP"
                        )
                      }
                      className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 transition font-semibold"
                    >
                      ▲ SUBIR 1%
                    </button>

                    <button
                      onClick={() =>
                        changePrice(
                          asset,
                          "DOWN"
                        )
                      }
                      className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition font-semibold"
                    >
                      ▼ DESCER 1%
                    </button>

                  </div>

                  <button
                    onClick={() =>
                      setNeutral(
                        asset
                      )
                    }
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                  >
                    Definir Neutro
                  </button>

                </div>
              )
            )}

          </div>

        </section>

      </div>
    </main>
  );
}