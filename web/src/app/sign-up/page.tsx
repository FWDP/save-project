import { AuthForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";
import { authConfigured } from "@/lib/supabase";
export default function SignUp() {
  return (
    <AuthLayout>
      <div className="auth-card">
        <span className="eyebrow">START WITH CLARITY</span>
        <h2>Your next chapter.</h2>
        <p className="muted">
          Create an account for your personal finances and your business.
        </p>
        {!authConfigured() && (
          <p className="notice">
            Account registration is being set up. Please check back shortly.
          </p>
        )}
        <AuthForm signup configured={authConfigured()} />
      </div>
    </AuthLayout>
  );
}
