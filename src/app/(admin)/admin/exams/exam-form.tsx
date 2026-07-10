"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type ExamInput } from "@/lib/exams";
import { saveExam, saveExamAndRedirect } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Base UI's <Select.Value> renders the raw value unless the root is given an
// `items` map — without it the triggers read "model" / "published".
const TYPE_ITEMS: Record<string, string> = {
  model: "মডেল টেস্ট",
  live: "লাইভ পরীক্ষা",
};
const STATUS_ITEMS: Record<string, string> = {
  draft: "খসড়া",
  scheduled: "নির্ধারিত",
  published: "প্রকাশিত",
  archived: "সংরক্ষিত",
};

// datetime-local <-> ISO helpers (input has no timezone; treat as local time).
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
function fromLocalInput(v: string) {
  return v ? new Date(v).toISOString() : null;
}

export function ExamForm({ initial }: { initial?: ExamInput }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [titleBn, setTitleBn] = useState(initial?.title_bn ?? "");
  const [titleEn, setTitleEn] = useState(initial?.title_en ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<ExamInput["type"]>(initial?.type ?? "model");
  const [duration, setDuration] = useState(
    String(initial?.duration_minutes ?? 30)
  );
  const [negMark, setNegMark] = useState(String(initial?.negative_mark ?? 0.25));
  const [markPer, setMarkPer] = useState(
    String(initial?.mark_per_question ?? 1)
  );
  const [maxAttempts, setMaxAttempts] = useState(
    String(initial?.max_attempts ?? 1)
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.ends_at));
  const [status, setStatus] = useState<ExamInput["status"]>(
    initial?.status ?? "draft"
  );

  function build(): ExamInput {
    return {
      id: initial?.id ?? null,
      title_bn: titleBn,
      title_en: titleEn,
      description: description || null,
      type,
      duration_minutes: Number(duration),
      negative_mark: Number(negMark),
      mark_per_question: Number(markPer),
      starts_at: type === "live" ? fromLocalInput(startsAt) : null,
      ends_at: type === "live" ? fromLocalInput(endsAt) : null,
      status,
      max_attempts: type === "model" ? Number(maxAttempts) : 1,
    };
  }

  function submit() {
    startTransition(async () => {
      const input = build();
      if (initial?.id) {
        const result = await saveExam(input);
        if (result.error) toast.error(result.error);
        else {
          toast.success("সংরক্ষিত হয়েছে");
          router.refresh();
        }
      } else {
        const result = await saveExamAndRedirect(input);
        if (result?.error) toast.error(result.error);
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>শিরোনাম (বাংলা)</Label>
          <Input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Title (English)</Label>
          <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>বিবরণ (ঐচ্ছিক)</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border bg-transparent p-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>ধরন</Label>
          <Select
            items={TYPE_ITEMS}
            value={type}
            onValueChange={(v) => setType((v as ExamInput["type"]) ?? "model")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>সময় (মিনিট)</Label>
          <Input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>প্রতি প্রশ্নের নম্বর</Label>
          <Input
            type="number"
            step="0.5"
            value={markPer}
            onChange={(e) => setMarkPer(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>নেগেটিভ মার্ক</Label>
          <Input
            type="number"
            step="0.25"
            value={negMark}
            onChange={(e) => setNegMark(e.target.value)}
          />
        </div>
      </div>

      {type === "model" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>সর্বোচ্চ অ্যাটেম্পট সংখ্যা</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              ১ = একবারই দেওয়া যাবে। বেশি দিলে শিক্ষার্থী পুনরায় দিতে পারবে।
            </p>
          </div>
        </div>
      )}

      {type === "live" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>শুরুর সময়</Label>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>শেষ সময়</Label>
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Select
          items={STATUS_ITEMS}
          value={status}
          onValueChange={(v) => setStatus((v as ExamInput["status"]) ?? "draft")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={submit} disabled={pending || !titleBn || !titleEn}>
          {initial?.id ? "আপডেট" : "তৈরি করুন"}
        </Button>
      </div>
    </div>
  );
}
