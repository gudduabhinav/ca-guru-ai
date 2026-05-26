import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, BookmarkX, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/revision")({ component: Revision });

function Revision() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["revision-pack", user?.id],
    queryFn: async () => {
      const [{ data: bookmarks }, { data: formulas }, { data: weakProgress }] = await Promise.all([
        supabase.from("question_bookmarks").select("question_id, created_at").eq("user_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("formula_sheets").select("id, title, subject_id, subjects(name, level)").order("title"),
        supabase.from("user_progress").select("topic_id, confidence, topics(title, subject_id, subjects(name))").eq("user_id", user!.id).lte("confidence", 2),
      ]);

      let questions: Array<{ id: string; question_text: string; exam_month: string; exam_year: number; marks: number | null; subject_id: string | null }> = [];
      if (bookmarks && bookmarks.length) {
        const ids = bookmarks.map(b => b.question_id);
        const { data: qs } = await supabase
          .from("past_questions")
          .select("id, question_text, exam_month, exam_year, marks, subject_id")
          .in("id", ids);
        questions = qs ?? [];
      }
      return { questions, formulas: formulas ?? [], weak: weakProgress ?? [] };
    },
  });

  async function removeBookmark(qid: string) {
    await supabase.from("question_bookmarks").delete().eq("user_id", user!.id).eq("question_id", qid);
    // refetch via cache key
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="flex items-center gap-3">
        <Zap className="size-7 text-[var(--gold)]" />
        <div>
          <p className="text-sm text-muted-foreground">Last-minute mode</p>
          <h1 className="font-display text-4xl">Revision Pack</h1>
        </div>
      </header>

      <Card className="p-6">
        <h2 className="font-display text-2xl mb-3 flex items-center gap-2"><FileText className="size-5" />Formula sheets</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : data!.formulas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No formula sheets yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {data!.formulas.map((f) => {
              type Sub = { name?: string; level?: string } | null;
              const sub = (f.subjects as unknown) as Sub;
              return (
                <Link key={f.id} to="/syllabus" className="rounded-lg border border-border p-3 text-sm hover:bg-muted">
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{sub?.name} • {sub?.level}</p>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-2xl mb-3">Bookmarked questions ({data?.questions.length ?? 0})</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : data!.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bookmarks yet. Open <Link to="/past-questions" className="text-primary underline">Past Questions</Link> and bookmark tough ones.
          </p>
        ) : (
          <div className="space-y-3">
            {data!.questions.map((q) => (
              <div key={q.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2 text-xs">
                      <Badge variant="secondary">{q.exam_month} {q.exam_year}</Badge>
                      {q.marks && <Badge variant="outline">{q.marks} marks</Badge>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{q.question_text}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeBookmark(q.id)}>
                    <BookmarkX className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-2xl mb-3">Low confidence topics</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : data!.weak.length === 0 ? (
          <p className="text-sm text-muted-foreground">No low-confidence topics. Mark confidence in the syllabus to see them here.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data!.weak.map((w, i) => {
              type T = { title?: string; subjects?: { name?: string } | null } | null;
              const t = (w.topics as unknown) as T;
              return (
                <li key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>{t?.title} <span className="text-xs text-muted-foreground">• {t?.subjects?.name}</span></span>
                  <Badge variant="outline" className="text-amber-500">Conf {w.confidence}/5</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
