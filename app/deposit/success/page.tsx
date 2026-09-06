"use client";

import Link from "next/link";

export default function DepositSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-lg text-center">

        <div className="rounded-3xl border border-green-500/20 bg-green-500/5 p-8">

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-4xl">
            ✓
          </div>

          <h1 className="mt-6 text-3xl font-bold">
            Pagamento recebido
          </h1>

          <p className="mt-4 text-slate-400">
            O seu pagamento foi enviado para confirmação.
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Assim que o pagamento for confirmado, o acesso à análise será
            liberado.
          </p>

          <Link
            href="/market"
            className="mt-8 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
          >
            Voltar para o mercado
          </Link>

        </div>

      </div>
    </main>
  );
}