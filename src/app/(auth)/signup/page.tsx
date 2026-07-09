"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "../actions";
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

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>নিবন্ধন করুন</CardTitle>
        <CardDescription>নতুন অ্যাকাউন্ট তৈরি করুন</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleButton />
        <div className="relative text-center text-xs text-muted-foreground">
          <span className="bg-card px-2">অথবা</span>
          <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
        </div>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">পূর্ণ নাম</Label>
            <Input id="full_name" name="full_name" type="text" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">ইমেইল</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">পাসওয়ার্ড</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={6}
              required
            />
          </div>
          {state && "error" in state && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          {state && "message" in state && (
            <p className="text-sm text-primary">{state.message}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            নিবন্ধন
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          অ্যাকাউন্ট আছে?{" "}
          <Link href="/login" className="text-primary underline">
            লগইন করুন
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
