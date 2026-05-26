import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Target, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planner")({ component: Planner });

function Planner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [examDate, setExamDate] = useState("");
  const [hours, setHours] = useState(4);

  const { data: plan } = useQuery({
    queryKey: ["study-plan", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("study_plans").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: topicsData } = useQuery({
    queryKey: ["planner-topics", user?.id],
    queryFn: async () => {
      const [{ data: topics }, { data: progress }] = await Promise.all([
        supabase.from("topics").select("id, title, estimated_hours, subject_id, subjects(name, level)"),
        supabase.from("user_progress").select("topic_id, status").eq("user_id", user!.id),
      ]);
      return { topics: topics ?? [], progress: progress ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!examDate) throw new Error("Pick an exam date");
      const payload = { user_id: user!.id, exam_date: examDate, daily_hours: hours, level: "Foundation" };
      if (plan) {
        const { error } = await supabase.from("study_plans").update(payload).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("study_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["study-plan"] }); toast.success("Plan saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = plan ?? { exam_date: examDate, daily_hours: hours };
  const daysLeft = active.exam_date
    ? Math.max(0, Math.ceil((new Date(active.exam_date).getTime() - Date.now()) / 86400000))
    : 0;

  const doneIds = new Set((topicsData?.progress ?? []).filter(p => p.status === "completed").map(p => p.topic_id));
  const pending = (topicsData?.topics ?? []).filter(t => !doneIds.has(t.id));
  const totalHours = pending.reduce((s, t) => s + (t.estimated_hours ?? 2), 0);
  const totalDone = (topicsData?.topics?.length ?? 0) - pending.length;
  const totalAll = topicsData?.topics?.length ?? 0;
  const completionPct = totalAll ? Math.round((totalDone / totalAll) * 100) : 0;
  const dailyTopics = Math.max(1, Math.ceil(pending.length / Math.max(daysLeft, 1)));
  const requiredDaily = daysLeft ? +(totalHours / daysLeft).toFixed(1) : totalHours;
  const onTrack = requiredDaily <= active.daily_hours;

  // Build a 7-day schedule
  const schedule: { date: string; topics: typeof pending }[] = [];
  let idx = 0;
  for (let d = 0; d < Math.min(7, daysLeft || 7); d++) {
    const date = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
    schedule.push({ date, topics: pending.slice(idx, idx + dailyTopics) });
    idx += dailyTopics;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header>
        <p className="text-sm text-muted-foreground">Smart Planner</p>
        <h1 className="font-display text-4xl">Your exam-ready schedule</h1>
      </header>

      <Card className="p-6">
        <h2 className="font-display text-2xl mb-4">Set your goal</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Exam date</Label>
            <Input type="date" value={examDate || plan?.exam_date || ""} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <div>
            <Label>Daily study hours</Label>
            <Input type="number" min={1} max={16} value={hours} onChange={(e) => setHours(+e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
              {plan ? "Update plan" : "Create plan"}
            </Button>
          </div>
        </div>
      </Card>

      {plan && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-6">
              <CalendarDays className="size-5 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Days left</p>
              <p className="text-3xl font-display">{daysLeft}</p>
            </Card>
            <Card className="p-6">
              <Target className="size-5 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Syllabus completed</p>
              <p className="text-3xl font-display">{completionPct}%</p>
              <Progress className="mt-2" value={completionPct} />
            </Card>
            <Card className="p-6">
              <Clock className="size-5 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Required daily</p>
              <p className="text-3xl font-display">{requiredDaily}h</p>
              <p className={`mt-1 text-xs ${onTrack ? "text-emerald-500" : "text-amber-500"}`}>
                {onTrack ? "✓ On track" : `Increase to ${Math.ceil(requiredDaily)}h/day`}
              </p>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="font-display text-2xl mb-4">Next 7 days</h2>
            {schedule.length === 0 || pending.length === 0 ? (
              <p className="text-muted-foreground">All topics complete. 🎉</p>
            ) : (
              <div className="space-y-3">
                {schedule.map((d) => (
                  <div key={d.date} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold">
                      {new Date(d.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {d.topics.length === 0 ? <li>Rest / Revision</li> :
                        d.topics.map((t) => (
                          <li key={t.id}>
                            • {t.title} <span className="text-xs">({t.estimated_hours ?? 2}h)</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
