"use client";

import { useActionState, useRef, useEffect } from "react";
import { createSubject, createTopic, type ActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initial: ActionResult = {};

export function SubjectForm() {
  const [state, action, pending] = useActionState(createSubject, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form
      ref={ref}
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
    >
      <Field label="নাম (বাংলা)" name="name_bn" placeholder="বাংলা" />
      <Field label="Name (English)" name="name_en" placeholder="Bangla" />
      <Field label="Slug" name="slug" placeholder="bangla" />
      <Field label="ক্রম" name="order_index" type="number" className="w-20" />
      <Button type="submit" disabled={pending}>
        বিষয় যোগ
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function TopicForm({
  subjects,
}: {
  subjects: { id: string; name_bn: string }[];
}) {
  const [state, action, pending] = useActionState(createTopic, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form
      ref={ref}
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">বিষয়</label>
        <Select name="subject_id" required>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="বিষয় বাছুন" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name_bn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Field label="নাম (বাংলা)" name="name_bn" placeholder="ব্যাকরণ" />
      <Field label="Name (English)" name="name_en" placeholder="Grammar" />
      <Field label="Slug" name="slug" placeholder="grammar" />
      <Field label="ক্রম" name="order_index" type="number" className="w-20" />
      <Button type="submit" disabled={pending}>
        টপিক যোগ
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  className = "w-36",
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={type === "number" ? 0 : undefined}
        required={name !== "order_index"}
        className={className}
      />
    </div>
  );
}
