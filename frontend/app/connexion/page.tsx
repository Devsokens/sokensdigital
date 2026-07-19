import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";

export const metadata: Metadata = {
  title: "Connexion — Soken's Digital",
  description: "Accédez à votre espace client Soken's Digital.",
};

export default function ConnexionPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-2">
      <LoginForm />
      <div className="p-3">
        <AuthVisualPanel />
      </div>
    </div>
  );
}
