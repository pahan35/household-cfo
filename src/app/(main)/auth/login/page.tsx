import { AlertCircle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { siGoogle } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign In - Family Budget",
  description: "Sign in with your authorized Google account to access Family Budget.",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
};

export default async function LoginPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const returnTo = searchParams.returnTo;
  const error = searchParams.error;

  const loginApiUrl = `/api/auth/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  let errorMessage: string | null = null;
  if (error === "access_denied") {
    errorMessage = "Sign in was cancelled.";
  } else if (error === "state_mismatch" || error === "invalid_state") {
    errorMessage = "Session expired or state mismatch. Please try signing in again.";
  } else if (error) {
    errorMessage = "Authentication failed. Please verify your credentials and try again.";
  }

  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center p-4">
      <Card className="border-border w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 pb-6 text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-2 flex size-12 items-center justify-center rounded-xl">
            <ShieldCheck className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Family Budget</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Private family financial dashboard. Sign in with your authorized Google account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="bg-destructive/10 border-destructive/20 text-destructive flex items-center gap-2 rounded-lg border p-3 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Button asChild size="lg" className="h-11 w-full gap-2.5 text-sm font-medium">
            <a href={loginApiUrl}>
              <SimpleIcon icon={siGoogle} className="size-4" />
              Continue with Google
            </a>
          </Button>

          <p className="text-muted-foreground/80 pt-2 text-center text-xs">
            Access is restricted to authorized family members.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
