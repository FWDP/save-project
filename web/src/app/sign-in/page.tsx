import { AuthForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";
import { authConfigured } from "@/lib/supabase";
import { signOut } from "@/app/auth/actions";
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthLayout>
      <div className="auth-card">
        <span className="eyebrow">YOUR MONEY, IN FOCUS</span>
        <h2>Welcome back.</h2>
        <p className="muted">Sign in to pick up where you left off.</p>
        {!authConfigured() && (
          <p className="notice" role="status">
            Sign-in is being set up. Please check back shortly.
          </p>
        )}
        {error && (
          <p className="notice danger" role="alert">
            {error === "configuration"
              ? "Sign-in is unavailable because the server's authentication key is invalid. Please contact the app administrator."
              : error === "cancelled"
              ? "Google sign-in was cancelled. You can try again or choose another method."
              : error === "provider"
                ? "The sign-in provider could not complete your request. Please try again."
                : error === "signout"
                  ? "Sign-out could not be completed. Please try again."
                  : "This sign-in link is invalid or expired. Start sign-in again in this browser."}
          </p>
        )}
        {error === "signout" && (
          <form action={signOut}>
            <button className="button secondary">Retry sign-out</button>
          </form>
        )}
        <AuthForm configured={authConfigured()} />
        <p className="auth-fineprint">
          A calmer way to manage your personal and business finances.
        </p>
      </div>
    </AuthLayout>
  );
}
