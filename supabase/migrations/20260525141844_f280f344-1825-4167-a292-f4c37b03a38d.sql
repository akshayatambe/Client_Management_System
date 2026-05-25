
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'sales');

-- Deal stage enum
CREATE TYPE public.deal_stage AS ENUM ('prospect', 'negotiation', 'won', 'lost');

-- Lead status enum
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'unqualified');

-- Activity type enum
CREATE TYPE public.activity_type AS ENUM ('call', 'meeting', 'note', 'follow_up');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT,
  status public.lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_owner ON public.leads(owner_id);
CREATE INDEX idx_leads_status ON public.leads(status);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Deals
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  stage public.deal_stage NOT NULL DEFAULT 'prospect',
  expected_close_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_owner ON public.deals(owner_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Activities
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  type public.activity_type NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_owner ON public.activities(owner_id);
CREATE INDEX idx_activities_due ON public.activities(due_date);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_activities_updated BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default sales role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'sales');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- profiles: users can view all profiles (needed to display owner names), only update own; admins can update all
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: users can view own roles; admins manage all
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert roles"
  ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update roles"
  ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete roles"
  ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- leads
CREATE POLICY "Sales view own leads"
  ON public.leads FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all leads"
  ON public.leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins insert leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners update own leads"
  ON public.leads FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins update all leads"
  ON public.leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners delete own leads"
  ON public.leads FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins delete all leads"
  ON public.leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- deals
CREATE POLICY "Sales view own deals"
  ON public.deals FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all deals"
  ON public.deals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own deals"
  ON public.deals FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own deals"
  ON public.deals FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins update all deals"
  ON public.deals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners delete own deals"
  ON public.deals FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins delete all deals"
  ON public.deals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- activities
CREATE POLICY "Sales view own activities"
  ON public.activities FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all activities"
  ON public.activities FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own activities"
  ON public.activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own activities"
  ON public.activities FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins update all activities"
  ON public.activities FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners delete own activities"
  ON public.activities FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins delete all activities"
  ON public.activities FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
