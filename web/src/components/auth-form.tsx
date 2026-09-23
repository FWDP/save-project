"use client";
import { useActionState } from "react";
import Link from "next/link";
import { authenticate, changePassword } from "@/app/auth/actions";
export function AuthForm({
  signup = false,
  configured = true,
  recovery = false,
}: {
  signup?: boolean;
  configured?: boolean;
  recovery?: boolean;
}) {
  const [state, action, pending] = useActionState(
    recovery ? changePassword : authenticate,
    {},
  );
  return (
    <form action={action} className="auth-form">
      {signup && (
        <label>
          Your name
          <input
            name="name"
            autoComplete="name"
            placeholder="Alex Santos"
            maxLength={80}
          />
        </label>
      )}
      {!recovery && (
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
      )}
      <label>
        {signup || recovery ? "Create a password" : "Password"}
        <input
          name="password"
          type="password"
          autoComplete={
            signup || recovery ? "new-password" : "current-password"
          }
          placeholder={
            signup || recovery
              ? "At least 12 characters"
              : "Enter your password"
          }
        />
      </label>
      {recovery && (
        <label>
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
          />
        </label>
      )}
      {state.error && (
        <p className="notice danger" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="notice" role="status">
          {state.message}
        </p>
      )}
      <button
        className="button primary full"
        name="mode"
        value={signup ? "signup" : "password"}
        disabled={pending || !configured}
      >
        {pending
          ? "Please wait…"
          : recovery
            ? "Update password"
            : signup
              ? "Create account"
              : "Sign in"}
        <span aria-hidden>↗</span>
      </button>
      {!recovery && (
        <>
          <div className="divider-label">
            <span>or continue with</span>
          </div>
          <div className="auth-alternatives">
            <button
              className="button secondary"
              name="mode"
              value="google"
              formNoValidate
              disabled={pending || !configured}
            >
              <span className="google-mark" aria-hidden>
                G
              </span>{" "}
              Google
            </button>
            <button
              className="button secondary"
              name="mode"
              value="magic"
              disabled={pending || !configured}
            >
              Email link
            </button>
          </div>
          <button
            className="text-button"
            name="mode"
            value="recovery"
            disabled={pending || !configured}
          >
            Forgot your password?
          </button>
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New to SAVE?"}{" "}
            <Link href={signup ? "/sign-in" : "/sign-up"}>
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </>
      )}
    </form>
  );
}
