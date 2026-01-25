import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          {/* Logo untuk dark mode */}
          <Image
            src="/logo-deus.webp"
            alt="Deus Code"
            width={72}
            height={72}
            priority
            className="rounded-xl hidden dark:block"
          />
          {/* Logo untuk light mode */}
          <Image
            src="/logo-deus-dark.webp"
            alt="Deus Code"
            width={72}
            height={72}
            priority
            className="rounded-xl block dark:hidden"
          />
          <h1 className="mt-4 text-2xl font-semibold text-white">Deus Code</h1>
          <p className="mt-1 text-sm text-white/70">SOP & Admin Docs</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-yellow-400 px-4 py-3 text-center font-semibold text-black hover:opacity-90"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-white/15 px-4 py-3 text-center font-semibold text-white hover:bg-white/10"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}