CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','coordinator','pi','cra');
CREATE TYPE public.study_status AS ENUM ('active','completed','on-hold');
CREATE TYPE public.patient_status AS ENUM ('screening','enrolled','completed','dropped');
CREATE TYPE public.risk_level AS ENUM ('low','medium','high','unknown');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.can_write(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','coordinator','pi')
  );
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- new user bootstrap
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'coordinator'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ DRUG DICTIONARY ============
CREATE TABLE public.drug_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preferred_name TEXT NOT NULL,
  atc_code TEXT,
  trade_names TEXT[] NOT NULL DEFAULT '{}',
  half_life_hours NUMERIC,
  common_misspellings TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'WHO-DD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX drug_dictionary_name_trgm ON public.drug_dictionary USING gin (preferred_name gin_trgm_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drug_dictionary TO authenticated;
GRANT ALL ON public.drug_dictionary TO service_role;
ALTER TABLE public.drug_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drugs readable" ON public.drug_dictionary FOR SELECT TO authenticated USING (true);
CREATE POLICY "drugs admin insert" ON public.drug_dictionary FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "drugs admin update" ON public.drug_dictionary FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "drugs admin delete" ON public.drug_dictionary FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============ STUDIES ============
CREATE TABLE public.studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  protocol_number TEXT NOT NULL UNIQUE,
  phase TEXT,
  indication TEXT,
  pi_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.study_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studies TO authenticated;
GRANT ALL ON public.studies TO service_role;
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "studies read" ON public.studies FOR SELECT TO authenticated USING (true);
CREATE POLICY "studies insert" ON public.studies FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "studies update" ON public.studies FOR UPDATE TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "studies delete" ON public.studies FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ PROHIBITED DRUGS ============
CREATE TABLE public.prohibited_drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  atc_code TEXT,
  washout_days_required INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prohibited_drugs TO authenticated;
GRANT ALL ON public.prohibited_drugs TO service_role;
ALTER TABLE public.prohibited_drugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prohibited read" ON public.prohibited_drugs FOR SELECT TO authenticated USING (true);
CREATE POLICY "prohibited insert" ON public.prohibited_drugs FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "prohibited update" ON public.prohibited_drugs FOR UPDATE TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "prohibited delete" ON public.prohibited_drugs FOR DELETE TO authenticated USING (public.can_write(auth.uid()));

