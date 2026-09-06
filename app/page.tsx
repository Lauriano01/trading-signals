"use client";

import { useRouter } from "next/navigation";

const markets = [
{
name: "Crypto",
icon: "CR",
description: "Bitcoin, Ethereum e outras criptomoedas",
},
{
name: "Forex",
icon: "FX",
description: "Pares de moedas internacionais",
},
{
name: "Acoes",
icon: "AC",
description: "Mercados de acoes",
},
{
name: "Indices",
icon: "IN",
description: "Principais indices mundiais",
},
{
name: "Commodities",
icon: "CO",
description: "Ouro, petroleo e outros ativos",
},
];

export default function Home() {
const router = useRouter();

function handleMarketClick(marketName: string) {
router.push(
`/market?type=${encodeURIComponent(marketName)}`
);
}

return ( <main className="min-h-screen bg-slate-950 text-white">


  {/* HEADER */}
  <header className="border-b border-white/10">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Trade<span className="text-blue-500">Signal</span>
        </h1>

        <p className="text-xs text-slate-400">
          Daily Market Opportunities
        </p>
      </div>

      <button
        type="button"
        onClick={() => router.push("/login")}
        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
      >
        Entrar
      </button>

    </div>
  </header>

  {/* HERO */}
  <section className="mx-auto max-w-5xl px-6 pb-12 pt-16 text-center">

    <div className="mb-4 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
      Analises atualizadas diariamente
    </div>

    <h2 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
      Qual mercado voce quer{" "}
      <span className="text-blue-500">
        operar hoje?
      </span>
    </h2>

    <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
      Escolha um mercado para descobrir as oportunidades
      selecionadas para hoje.
    </p>

  </section>

  {/* MARKETS */}
  <section className="mx-auto max-w-6xl px-6 pb-20">

    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

      {markets.map((market) => (

        <button
          key={market.name}
          type="button"
          onClick={() => handleMarketClick(market.name)}
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left transition duration-200 hover:-translate-y-1 hover:border-blue-500/50 hover:bg-blue-500/[0.06]"
        >

          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10 text-sm font-bold text-blue-400 transition group-hover:bg-blue-500/20">
            {market.icon}
          </div>

          <h3 className="text-xl font-semibold">
            {market.name}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            {market.description}
          </p>

          <div className="mt-6 flex items-center justify-between">

            <span className="text-sm font-medium text-blue-400">
              Ver oportunidades
            </span>

            <span className="text-lg text-slate-500 transition group-hover:translate-x-1 group-hover:text-blue-400">
              →
            </span>

          </div>

        </button>

      ))}

    </div>

  </section>

  {/* FOOTER */}
  <footer className="border-t border-white/10 py-8 text-center">
    <p className="text-xs text-slate-500">
      As informacoes apresentadas sao analises e nao garantem resultados
      financeiros.
    </p>
  </footer>

</main>

);
}
