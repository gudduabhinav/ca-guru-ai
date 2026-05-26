import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { TrendingUp, AlertTriangle, Award, Brain } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({ component: Analytics });

function Analytics() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", user?.id],
    queryFn: async () => {
      const [{ data: subjects }, { data: topics }, { data: progress }, { count: doubts }, { count: bookmarks }, { count: reviews }] = await Promise.all([
        supabase.from("subjects").select("id, name, level"),
        supabase.from("topics").select("id, subject_id"),
        supabase.from("user_progress").select("topic_id, status, confidence").eq("user_id", user!.id),
        supabase.from("doubts").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("question_bookmarks").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("flashcard_reviews").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);

      const topicsBySubject = new Map<string, string[]>();
      (topics ?? []).forEach(t => {
        if (!t.subject_id) return;
        const arr = topicsBySubject.get(t.subject_id) ?? [];
        arr.push(t.id);
        topicsBySubject.set(t.subject_id, arr);
      });
      const progMap = new Map((progress ?? []).map(p => [p.topic_id, p]));

      const bySubject = (subjects ?? []).map(s => {
        const tids = topicsBySubject.get(s.id) ?? [];
        const done = tids.filter(id => progMap.get(id)?.status === "completed").length;
        const inProg = tids.filter(id => progMap.get(id)?.status === "in_progress").length;
        const avgConf = tids.length
          ? Math.round(tids.reduce((s, id) => s + (progMap.get(id)?.confidence ?? 0), 0) / tids.length)
          : 0;
        return {
          name: s.name,
          level: s.level,
          total: tids.length,
          done, inProg,
          pct: tids.length ? Math.round((done / tids.length) * 100) : 0,
          confidence: avgConf,
        };
      });

      const totalDone = bySubject.reduce((s, b) => s + b.done, 0);
      const totalTopics = bySubject.reduce((s, b) => s + b.total, 0);
      const overall = totalTopics ? Math.round((totalDone / totalTopics) * 100) : 0;
      const weak = bySubject.filter(b => b.total > 0 && b.pct < 40).sort((a, b) => a.pct - b.pct).slice(0, 3);
      const strong = bySubject.filter(b => b.pct >= 70).sort((a, b) => b.pct - a.pct).slice(0, 3);

      return { bySubject, overall, weak, strong, doubts: doubts ?? 0, bookmarks: bookmarks ?? 0, reviews: reviews ?? 0 };
    },
  });

  if (isLoading || !data) return <div className="p-10 text-muted-foreground">Loading analytics…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <header>
        <p className="text-sm text-muted-foreground">Insights</p>
        <h1 className="font-display text-4xl">Your Progress Analytics</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <TrendingUp className="size-5 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Syllabus</p>
          <p className="text-3xl font-display">{data.overall}%</p>
        </Card>
        <Card className="p-5">
          <Brain className="size-5 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Doubts asked</p>
          <p className="text-3xl font-display">{data.doubts}</p>
        </Card>
        <Card className="p-5">
          <Award className="size-5 text-[var(--gold)]" />
          <p className="mt-2 text-sm text-muted-foreground">Flashcards reviewed</p>
          <p className="text-3xl font-display">{data.reviews}</p>
        </Card>
        <Card className="p-5">
          <AlertTriangle className="size-5 text-amber-500" />
          <p className="mt-2 text-sm text-muted-foreground">Bookmarked Qs</p>
          <p className="text-3xl font-display">{data.bookmarks}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-display text-2xl mb-4">Subject-wise completion</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.bySubject} margin={{ left: 0, right: 16, top: 8, bottom: 60 }}>
              <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={80} style={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} style={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
              <Bar dataKey="pct" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Completion %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-display text-xl mb-2 flex items-center gap-2"><AlertTriangle className="size-5 text-amber-500" />Weak areas</h3>
          {data.weak.length === 0 ? (
            <p className="text-sm text-muted-foreground">No weak subjects detected. Keep going!</p>
          ) : (
            <ul className="space-y-2">
              {data.weak.map(w => (
                <li key={w.name} className="flex items-center justify-between text-sm">
                  <span>{w.name} <span className="text-xs text-muted-foreground">({w.level})</span></span>
                  <span className="text-amber-500 font-semibold">{w.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-xl mb-2 flex items-center gap-2"><Award className="size-5 text-[var(--gold)]" />Your strengths</h3>
          {data.strong.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keep working — strengths will appear at 70%+ completion.</p>
          ) : (
            <ul className="space-y-2">
              {data.strong.map(s => (
                <li key={s.name} className="flex items-center justify-between text-sm">
                  <span>{s.name} <span className="text-xs text-muted-foreground">({s.level})</span></span>
                  <span className="text-emerald-500 font-semibold">{s.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
