
-- Study Plans
CREATE TABLE public.study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam_date date NOT NULL,
  daily_hours integer NOT NULL DEFAULT 4,
  level text NOT NULL DEFAULT 'Foundation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plans select" ON public.study_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own plans insert" ON public.study_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own plans update" ON public.study_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own plans delete" ON public.study_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_study_plans_updated BEFORE UPDATE ON public.study_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Flashcards (shared, teacher-managed; students can also create their own)
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid,
  front text NOT NULL,
  back text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view flashcards" ON public.flashcards FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth create flashcards" ON public.flashcards FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "owner update flashcards" ON public.flashcards FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "owner delete flashcards" ON public.flashcards FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "teachers manage flashcards" ON public.flashcards FOR ALL TO authenticated
  USING (has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- Flashcard reviews (spaced repetition state per user)
CREATE TABLE public.flashcard_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flashcard_id uuid NOT NULL,
  ease integer NOT NULL DEFAULT 2,
  interval_days integer NOT NULL DEFAULT 1,
  next_review date NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed timestamptz,
  reviews_count integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, flashcard_id)
);
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reviews select" ON public.flashcard_reviews FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "own reviews insert" ON public.flashcard_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own reviews update" ON public.flashcard_reviews FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "own reviews delete" ON public.flashcard_reviews FOR DELETE TO authenticated USING (auth.uid()=user_id);

-- Bookmarks for past questions (for last-minute revision)
CREATE TABLE public.question_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  difficulty_mark text DEFAULT 'review',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
ALTER TABLE public.question_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bm select" ON public.question_bookmarks FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "own bm insert" ON public.question_bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own bm update" ON public.question_bookmarks FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "own bm delete" ON public.question_bookmarks FOR DELETE TO authenticated USING (auth.uid()=user_id);
