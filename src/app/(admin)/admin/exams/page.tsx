import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteExam } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { examStatusLabels, examTypeLabels } from "@/lib/exams";

export default async function AdminExamsPage() {
  const supabase = await createClient();
  const { data: exams } = await supabase
    .from("exams")
    .select("id, title_bn, type, status, pattern, starts_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">পরীক্ষা</h1>
        <Button nativeButton={false} render={<Link href="/admin/exams/new" />}>
          <Plus className="size-4" /> নতুন পরীক্ষা
        </Button>
      </div>

      <div className="divide-y rounded-lg border">
        {(exams ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            এখনো কোনো পরীক্ষা নেই।
          </p>
        )}
        {(exams ?? []).map((e) => {
          const pattern = e.pattern as { total_questions?: number } | null;
          return (
            <div key={e.id} className="flex items-center gap-3 p-3">
              <Badge variant={e.status === "published" ? "default" : "secondary"}>
                {examStatusLabels[e.status]}
              </Badge>
              <Badge variant="outline">{examTypeLabels[e.type]}</Badge>
              <Link
                href={`/admin/exams/${e.id}`}
                className="line-clamp-1 flex-1 font-bengali-serif hover:underline"
              >
                {e.title_bn}
              </Link>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {pattern?.total_questions ?? 0} প্রশ্ন
              </span>
              <DeleteButton id={e.id} action={deleteExam} small />
            </div>
          );
        })}
      </div>
    </div>
  );
}
