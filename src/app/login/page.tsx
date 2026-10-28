"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [emailRequested, setEmailRequested] = useState(false);

  const handleEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      signIn("email", { email, callbackUrl: "/" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="hq-ambient" aria-hidden />
      <div className="relative z-10 panel hq-rise w-full max-w-sm p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-11 h-11 rounded-[var(--r-md)] bg-white flex items-center justify-center text-[19px] font-bold text-[#0a0b0d]">
            M
          </div>
          <h1 className="mt-5 text-[20px] font-semibold tracking-[-0.015em] text-[var(--text)]">
            Blue Mogul AI
          </h1>
          <p className="eyebrow mt-2">Blue Mogul — Mission Control</p>
        </div>

        <div className="rule my-7" />

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="btn-primary w-full py-3 text-[13px] flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          Sign in with Google
        </button>

        <button
          onClick={() => signIn("github", { callbackUrl: "/" })}
          className="btn-ghost w-full py-3 text-[13px] flex items-center justify-center gap-2 mt-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .296c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.226-.015-2.233-3.337.726-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.083-.729.083-.729 1.205.085 1.84 1.238 1.84 1.238 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.304-5.466-1.332-5.466-5.931 0-1.31.468-2.38 1.235-3.22-.124-.303-.053-.628.074-.95 0 0 0-.002.001.001c1.426 1.03 3.034 1.775 4.832 1.775 1.626 0 3.156-.475 4.478-1.426l.001.001c.57.627 1.152 1.16 1.81 1.475l-.001-.001c1.096 1.096 1.294 2.65.765 4.12 1.13-.275 2.16-.84 3.02-1.405 1.05-1.29 1.73-2.72 1.73-4.27 0-3.338-2.704-6.033-6.033-6.033z"/>
          </svg>
          Sign in with GitHub
        </button>

        <div className="mt-5">
          <p className="text-[11px] text-[var(--text-3)] mb-2">Or sign in with email</p>
          {emailRequested ? (
            <form onSubmit={handleEmail} className="space-y-2">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-[13px] rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]"
                required
              />
              <button
                type="submit"
                className="btn-ghost w-full py-2 text-[12px] flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <path d="M22 6l-10 7L2 6"/>
                </svg>
                Send magic link
              </button>
            </form>
          ) : (
            <button
              onClick={() => setEmailRequested(true)}
              className="btn-ghost w-full py-2 text-[12px] flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <path d="M22 6l-10 7L2 6"/>
              </svg>
              Sign in with email
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
