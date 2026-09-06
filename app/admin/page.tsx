
"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

      setMessage("Oportunidade salva com sucesso!");

      setAsset("");
      setEntry("");
      setStopLoss("");
      setTakeProfit("");
      setAnalysis("");
    } catch (error) {
      console.error("Erro ao salvar oportunidade:", error);

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

          <div className="flex items-center gap-3">

            {/* BOTÃO PAGAMENTOS */}
            <button
              type="button"
              onClick={() => router.push("/admin/payments")}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              💳 Pagamentos
            </button>

            {/* BOTÃO SAIR */}
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

        {/* FORMULÁRIO */}
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
                onChange={(event) => setMarket(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {markets.map((item) => (
                  <option key={item} value={item}>
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
                onChange={(event) => setAsset(event.target.value)}
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
                onChange={(event) => setDirection(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {directions.map((item) => (
                  <option key={item} value={item}>
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
                onChange={(event) => setRisk(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {riskLevels.map((item) => (
                  <option key={item} value={item}>
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
                onChange={(event) => setEntry(event.target.value)}
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
                onChange={(event) => setStopLoss(event.target.value)}
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
                onChange={(event) => setTakeProfit(event.target.value)}
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
              onChange={(event) => setAnalysis(event.target.value)}
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
            {saving ? "Salvando..." : "Salvar oportunidade"}
          </button>

        </form>
      </div>
    </main>
  );
}

