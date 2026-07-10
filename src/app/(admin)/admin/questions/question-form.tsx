"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { optionKeys, type QuestionInput } from "@/lib/questions";
import { saveQuestion } from "./actions";
import { MathText } from "@/components/math/math-text";
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

type SubjectOption = {
  id: string;
  name_bn: string;
  topics: { id: string; name_bn: string }[];
};

// Base UI's <Select.Value> renders the raw value unless the root is given an
// `items` map — without it the triggers read "1" / "published" / a topic UUID.
const DIFFICULTY_ITEMS: Record<string, string> = {
  "1": "সহজ",
  "2": "মাঝারি",
  "3": "কঠিন",
};
const STATUS_ITEMS: Record<string, string> = {
  draft: "খসড়া",
  published: "প্রকাশিত",
  archived: "সংরক্ষিত",
};

export function QuestionForm({
  subjects,
  initial,
}: {
  subjects: SubjectOption[];
  initial?: QuestionInput;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [topicId, setTopicId] = useState(initial?.topic_id ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [options, setOptions] = useState(
    initial?.options ?? [
      { key: "a" as const, text: "" },
      { key: "b" as const, text: "" },
      { key: "c" as const, text: "" },
      { key: "d" as const, text: "" },
    ]
  );
  const [correctKey, setCorrectKey] = useState(initial?.correct_key ?? "a");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [difficulty, setDifficulty] = useState(
    initial?.difficulty ? String(initial.difficulty) : ""
  );
  const [sourceExam, setSourceExam] = useState(initial?.source_exam ?? "");
  const [sourceYear, setSourceYear] = useState(
    initial?.source_year ? String(initial.source_year) : ""
  );
  const [sourceLabel, setSourceLabel] = useState(initial?.source_label ?? "");
  const [status, setStatus] = useState<QuestionInput["status"]>(
    initial?.status ?? "draft"
  );
  const [uploading, setUploading] = useState(false);

  const topicItems: Record<string, string> = Object.fromEntries(
    subjects.flatMap((s) => s.topics.map((t) => [t.id, t.name_bn]))
  );

  function setOptionText(i: number, text: string) {
    setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, text } : o)));
  }

  function addOption() {
    if (options.length >= 5) return;
    setOptions((prev) => [
      ...prev,
      { key: optionKeys[prev.length], text: "" },
    ]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) =>
      prev
        .filter((_, j) => j !== i)
        .map((o, j) => ({ ...o, key: optionKeys[j] }))
    );
    setCorrectKey((k) => (k === options[i].key ? "a" : k));
  }

  async function handleImage(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("question-images")
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage
        .from("question-images")
        .getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("ছবি আপলোড হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "আপলোড ব্যর্থ");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const input: QuestionInput = {
      id: initial?.id ?? null,
      topic_id: topicId,
      body,
      options,
      correct_key: correctKey,
      explanation: explanation || null,
      image_url: imageUrl || null,
      difficulty: difficulty ? Number(difficulty) : null,
      source_exam: sourceExam || null,
      source_year: sourceYear ? Number(sourceYear) : null,
      source_label: sourceLabel || null,
      status,
    };
    startTransition(async () => {
      const result = await saveQuestion(input);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("প্রশ্ন সংরক্ষিত হয়েছে");
        router.push("/admin/questions");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>টপিক</Label>
          <Select
            items={topicItems}
            value={topicId}
            onValueChange={(v) => setTopicId(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="টপিক বাছুন" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <div key={s.id}>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {s.name_bn}
                  </div>
                  {s.topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name_bn}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>প্রশ্ন (LaTeX: $x^2$)</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full rounded-md border bg-transparent p-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>অপশন (সঠিকটি বাছুন)</Label>
          {options.map((opt, i) => (
            <div key={opt.key} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={correctKey === opt.key}
                onChange={() => setCorrectKey(opt.key)}
                aria-label={`option ${opt.key} correct`}
              />
              <span className="w-4 text-sm uppercase text-muted-foreground">
                {opt.key}
              </span>
              <Input
                value={opt.text}
                onChange={(e) => setOptionText(i, e.target.value)}
                placeholder={`অপশন ${opt.key}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeOption(i)}
                disabled={options.length <= 2}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          {options.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="size-4" /> অপশন যোগ
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label>ব্যাখ্যা (ঐচ্ছিক)</Label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            className="w-full rounded-md border bg-transparent p-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>ছবি (ঐচ্ছিক)</Label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              id="qimg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImage(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => document.getElementById("qimg")?.click()}
            >
              <Upload className="size-4" />
              {uploading ? "আপলোড হচ্ছে…" : "আপলোড"}
            </Button>
            {imageUrl && (
              <span className="truncate text-xs text-muted-foreground">
                {imageUrl.split("/").pop()}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <Label>পরীক্ষা</Label>
            <Input
              value={sourceExam}
              onChange={(e) => setSourceExam(e.target.value)}
              placeholder="BCS"
            />
          </div>
          <div className="space-y-2">
            <Label>সাল</Label>
            <Input
              type="number"
              value={sourceYear}
              onChange={(e) => setSourceYear(e.target.value)}
              placeholder="2024"
            />
          </div>
          <div className="space-y-2">
            <Label>কঠিনতা</Label>
            <Select
              items={DIFFICULTY_ITEMS}
              value={difficulty}
              onValueChange={(v) => setDifficulty(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DIFFICULTY_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>উৎস লেবেল (ঐচ্ছিক)</Label>
          <Input
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="৪৬তম বিসিএস প্রিলিমিনারি"
          />
        </div>

        <div className="flex items-center gap-3">
          <Select
            items={STATUS_ITEMS}
            value={status}
            onValueChange={(v) => setStatus(v as QuestionInput["status"])}
          >
            <SelectTrigger className="w-40">
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
          <Button onClick={submit} disabled={pending || !topicId || !body}>
            সংরক্ষণ
          </Button>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-semibold text-muted-foreground">প্রিভিউ</p>
        {imageUrl && (
          // Question images are user-supplied and have unknown intrinsic dimensions;
          // next/image would need an explicit width/height or a sized parent.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="max-h-48 rounded" />
        )}
        <div className="font-bengali-serif text-lg">
          {body ? <MathText>{body}</MathText> : "…"}
        </div>
        <ul className="space-y-1">
          {options.map((opt) => (
            <li
              key={opt.key}
              className={`rounded-md border p-2 text-sm ${
                correctKey === opt.key
                  ? "border-primary bg-primary/10"
                  : ""
              }`}
            >
              <span className="mr-2 uppercase text-muted-foreground">
                {opt.key}.
              </span>
              {opt.text ? <MathText>{opt.text}</MathText> : "…"}
            </li>
          ))}
        </ul>
        {explanation && (
          <div className="rounded-md bg-background p-2 text-sm">
            <span className="font-semibold">ব্যাখ্যা: </span>
            <MathText>{explanation}</MathText>
          </div>
        )}
      </div>
    </div>
  );
}
