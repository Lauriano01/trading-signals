"use client";

import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";

const ADMIN_EMAIL = "laelsonlavosier@gmail.com";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const loggedUser = credential.user;

      if (loggedUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        router.replace("/admin");
      } else {
        router.replace("/market");
      }
    } catch (error) {
      console.error(error);
      setError("E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">

      <div className="w-full max-w-md">

        <div className="mb-8 text-center">

          <h1 className="text-3xl font-bold">
            Trade<span className="text-blue-500">Signal</span>
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Entre na sua conta.
          </p>

        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-8"
        >

          <div>

            <label className="mb-2 block text-sm font-medium">
              E-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Seu e-mail"
              required
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
            />

          </div>

          <div className="mt-5">

            <label className="mb-2 block text-sm font-medium">
              Senha
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              required
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
            />

          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

        </form>

        <div className="mt-6 text-center text-sm text-slate-400">

          Ainda não tem uma conta?{" "}

          <a
            href="/signup"
            className="font-medium text-blue-500 hover:text-blue-400"
          >
            Criar conta
          </a>

        </div>

      </div>

    </main>
  );
}