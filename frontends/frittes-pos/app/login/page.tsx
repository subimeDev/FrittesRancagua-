"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    localStorage.setItem("frittes-pos:session", "mock-session-token");
    setLoading(false);
    router.push("/");
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6">
      <form onSubmit={onSubmit} className="w-full space-y-3 rounded-xl border border-line bg-white p-6">
        <h1 className="text-2xl font-semibold">Ingreso staff</h1>
        <p className="text-sm text-black/60">Solo personal autorizado.</p>
        <input
          type="email"
          required
          placeholder="email@frittes.cl"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="********"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-mustard px-4 py-2 font-semibold disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
