import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { RotateCw, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/flashcards")({ component: Flashcards });

type Card = { id: string; front: string; back: string; subject_id: string | null };

function Flashcards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [flipped, setFlipped] = useState(false);
  const [idx, setIdx] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["flashcard-deck", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: cards }, { data: reviews }] = await Promise.all([
        supabase.from("flashcards").select("id, front, back, subject_id"),
        supabase.from("flashcard_reviews").select("flashcard_id, next_review, ease, interval_days").eq("user_id", user!.id),
      ]);
      const byId = new Map((reviews ?? []).map(r => [r.flashcard_id, r]));
      // Due cards: never reviewed OR next_review <= today
      const due = (cards ?? []).filter(c => {
        const r = byId.get(c.id);
        return !r || r.next_review <= today;
      });
      return { all: cards ?? [], due: due as Card[], total: (cards ?? []).length };
    },
  });

  const due = data?.due ?? [];
  const current = due[idx];

  async function review(grade: "again" | "good" | "easy") {
    if (!current) return;
    const { data: existing } = await supabase
      .from("flashcard_reviews").select("*")
      .eq("user_id", user!.id).eq("flashcard_id", current.id).maybeSingle();

    let ease = existing?.ease ?? 2;
    let interval = existing?.interval_days ?? 1;
    if (grade === "again") { ease = Math.max(1, ease - 1); interval = 1; }
    else if (grade === "good") { interval = Math.max(1, Math.round(interval * Math.max(1.6, ease * 0.9))); }
    else { ease = ease + 1; interval = Math.max(2, Math.round(interval * ease)); }

    const next = new Date(Date.now() + interval * 86400000).toISOString().slice(0, 10);
    const payload = {
      user_id: user!.id,
      flashcard_id: current.id,
      ease, interval_days: interval, next_review: next,
      last_reviewed: new Date().toISOString(),
      reviews_count: (existing?.reviews_count ?? 0) + 1,
    };
    if (existing) await supabase.from("flashcard_reviews").update(payload).eq("id", existing.id);
    else await supabase.from("flashcard_reviews").insert(payload);

    setFlipped(false);
    if (idx + 1 >= due.length) {
      toast.success("Session complete! 🔥");
      qc.invalidateQueries({ queryKey: ["flashcard-deck"] });
      setIdx(0);
    } else {
      setIdx(idx + 1);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 md:p-10">
      <header>
        <p className="text-sm text-muted-foreground">Quick Revision</p>
        <h1 className="font-display text-4xl">Flashcards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${due.length} due today • ${data?.total ?? 0} total`}
        </p>
      </header>

      {!isLoading && due.length === 0 && (
        <Card className="p-8 text-center">
          <Sparkles className="mx-auto size-8 text-[var(--gold)]" />
          <p className="mt-3 text-lg">You're all caught up!</p>
          <p className="text-sm text-muted-foreground">New cards will appear here as their review interval comes due.</p>
        </Card>
      )}

      {current && (
        <>
          <Card
            onClick={() => setFlipped(f => !f)}
            className="relative min-h-[280px] cursor-pointer p-8 flex items-center justify-center text-center select-none transition hover:shadow-lg"
          >
            <p className="text-xs absolute top-3 right-3 text-muted-foreground">{idx + 1}/{due.length}</p>
            {!flipped ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Question</p>
                <p className="font-display text-2xl">{current.front}</p>
                <p className="mt-6 text-xs text-muted-foreground"><RotateCw className="inline size-3" /> Tap to flip</p>
              </div>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--gold)] mb-3">Answer</p>
                <p className="text-xl whitespace-pre-wrap">{current.back}</p>
              </div>
            )}
          </Card>

          {flipped && (
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" onClick={() => review("again")} className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10">
                <ThumbsDown className="mr-1 size-4" />Again
              </Button>
              <Button variant="outline" onClick={() => review("good")}>
                Good
              </Button>
              <Button onClick={() => review("easy")}>
                <ThumbsUp className="mr-1 size-4" />Easy
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
