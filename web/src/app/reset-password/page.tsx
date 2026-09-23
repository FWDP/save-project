import { AuthForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";
import { requireSession } from "@/lib/supabase";
export default async function ResetPassword() {
  await requireSession();
  return (
    <AuthLayout>
      <div className="auth-card">
        <h2>A fresh start.</h2>
        <p className="muted">Choose a new password for your SAVE account.</p>
        <AuthForm recovery />
      </div>
    </AuthLayout>
  );
}
