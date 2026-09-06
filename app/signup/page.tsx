"use client";

import { FormEvent, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      router.push("/market");
    } catch (error: unknown) {
      console.error(error);

      if (
        error &&
        typeof error === "object" &&
        "code" in error
      ) {
        const firebaseError = error as { code: string };

        if (firebaseError.code === "auth/email-already-in-use") {
          setError("Este e-mail já está cadastrado.");
        } else if (
          firebaseError.code === "auth/invalid-email"
        ) {
          setError("Digite um e-mail válido.");
        } else if (
          firebaseError.code === "auth/weak-password"
        ) {
          setError("A senha é muito fraca.");
        } else {
          setError("Não foi possível criar a conta.");
        }
      } else {
        setError("Não foi possível criar a conta.");
      }
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
            Crie sua conta para acessar as oportunidades.
          </p>

        </div>

        <form
          onSubmit={handleSignup}
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-8"
        >

          <div>

            <label className="mb-2 block text-sm font-medium">
              E-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
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
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Mínimo 6 caracteres"
              required
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
            />

          </div>

          <div className="mt-5">

            <label className="mb-2 block text-sm font-medium">
              Confirmar senha
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Digite a senha novamente"
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
            {loading ? "Criando conta..." : "Criar conta"}
          </button>

        </form>

        <div className="mt-6 text-center text-sm text-slate-400">

          Já tem uma conta?{" "}

          <a
            href="/login"
            className="font-medium text-blue-500 hover:text-blue-400"
          >
            Entrar
          </a>

        </div>

      </div>

    </main>
  );
}