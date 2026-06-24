import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { seedDemoCompany } from "@/lib/demo.functions";

const signInSchema = z.object({
  email: z.string().trim().email("Email non valida").max(255),
  password: z.string().min(6, "Minimo 6 caratteri").max(72),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Inserisci il tuo nome").max(80),
  email: z.string().trim().email("Email non valida").max(255),
  password: z.string().min(8, "Minimo 8 caratteri").max(72),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.3l-6.2-5.2c-2 1.6-4.6 2.5-7.3 2.5-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2C41.4 35.2 44 30 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function AuthPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Hero side */}
      <div className="hidden flex-col justify-between bg-gradient-to-br from-primary/15 via-background to-background p-10 lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold">CFO AI</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Direttore Finanziario
            </div>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Il tuo CFO AI per la tua azienda.
          </h2>
          <p className="text-sm text-muted-foreground">
            Cash flow, bilanci, fiscalità, bandi e simulazioni — in un'unica piattaforma
            progettata per le PMI italiane.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Previsioni di cassa con dati confermati e stime",
              "Monitoraggio costi: energia, carburanti, telco, banche",
              "Bandi e incentivi filtrati per la tua azienda",
              "Consulente AI sempre disponibile in italiano",
            ].map((s) => (
              <li key={s} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} CFO AI — Tutte le suggerimenti AI sono bozze da approvare.
        </p>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Tabs defaultValue="sign-in" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sign-in">Accedi</TabsTrigger>
              <TabsTrigger value="sign-up">Registrati</TabsTrigger>
            </TabsList>

            <TabsContent value="sign-in" className="mt-4">
              <SignInCard />
            </TabsContent>
            <TabsContent value="sign-up" className="mt-4">
              <SignUpCard />
            </TabsContent>
          </Tabs>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              oppure
            </span>
          </div>

          <DemoButton />
          <p className="text-center text-xs text-muted-foreground">
            Nessuna registrazione richiesta — esplora con dati di esempio.
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function startDemo() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        toast.error("Impossibile avviare la prova", { description: error.message });
        return;
      }
      // Seed dati demo (idempotente)
      try {
        await seedDemoCompany();
      } catch (err) {
        console.warn("[demo] seed failed", err);
      }
      toast.success("Modalità prova attivata", {
        description: "Stai esplorando con dati di esempio.",
      });
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      onClick={startDemo}
      disabled={busy}
    >
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Prova senza registrarti
    </Button>
  );
}

function GoogleButton({ disabled, label }: { disabled?: boolean; label: string }) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handle() {
    try {
      setBusy(true);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Accesso con Google fallito", { description: result.error.message });
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error("Errore", { description: err instanceof Error ? err.message : "Imprevisto" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handle}
      disabled={busy || disabled}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
      <span className="ml-2">{label}</span>
    </Button>
  );
}

function SignInCard() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof signInSchema>) {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);
    if (error) {
      toast.error("Accesso fallito", { description: error.message });
      return;
    }
    toast.success("Bentornato!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accedi al tuo account</CardTitle>
        <CardDescription>Inserisci le credenziali per continuare.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleButton label="Accedi con Google" disabled={submitting} />
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            oppure
          </span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="nome@azienda.it" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accedi
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function SignUpCard() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof signUpSchema>) {
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: values.fullName },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Registrazione fallita", { description: error.message });
      return;
    }
    toast.success("Account creato!", {
      description: "Controlla la tua email per confermare e accedere.",
    });
    // Se la conferma email è disabilitata, l'utente è già loggato
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea il tuo account</CardTitle>
        <CardDescription>Inizia a usare CFO AI in meno di 2 minuti.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleButton label="Registrati con Google" disabled={submitting} />
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            oppure
          </span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome e cognome</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" placeholder="Mario Rossi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email aziendale</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" placeholder="nome@azienda.it" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea account
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
