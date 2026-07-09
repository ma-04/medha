"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "../actions";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, null);
  const next = useSearchParams().get("next") ?? "/";

  return (
    <Card>
      <CardHeader>
        <CardTitle>লগইন করুন</CardTitle>
        <CardDescription>আপনার অ্যাকাউন্টে প্রবেশ করুন</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleButton />
        <div className="relative text-center text-xs text-muted-foreground">
          <span className="bg-card px-2">অথবা</span>
          <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
        </div>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <Label htmlFor="email">ইমেইল</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">পাসওয়ার্ড</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state && "error" in state && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            লগইন
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          অ্যাকাউন্ট নেই?{" "}
          <Link href="/signup" className="text-primary underline">
            নিবন্ধন করুন
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
