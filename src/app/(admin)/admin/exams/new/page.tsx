import Link from "next/link";
import { ExamForm } from "../exam-form";

export default function NewExamPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/exams"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← পরীক্ষা
        </Link>
        <h1 className="mt-1 text-2xl font-bold">নতুন পরীক্ষা</h1>
      </div>
      <ExamForm />
    </div>
  );
}
