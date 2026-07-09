import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MathText } from "@/components/math/math-text";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteQuestion } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  draft: "খসড়া",
  published: "প্রকাশিত",
  archived: "সংরক্ষিত",
};

export default async function QuestionsPage() {
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("questions")
    .select("id, body, status, source_label, topics(name_bn)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">প্রশ্ন</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/questions/import" />}
          >
            <Upload className="size-4" /> বাল্ক ইমপোর্ট
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/admin/questions/new" />}
          >
            <Plus className="size-4" /> নতুন প্রশ্ন
          </Button>
        </div>
      </div>

      <div className="divide-y rounded-lg border">
        {(questions ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            এখনো কোনো প্রশ্ন নেই।
          </p>
        )}
        {(questions ?? []).map((q) => (
          <div key={q.id} className="flex items-center gap-3 p-3">
            <Badge variant={q.status === "published" ? "default" : "secondary"}>
              {statusLabels[q.status]}
            </Badge>
            <Link
              href={`/admin/questions/${q.id}`}
              className="line-clamp-1 flex-1 font-bengali-serif hover:underline"
            >
              <MathText>{q.body}</MathText>
            </Link>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {q.topics?.name_bn}
            </span>
            <DeleteButton id={q.id} action={deleteQuestion} small />
          </div>
        ))}
      </div>
    </div>
  );
}
