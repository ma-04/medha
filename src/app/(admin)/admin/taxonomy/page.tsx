import { createClient } from "@/lib/supabase/server";
import { SubjectForm, TopicForm } from "./taxonomy-forms";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteSubject, deleteTopic } from "./actions";

export default async function TaxonomyPage() {
  const supabase = await createClient();
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name_bn, name_en, slug, order_index")
    .order("order_index");
  const { data: topics } = await supabase
    .from("topics")
    .select("id, name_bn, subject_id, slug, order_index")
    .order("order_index");

  const subjectList = subjects ?? [];
  const topicsBySubject = new Map<string, typeof topics>();
  for (const topic of topics ?? []) {
    const arr = topicsBySubject.get(topic.subject_id) ?? [];
    arr.push(topic);
    topicsBySubject.set(topic.subject_id, arr);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">বিষয় ও টপিক</h1>
        <p className="text-muted-foreground">প্রশ্নের বিষয় ও টপিক পরিচালনা করুন</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">নতুন বিষয়</h2>
        <SubjectForm />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">নতুন টপিক</h2>
        <TopicForm subjects={subjectList} />
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">বিষয় তালিকা</h2>
        {subjectList.length === 0 && (
          <p className="text-sm text-muted-foreground">এখনো কোনো বিষয় নেই।</p>
        )}
        {subjectList.map((subject) => (
          <div key={subject.id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{subject.name_bn}</span>{" "}
                <span className="text-sm text-muted-foreground">
                  {subject.name_en} · {subject.slug}
                </span>
              </div>
              <DeleteButton
                id={subject.id}
                action={deleteSubject}
                confirmText="এই বিষয় ও এর সব টপিক মুছে ফেলা হবে?"
              />
            </div>
            <ul className="mt-3 space-y-1 pl-4">
              {(topicsBySubject.get(subject.id) ?? []).map((topic) => (
                <li
                  key={topic.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {topic.name_bn}{" "}
                    <span className="text-muted-foreground">
                      · {topic.slug}
                    </span>
                  </span>
                  <DeleteButton
                    id={topic.id}
                    action={deleteTopic}
                    confirmText="টপিক মুছবেন?"
                    small
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
