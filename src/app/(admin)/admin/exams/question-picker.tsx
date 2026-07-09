"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { MathText } from "@/components/math/math-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setExamQuestions } from "./actions";

export type PickableQuestion = {
  id: string;
  body: string;
  subject_bn: string;
  topic_bn: string;
};

export function QuestionPicker({
  examId,
  pool,
  initialSelectedIds,
}: {
  examId: string;
  pool: PickableQuestion[];
  initialSelectedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [filter, setFilter] = useState("");

  const byId = useMemo(
    () => new Map(pool.map((q) => [q.id, q])),
    [pool]
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const available = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return pool.filter(
      (q) =>
        !selectedSet.has(q.id) &&
        (!f ||
          q.body.toLowerCase().includes(f) ||
          q.subject_bn.toLowerCase().includes(f) ||
          q.topic_bn.toLowerCase().includes(f))
    );
  }, [pool, selectedSet, filter]);

  function add(id: string) {
    setSelectedIds((prev) => [...prev, id]);
  }
  function remove(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }
  function move(i: number, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await setExamQuestions(examId, selectedIds);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`${selectedIds.length} প্রশ্ন যুক্ত হয়েছে`);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Selected, ordered */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            নির্বাচিত ({selectedIds.length})
          </p>
          <Button size="sm" onClick={save} disabled={pending}>
            সংরক্ষণ
          </Button>
        </div>
        <div className="divide-y rounded-lg border">
          {selectedIds.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              ডান পাশ থেকে প্রশ্ন যোগ করুন।
            </p>
          )}
          {selectedIds.map((id, i) => {
            const q = byId.get(id);
            if (!q) return null;
            return (
              <div key={id} className="flex items-center gap-2 p-2">
                <span className="w-6 text-xs text-muted-foreground">
                  {i + 1}.
                </span>
                <span className="line-clamp-1 flex-1 font-bengali-serif text-sm">
                  <MathText>{q.body}</MathText>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(i, 1)}
                  disabled={i === selectedIds.length - 1}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(id)}
                >
                  <X className="size-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available pool */}
      <div className="space-y-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="প্রশ্ন / বিষয় / টপিক খুঁজুন…"
        />
        <div className="max-h-[28rem] divide-y overflow-y-auto rounded-lg border">
          {available.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              কোনো প্রশ্ন নেই।
            </p>
          )}
          {available.slice(0, 100).map((q) => (
            <div key={q.id} className="flex items-center gap-2 p-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => add(q.id)}
              >
                <Plus className="size-4 text-primary" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-bengali-serif text-sm">
                  <MathText>{q.body}</MathText>
                </p>
                <p className="text-xs text-muted-foreground">
                  {q.subject_bn} · {q.topic_bn}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
