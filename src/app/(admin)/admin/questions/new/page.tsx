import { getSubjectsWithTopics } from "@/lib/queries/taxonomy";
import { QuestionForm } from "../question-form";

export default async function NewQuestionPage() {
  const subjects = await getSubjectsWithTopics();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">নতুন প্রশ্ন</h1>
      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          প্রথমে বিষয় ও টপিক যোগ করুন।
        </p>
      ) : (
        <QuestionForm subjects={subjects} />
      )}
    </div>
  );
}
