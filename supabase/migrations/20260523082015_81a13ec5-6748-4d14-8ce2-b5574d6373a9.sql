CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.formula_sheets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.formula_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view formula sheets"
ON public.formula_sheets
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Teachers manage formula sheets"
ON public.formula_sheets
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update their own formula sheets"
ON public.formula_sheets
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own formula sheets"
ON public.formula_sheets
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

CREATE TRIGGER update_formula_sheets_updated_at
BEFORE UPDATE ON public.formula_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
