"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

function DepositContent() {
const searchParams = useSearchParams();
const router = useRouter();

const opportunityId = searchParams.get("opportunityId") || "";
const asset = searchParams.get("asset") || "Análise";

const [method, setMethod] = useState<"card" | "crypto" | null>(null);
const [user, setUser] = useState<User | null>(null);
const [processing, setProcessing] = useState(false);
const [error, setError] = useState("");

useEffect(() => {
const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
setUser(currentUser);
});


return () => unsubscribe();


}, []);

async function handleContinue() {
setError("");


if (!user) {
  router.push("/login");
  return;
}

if (!opportunityId) {
  setError("A oportunidade não foi identificada.");
  return;
}

if (!method) {
  setError("Escolha um método de pagamento.");
  return;
}

try {
  setProcessing(true);

  /*
   * Criamos o pedido de acesso como PENDING.
   *
   * O acesso NÃO é liberado aqui.
   * Somente o administrador poderá aprovar
   * depois da confirmação do pagamento.
   */
  const paymentRequest = await addDoc(collection(db, "accesses"), {
    userId: user.uid,
    userEmail: user.email || "",
    opportunityId,
    asset,
    amount: 10,
    currency: "USD",
    method,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  /*
   * Por enquanto é uma tela de pagamento de teste.
   * Depois vamos substituir por checkout real.
   */
  router.push(
    `/deposit/success?requestId=${paymentRequest.id}&method=${method}`
  );
} catch (err) {
  console.error("Erro ao criar pedido de pagamento:", err);

  setError(
    "Não foi possível criar o pedido. Verifique as regras do Firestore."
  );
} finally {
  setProcessing(false);
}


}

return ( <main className="min-h-screen bg-slate-950 px-6 py-10 text-white"> <div className="mx-auto max-w-2xl">


    {/* HEADER */}
    <header className="mb-10 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">
          Trade<span className="text-blue-500">Signal</span>
        </h1>

        <p className="mt-1 text-xs text-slate-400">
          Pagamento seguro
        </p>
      </div>

      <Link
        href="/market"
        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
      >
        ← Voltar
      </Link>
    </header>

    {/* PAGAMENTO */}
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">

      <div className="text-center">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl">
          🔓
        </div>

        <h2 className="mt-5 text-3xl font-bold">
          Desbloquear análise
        </h2>

        <p className="mt-3 text-slate-400">
          Desbloqueie a análise completa da oportunidade.
        </p>

        <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">

          <p className="text-xs uppercase tracking-wider text-blue-400">
            Oportunidade
          </p>

          <p className="mt-2 text-xl font-bold">
            {asset}
          </p>

          {opportunityId && (
            <p className="mt-2 text-xs text-slate-500">
              ID: {opportunityId}
            </p>
          )}

        </div>

      </div>

      {/* PREÇO */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-6 text-center">

        <p className="text-sm text-slate-400">
          Valor para desbloquear
        </p>

        <p className="mt-2 text-4xl font-bold">
          $10.00
        </p>

        <p className="mt-2 text-xs text-slate-500">
          Pagamento único
        </p>

      </div>

      {/* MÉTODOS */}
      <div className="mt-8">

        <h3 className="mb-4 text-lg font-semibold">
          Escolha o método de pagamento
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">

          {/* CARTÃO */}
          <button
            type="button"
            onClick={() => setMethod("card")}
            className={`rounded-2xl border p-5 text-left transition ${
              method === "card"
                ? "border-blue-500 bg-blue-500/10"
                : "border-white/10 bg-white/[0.03] hover:border-blue-500/40"
            }`}
          >

            <div className="text-3xl">
              💳
            </div>

            <h4 className="mt-4 font-semibold">
              Cartão
            </h4>

            <p className="mt-1 text-sm text-slate-400">
              Visa, Mastercard e outros cartões.
            </p>

          </button>

          {/* CRYPTO */}
          <button
            type="button"
            onClick={() => setMethod("crypto")}
            className={`rounded-2xl border p-5 text-left transition ${
              method === "crypto"
                ? "border-blue-500 bg-blue-500/10"
                : "border-white/10 bg-white/[0.03] hover:border-blue-500/40"
            }`}
          >

            <div className="text-3xl">
              ₿
            </div>

            <h4 className="mt-4 font-semibold">
              Cripto
            </h4>

            <p className="mt-1 text-sm text-slate-400">
              Pague usando criptomoedas.
            </p>

          </button>

        </div>
      </div>

      {/* CARTÃO */}
      {method === "card" && (
        <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">

          <div className="text-center">

            <div className="text-3xl">
              💳
            </div>

            <h3 className="mt-3 text-xl font-bold">
              Pagamento com cartão
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Clique abaixo para continuar com o pagamento.
            </p>

            <button
              type="button"
              onClick={handleContinue}
              disabled={processing}
              className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing
                ? "Criando pedido..."
                : "Continuar para pagamento"}
            </button>

          </div>

        </div>
      )}

      {/* CRYPTO */}
      {method === "crypto" && (
        <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">

          <div className="text-center">

            <div className="text-3xl">
              ₿
            </div>

            <h3 className="mt-3 text-xl font-bold">
              Pagamento com cripto
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Clique abaixo para continuar com o pagamento.
            </p>

            <button
              type="button"
              onClick={handleContinue}
              disabled={processing}
              className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing
                ? "Criando pedido..."
                : "Continuar para pagamento"}
            </button>

          </div>

        </div>
      )}

      {/* ERRO */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* AVISO */}
      <div className="mt-8 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">

        <p className="text-xs leading-5 text-yellow-400">
          🔒 O acesso à análise será liberado somente depois que o
          pagamento for confirmado pelo administrador.
        </p>

      </div>

    </div>

  </div>
</main>


);
}

export default function DepositPage() {
return (
<Suspense
fallback={ <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white"> <div className="text-sm text-slate-400">
Carregando pagamento... </div> </main>
}
> <DepositContent /> </Suspense>
);
}
