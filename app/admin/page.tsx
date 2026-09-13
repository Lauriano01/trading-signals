"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  addDoc,
  collection,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";

const ADMIN_EMAIL = "laelsonlavosier@gmail.com";

const markets = [
  "Crypto",
  "Forex",
  "Acoes",
  "Indices",
  "Commodities",
];

const directions = ["LONG", "SHORT"];

const riskLevels = ["Baixo", "Medio", "Alto"];

type SupportMessage = {
  id: string;
  senderId: string;
  senderType: "user" | "admin";
  message: string;
  createdAt?: any;
};

type SupportClient = {
  userId: string;
  lastMessage: string;
  lastMessageAt?: any;
};

export default function AdminPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [market, setMarket] = useState("Crypto");
  const [asset, setAsset] = useState("");
  const [direction, setDirection] = useState("LONG");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [risk, setRisk] = useState("Medio");
  const [analysis, setAnalysis] = useState("");

  /*
   * =========================================================
   * CHAT DE APOIO
   * =========================================================
   */

  const [supportClients, setSupportClients] = useState<
    SupportClient[]
  >([]);

  const [selectedSupportClient, setSelectedSupportClient] =
    useState<string | null>(null);

  const [supportMessages, setSupportMessages] = useState<
    SupportMessage[]
  >([]);

  const [supportMessage, setSupportMessage] = useState("");

  const [sendingSupport, setSendingSupport] = useState(false);

  /*
   * VERIFICAR ADMIN
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      if (
        currentUser.email?.toLowerCase() !==
        ADMIN_EMAIL.toLowerCase()
      ) {
        router.replace("/market");
        return;
      }

      setUser(currentUser);
      setChecking(false);
    });

    return () => unsubscribe();
  }, [router]);

  /*
   * =========================================================
   * CARREGAR LISTA DE CLIENTES DO CHAT
   * =========================================================
   *
   * As mensagens existentes estão em:
   *
   * supportChats/{userId}/messages/{messageId}
   *
   * Por isso usamos collectionGroup("messages") para descobrir
   * quais clientes já possuem conversas.
   */
  useEffect(() => {
    if (!user) return;

    const messagesQuery = query(
      collectionGroup(db, "messages")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const clientsMap = new Map<string, SupportClient>();

        snapshot.docs.forEach((item) => {
          const data = item.data() as SupportMessage;

          /*
           * Caminho:
           * supportChats / USER_ID / messages / MESSAGE_ID
           *
           * O documento pai da subcoleção messages é o USER_ID.
           */
          const userId =
            item.ref.parent.parent?.id || "";

          if (!userId) return;

          const existing = clientsMap.get(userId);

          const currentTime =
            data.createdAt?.toMillis?.() ?? 0;

          const existingTime =
            existing?.lastMessageAt?.toMillis?.() ?? 0;

          if (!existing || currentTime >= existingTime) {
            clientsMap.set(userId, {
              userId,
              lastMessage: data.message || "",
              lastMessageAt: data.createdAt,
            });
          }
        });

        const clients = Array.from(
          clientsMap.values()
        ).sort((a, b) => {
          const timeA =
            a.lastMessageAt?.toMillis?.() ?? 0;

          const timeB =
            b.lastMessageAt?.toMillis?.() ?? 0;

          return timeB - timeA;
        });

        setSupportClients(clients);

        /*
         * Se ainda não existe cliente selecionado,
         * selecionamos automaticamente o primeiro.
         */
        if (
          !selectedSupportClient &&
          clients.length > 0
        ) {
          setSelectedSupportClient(clients[0].userId);
        }

        /*
         * Se o cliente selecionado não existe mais,
         * selecionamos o primeiro disponível.
         */
        if (
          selectedSupportClient &&
          !clients.some(
            (client) =>
              client.userId === selectedSupportClient
          )
        ) {
          setSelectedSupportClient(
            clients.length > 0
              ? clients[0].userId
              : null
          );
        }
      },
      (error) => {
        console.error(
          "Erro ao carregar clientes do suporte:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, [user, selectedSupportClient]);

  /*
   * =========================================================
   * CARREGAR CONVERSA SELECIONADA
   * =========================================================
   */
  useEffect(() => {
    if (!selectedSupportClient) {
      setSupportMessages([]);
      return;
    }

    const messagesRef = collection(
      db,
      "supportChats",
      selectedSupportClient,
      "messages"
    );

    const messagesQuery = query(
      messagesRef,
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages: SupportMessage[] =
          snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<
              SupportMessage,
              "id"
            >),
          }));

        setSupportMessages(messages);
      },
      (error) => {
        console.error(
          "Erro ao carregar conversa:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, [selectedSupportClient]);

  /*
   * =========================================================
   * RESPONDER CLIENTE
   * =========================================================
   */
  async function sendSupportMessage() {
    if (!user || !selectedSupportClient) {
      return;
    }

    const text = supportMessage.trim();

    if (!text) {
      return;
    }

    try {
      setSendingSupport(true);

      const messagesRef = collection(
        db,
        "supportChats",
        selectedSupportClient,
        "messages"
      );

      await addDoc(messagesRef, {
        senderId: user.uid,
        senderType: "admin",
        message: text,
        createdAt: serverTimestamp(),
      });

      setSupportMessage("");
    } catch (error) {
      console.error(
        "Erro ao enviar resposta:",
        error
      );

      alert(
        "Não foi possível enviar a resposta."
      );
    } finally {
      setSendingSupport(false);
    }
  }

  /*
   * LOGOUT
   */
  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  /*
   * SALVAR OPORTUNIDADE
   */
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setSaving(true);

    try {
      await addDoc(collection(db, "opportunities"), {
        market,
        asset,
        direction,
        entry,
        stopLoss,
        takeProfit,
        risk,
        analysis,
        createdAt: serverTimestamp(),
        createdBy: user?.uid ?? "",
      });

      setMessage(
        "Oportunidade salva com sucesso!"
      );

      setAsset("");
      setEntry("");
      setStopLoss("");
      setTakeProfit("");
      setAnalysis("");
    } catch (error) {
      console.error(
        "Erro ao salvar oportunidade:",
        error
      );

      setMessage(
        "Não foi possível salvar. Verifique as regras do Firestore."
      );
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-blue-500" />

          <p className="mt-4 text-sm text-slate-400">
            Verificando acesso...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Sinal<span className="text-blue-500"> Admin</span>
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Painel administrativo
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">

            {/* PAGAMENTOS */}
            <button
              type="button"
              onClick={() =>
                router.push("/admin/payments")
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              💳 Pagamentos
            </button>

            {/* ADMIN BROKER */}
            <button
              type="button"
              onClick={() =>
                router.push("/admin/broker")
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              📊 Admin Broker
            </button>

            {/* SAIR */}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              Sair
            </button>

          </div>
        </header>

        {/* ADMINISTRADOR */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-slate-500">
            Administrador conectado
          </p>

          <p className="mt-1 font-medium">
            {user.email}
          </p>
        </div>

        {/* ===================================================== */}
        {/* APOIO AO CLIENTE                                     */}
        {/* ===================================================== */}

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">

          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              💬 Apoio ao cliente
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Consulte as conversas dos clientes e responda
              diretamente pelo painel administrativo.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">

            {/* LISTA DE CLIENTES */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">

              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold">
                  Conversas
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {supportClients.length} cliente
                  {supportClients.length === 1
                    ? ""
                    : "s"}
                </p>
              </div>

              <div className="max-h-[500px] overflow-y-auto">

                {supportClients.length === 0 && (
                  <div className="p-5 text-center text-xs leading-5 text-slate-500">
                    Ainda não existem conversas
                    iniciadas pelos clientes.
                  </div>
                )}

                {supportClients.map((client) => {

                  const selected =
                    selectedSupportClient ===
                    client.userId;

                  return (
                    <button
                      key={client.userId}
                      type="button"
                      onClick={() =>
                        setSelectedSupportClient(
                          client.userId
                        )
                      }
                      className={`w-full border-b border-white/5 p-4 text-left transition ${
                        selected
                          ? "bg-blue-500/10"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >

                      <div className="flex items-start gap-3">

                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${
                            selected
                              ? "bg-blue-600 text-white"
                              : "bg-white/10 text-slate-300"
                          }`}
                        >
                          👤
                        </div>

                        <div className="min-w-0">

                          <p className="truncate text-xs font-semibold text-white">
                            Cliente
                          </p>

                          <p className="mt-0.5 truncate text-[10px] text-slate-500">
                            {client.userId}
                          </p>

                          <p className="mt-2 truncate text-xs text-slate-400">
                            {client.lastMessage}
                          </p>

                        </div>

                      </div>

                    </button>
                  );
                })}

              </div>

            </div>

            {/* CONVERSA */}
            <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20">

              {!selectedSupportClient ? (

                <div className="flex flex-1 items-center justify-center p-8 text-center">

                  <div>
                    <div className="text-4xl">
                      💬
                    </div>

                    <p className="mt-4 text-sm font-semibold">
                      Nenhuma conversa selecionada
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Selecione uma conversa para
                      visualizar as mensagens.
                    </p>
                  </div>

                </div>

              ) : (

                <>
                  {/* CABEÇALHO DA CONVERSA */}
                  <div className="border-b border-white/10 px-4 py-4 sm:px-5">

                    <p className="text-sm font-semibold">
                      💬 Conversa com cliente
                    </p>

                    <p className="mt-1 break-all text-[10px] text-slate-500">
                      {selectedSupportClient}
                    </p>

                  </div>

                  {/* MENSAGENS */}
                  <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">

                    {supportMessages.length === 0 && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-xs text-slate-500">
                        Nenhuma mensagem nesta
                        conversa.
                      </div>
                    )}

                    {supportMessages.map((item) => {

                      const isAdmin =
                        item.senderType ===
                        "admin";

                      return (
                        <div
                          key={item.id}
                          className={`flex ${
                            isAdmin
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >

                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                              isAdmin
                                ? "bg-blue-600 text-white"
                                : "bg-white/[0.06] text-slate-200"
                            }`}
                          >

                            <p className="mb-1 text-[10px] font-semibold opacity-60">
                              {isAdmin
                                ? "Admin"
                                : "Cliente"}
                            </p>

                            <p className="whitespace-pre-wrap text-sm leading-5">
                              {item.message}
                            </p>

                          </div>

                        </div>
                      );
                    })}

                  </div>

                  {/* RESPOSTA */}
                  <div className="border-t border-white/10 p-4 sm:p-5">

                    <div className="flex gap-2">

                      <input
                        type="text"
                        value={supportMessage}
                        onChange={(event) =>
                          setSupportMessage(
                            event.target.value
                          )
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key ===
                              "Enter" &&
                            !event.shiftKey
                          ) {
                            event.preventDefault();
                            sendSupportMessage();
                          }
                        }}
                        placeholder="Escreva uma resposta..."
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                      />

                      <button
                        type="button"
                        onClick={
                          sendSupportMessage
                        }
                        disabled={
                          sendingSupport ||
                          !supportMessage.trim()
                        }
                        className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sendingSupport
                          ? "..."
                          : "Enviar"}
                      </button>

                    </div>

                  </div>
                </>
              )}

            </div>

          </div>

        </section>

        {/* ===================================================== */}
        {/* FORMULÁRIO DE OPORTUNIDADE                            */}
        {/* ===================================================== */}

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold">
              Nova oportunidade
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Cadastre a oportunidade que será disponibilizada aos clientes.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">

            {/* MERCADO */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Mercado
              </label>

              <select
                value={market}
                onChange={(event) =>
                  setMarket(event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {markets.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* ATIVO */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Ativo
              </label>

              <input
                type="text"
                value={asset}
                onChange={(event) =>
                  setAsset(event.target.value)
                }
                placeholder="Ex: BTC/USDT"
                required
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            {/* OPERAÇÃO */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Operação
              </label>

              <select
                value={direction}
                onChange={(event) =>
                  setDirection(event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {directions.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* RISCO */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Nível de risco
              </label>

              <select
                value={risk}
                onChange={(event) =>
                  setRisk(event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {riskLevels.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* ENTRADA */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Entrada
              </label>

              <input
                type="text"
                value={entry}
                onChange={(event) =>
                  setEntry(event.target.value)
                }
                placeholder="Ex: 108500 - 109000"
                required
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            {/* STOP LOSS */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Stop Loss
              </label>

              <input
                type="text"
                value={stopLoss}
                onChange={(event) =>
                  setStopLoss(event.target.value)
                }
                placeholder="Ex: 107500"
                required
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            {/* TAKE PROFIT */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Take Profit
              </label>

              <input
                type="text"
                value={takeProfit}
                onChange={(event) =>
                  setTakeProfit(event.target.value)
                }
                placeholder="Ex: 111000"
                required
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

          </div>

          {/* ANÁLISE */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">
              Análise
            </label>

            <textarea
              value={analysis}
              onChange={(event) =>
                setAnalysis(event.target.value)
              }
              rows={7}
              placeholder="Escreva aqui a sua análise do mercado..."
              required
              className="w-full resize-none rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
            />
          </div>

          {/* MENSAGEM */}
          {message && (
            <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-400">
              {message}
            </div>
          )}

          {/* SALVAR */}
          <button
            type="submit"
            disabled={saving}
            className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Salvando..."
              : "Salvar oportunidade"}
          </button>

        </form>

      </div>
    </main>
  );
}