-- ============ PATIENTS ============
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_id_number TEXT NOT NULL,
  pseudonym TEXT,
  age INTEGER,
  gender TEXT,
  enrollment_date DATE,
  status public.patient_status NOT NULL DEFAULT 'screening',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (study_id, study_id_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients read" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "patients insert" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "patients update" ON public.patients FOR UPDATE TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "patients delete" ON public.patients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ PATIENT MEDICATIONS ============
CREATE TABLE public.patient_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  drug_name_raw TEXT NOT NULL,
  drug_dictionary_id UUID REFERENCES public.drug_dictionary(id) ON DELETE SET NULL,
  dose TEXT,
  frequency TEXT,
  last_dose_date DATE,
  clearance_date DATE,
  is_prohibited BOOLEAN NOT NULL DEFAULT false,
  protocol_deviation_risk public.risk_level NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_medications TO authenticated;
GRANT ALL ON public.patient_medications TO service_role;
ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meds read" ON public.patient_medications FOR SELECT TO authenticated USING (true);
CREATE POLICY "meds insert" ON public.patient_medications FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "meds update" ON public.patient_medications FOR UPDATE TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "meds delete" ON public.patient_medications FOR DELETE TO authenticated USING (public.can_write(auth.uid()));

-- ============ WASHOUT CALCULATIONS ============
CREATE TABLE public.washout_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_medication_id UUID REFERENCES public.patient_medications(id) ON DELETE CASCADE,
  drug_dictionary_id UUID REFERENCES public.drug_dictionary(id) ON DELETE SET NULL,
  calculated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  half_life_used NUMERIC,
  last_dose_date DATE,
  clearance_date DATE,
  status TEXT,
  risk public.risk_level NOT NULL DEFAULT 'unknown',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.washout_calculations TO authenticated;
GRANT ALL ON public.washout_calculations TO service_role;
ALTER TABLE public.washout_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calc read" ON public.washout_calculations FOR SELECT TO authenticated USING (true);
CREATE POLICY "calc insert" ON public.washout_calculations FOR INSERT TO authenticated WITH CHECK (calculated_by = auth.uid());

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  summary TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pi') OR user_id = auth.uid());
CREATE POLICY "audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ SEED: DRUGS ============
INSERT INTO public.drug_dictionary (preferred_name, atc_code, trade_names, half_life_hours, common_misspellings, source) VALUES
('Omeprazole','A02BC01', ARRAY['Prilosec','Losec'], 1.5, ARRAY['omeprazol','omaprazole'],'RxNorm'),
('Metformin','A10BA02', ARRAY['Glucophage'], 6.5, ARRAY['metiformin','metphormin'],'RxNorm'),
('Atorvastatin','C10AA05', ARRAY['Lipitor'], 14, ARRAY['atorvastatine','atorvastin'],'RxNorm'),
('Amlodipine','C08CA01', ARRAY['Norvasc'], 35, ARRAY['amlodapine','amlodipin'],'RxNorm'),
('Aspirin','B01AC06', ARRAY['Bayer Aspirin'], 0.3, ARRAY['asprin','aspririn'],'RxNorm'),
('Losartan','C09CA01', ARRAY['Cozaar'], 2, ARRAY['losartin','losarton'],'RxNorm'),
('Escitalopram','N06AB10', ARRAY['Lexapro'], 30, ARRAY['escitalapram','escitalopr'],'DrugCentral'),
('Pantoprazole','A02BC02', ARRAY['Protonix'], 1, ARRAY['pantaprazole','panto'],'RxNorm'),
('Clopidogrel','B01AC04', ARRAY['Plavix'], 7, ARRAY['clopidogril','clopidog'],'RxNorm'),
('Simvastatin','C10AA01', ARRAY['Zocor'], 3, ARRAY['simvastatine','simvastin'],'RxNorm');

-- ============ SEED: STUDIES ============
INSERT INTO public.studies (name, protocol_number, phase, indication, status) VALUES
('Phase III Immunotherapy NSCLC','ST-001','Phase III','Non-Small Cell Lung Cancer','active'),
('Phase II Cardiac Trial','ST-002','Phase II','Heart Failure','active'),
('Phase I Neurology Trial','ST-003','Phase I','Alzheimer''s Disease','active');

INSERT INTO public.prohibited_drugs (study_id, drug_name, atc_code, washout_days_required, reason)
SELECT s.id,'Atorvastatin','C10AA05',14,'Potential CYP3A4 interaction with study drug' FROM public.studies s WHERE s.protocol_number='ST-001';
INSERT INTO public.prohibited_drugs (study_id, drug_name, atc_code, washout_days_required, reason)
SELECT s.id,'Simvastatin','C10AA01',14,'Potential CYP3A4 interaction with study drug' FROM public.studies s WHERE s.protocol_number='ST-001';
INSERT INTO public.prohibited_drugs (study_id, drug_name, atc_code, washout_days_required, reason)
SELECT s.id,'Aspirin','B01AC06',7,'Bleeding risk with investigational anticoagulant' FROM public.studies s WHERE s.protocol_number='ST-002';
INSERT INTO public.prohibited_drugs (study_id, drug_name, atc_code, washout_days_required, reason)
SELECT s.id,'Clopidogrel','B01AC04',7,'Bleeding risk with investigational anticoagulant' FROM public.studies s WHERE s.protocol_number='ST-002';
INSERT INTO public.prohibited_drugs (study_id, drug_name, atc_code, washout_days_required, reason)
SELECT s.id,'Escitalopram','N06AB10',30,'CNS-active agent confounds primary endpoint' FROM public.studies s WHERE s.protocol_number='ST-003';

-- ============ SEED: PATIENTS ============
INSERT INTO public.patients (study_id, study_id_number, pseudonym, age, gender, enrollment_date, status)
SELECT s.id,'P-001','Subject Alpha',62,'Male',CURRENT_DATE - 30,'screening' FROM public.studies s WHERE s.protocol_number='ST-001';
INSERT INTO public.patients (study_id, study_id_number, pseudonym, age, gender, enrollment_date, status)
SELECT s.id,'P-002','Subject Bravo',58,'Female',CURRENT_DATE - 28,'enrolled' FROM public.studies s WHERE s.protocol_number='ST-001';
INSERT INTO public.patients (study_id, study_id_number, pseudonym, age, gender, enrollment_date, status)
SELECT s.id,'P-003','Subject Charlie',71,'Male',CURRENT_DATE - 25,'enrolled' FROM public.studies s WHERE s.protocol_number='ST-002';
INSERT INTO public.patients (study_id, study_id_number, pseudonym, age, gender, enrollment_date, status)
SELECT s.id,'P-004','Subject Delta',65,'Female',CURRENT_DATE - 20,'screening' FROM public.studies s WHERE s.protocol_number='ST-002';
INSERT INTO public.patients (study_id, study_id_number, pseudonym, age, gender, enrollment_date, status)
SELECT s.id,'P-005','Subject Echo',48,'Male',CURRENT_DATE - 15,'screening' FROM public.studies s WHERE s.protocol_number='ST-003';

-- ============ SEED: MEDICATIONS ============
INSERT INTO public.patient_medications (patient_id, drug_name_raw, drug_dictionary_id, dose, frequency, last_dose_date, clearance_date, is_prohibited, protocol_deviation_risk)
SELECT p.id,'atorvastatin', d.id,'40mg','Daily', CURRENT_DATE - 4, CURRENT_DATE + 10, true,'high'
FROM public.patients p, public.drug_dictionary d WHERE p.study_id_number='P-001' AND d.preferred_name='Atorvastatin';
INSERT INTO public.patient_medications (patient_id, drug_name_raw, drug_dictionary_id, dose, frequency, last_dose_date, clearance_date, is_prohibited, protocol_deviation_risk)
SELECT p.id,'metformin', d.id,'500mg','Twice daily', CURRENT_DATE - 5, CURRENT_DATE - 3, false,'low'
FROM public.patients p, public.drug_dictionary d WHERE p.study_id_number='P-002' AND d.preferred_name='Metformin';
INSERT INTO public.patient_medications (patient_id, drug_name_raw, drug_dictionary_id, dose, frequency, last_dose_date, clearance_date, is_prohibited, protocol_deviation_risk)
SELECT p.id,'asprin', d.id,'81mg','Daily', CURRENT_DATE - 20, CURRENT_DATE - 13, true,'low'
FROM public.patients p, public.drug_dictionary d WHERE p.study_id_number='P-003' AND d.preferred_name='Aspirin';
INSERT INTO public.patient_medications (patient_id, drug_name_raw, drug_dictionary_id, dose, frequency, last_dose_date, clearance_date, is_prohibited, protocol_deviation_risk)
SELECT p.id,'amlodipine', d.id,'5mg','Daily', CURRENT_DATE - 3, CURRENT_DATE + 5, false,'low'
FROM public.patients p, public.drug_dictionary d WHERE p.study_id_number='P-004' AND d.preferred_name='Amlodipine';
INSERT INTO public.patient_medications (patient_id, drug_name_raw, drug_dictionary_id, dose, frequency, last_dose_date, clearance_date, is_prohibited, protocol_deviation_risk)
SELECT p.id,'escitalopram', d.id,'10mg','Daily', CURRENT_DATE - 10, CURRENT_DATE + 20, true,'high'
FROM public.patients p, public.drug_dictionary d WHERE p.study_id_number='P-005' AND d.preferred_name='Escitalopram';
INSERT INTO public.patient_medications (patient_id, drug_name_raw, drug_dictionary_id, dose, frequency, last_dose_date, clearance_date, is_prohibited, protocol_deviation_risk)
SELECT p.id,'omeprazole', d.id,'20mg','Daily', CURRENT_DATE - 2, CURRENT_DATE - 1, false,'low'
FROM public.patients p, public.drug_dictionary d WHERE p.study_id_number='P-001' AND d.preferred_name='Omeprazole';