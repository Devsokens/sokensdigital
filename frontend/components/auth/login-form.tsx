"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/50 focus:outline-none";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] [background-image:repeating-linear-gradient(45deg,var(--foreground)_0,var(--foreground)_1px,transparent_0,transparent_12px)]"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-sm"
      >
        <motion.div variants={item}>
          <Link href="/" className="inline-flex items-center gap-2">
            <Image
              src="/assets/logo-sokens-digital-white.png"
              alt="Soken's Digital"
              width={319}
              height={89}
              className="h-6 w-auto"
            />
          </Link>
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-8 text-3xl leading-[1.15] font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          Nous surveillons vos systèmes pour que vous n&apos;ayez pas à le
          faire.
        </motion.h1>

        <motion.form
          variants={item}
          onSubmit={(e) => e.preventDefault()}
          className="mt-9 space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted-foreground">Email</span>
            <input type="email" placeholder="vous@entreprise.com" className={inputClass} />
          </label>

          <label className="block">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Mot de passe</span>
              <a href="#" className="text-xs text-primary hover:underline">
                Mot de passe oublié ?
              </a>
            </div>
            <span className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>

          <Button
            type="submit"
            className="h-11 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Se connecter
          </Button>

          <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
            En vous connectant, vous acceptez nos{" "}
            <a href="#" className="text-foreground/80 hover:text-primary">
              Conditions d&apos;utilisation
            </a>{" "}
            et notre{" "}
            <a href="#" className="text-foreground/80 hover:text-primary">
              Politique de confidentialité
            </a>
            .
          </p>
        </motion.form>

        <motion.div
          variants={item}
          className="mt-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 sm:flex-row"
        >
          <span className="text-sm text-foreground/80">Pas encore client ?</span>
          <Button
            render={<Link href="/demarrer-un-projet">Démarrer un projet</Link>}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="rounded-full border-white/15 bg-transparent text-foreground hover:bg-white/5"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
