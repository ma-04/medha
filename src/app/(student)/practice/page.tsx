import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export default async function PracticePage() {
  const supabase = await createClient();
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name_bn, name_en, slug, topics(id)")
    .order("order_index");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">অনুশীলন</h1>
        <p className="text-muted-foreground">বিষয় বেছে টপিকভিত্তিক অনুশীলন করুন</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(subjects ?? []).map((s) => (
          <Link key={s.id} href={`/practice/${s.slug}`}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex h-full flex-col justify-between gap-2 p-4">
                <span className="font-bengali-serif text-lg font-medium">
                  {s.name_bn}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.topics?.length ?? 0} টপিক
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
