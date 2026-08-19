import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateWashout, type WashoutResult } from "@/lib/washout";

export const calculateForMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { medicationId: string }) => input)
  .handler(async ({ data, context }): Promise<WashoutResult> => {
    const { supabase, userId } = context;

    const { data: med, error: medError } = await supabase
      .from("patient_medications")
      .select(
        "id, drug_name_raw, last_dose_date, patient_id, drug_dictionary_id, patients(study_id), drug_dictionary(preferred_name, atc_code, half_life_hours)",
      )
      .eq("id", data.medicationId)
      .maybeSingle();

    if (medError) throw new Error(medError.message);
    if (!med) throw new Error("Medication not found");

    const drug = med.drug_dictionary as unknown as {
      preferred_name: string;
      atc_code: string | null;
      half_life_hours: number | null;
    } | null;
    const patient = med.patients as unknown as { study_id: string } | null;
    const name = drug?.preferred_name ?? med.drug_name_raw;

    let washoutDaysRequired = 0;
    let isProhibited = false;
    if (patient?.study_id) {
      const { data: prohibited } = await supabase
        .from("prohibited_drugs")
        .select("drug_name, washout_days_required")
        .eq("study_id", patient.study_id);
      const hit = (prohibited ?? []).find(
        (p) => p.drug_name.trim().toLowerCase() === name.trim().toLowerCase(),
      );
      if (hit) {
        isProhibited = true;
        washoutDaysRequired = hit.washout_days_required ?? 0;
      }
    }

    const result = calculateWashout({
      halfLifeHours: drug?.half_life_hours ?? null,
      lastDoseDate: med.last_dose_date,
      isProhibited,
      washoutDaysRequired,
    });

    await supabase
      .from("patient_medications")
      .update({
        clearance_date: result.clearanceDate,
        is_prohibited: result.isProhibited,
        protocol_deviation_risk: result.risk,
      })
      .eq("id", med.id);

    await supabase.from("washout_calculations").insert({
      patient_medication_id: med.id,
      drug_dictionary_id: med.drug_dictionary_id,
      calculated_by: userId,
      half_life_used: result.halfLifeUsed,
      last_dose_date: med.last_dose_date,
      clearance_date: result.clearanceDate,
      status: result.status,
      risk: result.risk,
    });

    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "washout_calculation",
      table_name: "patient_medications",
      record_id: med.id,
      summary: `Clearance calculated for ${name}: ${result.status}`,
      new_data: { clearance_date: result.clearanceDate, status: result.status },
    });

    return result;
  });

export const calculateAdHoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { drugId: string; lastDoseDate: string; patientId?: string | null }) => input,
  )
  .handler(async ({ data, context }): Promise<WashoutResult> => {
    const { supabase, userId } = context;

    const { data: drug, error: drugError } = await supabase
      .from("drug_dictionary")
      .select("id, preferred_name, atc_code, half_life_hours")
      .eq("id", data.drugId)
      .maybeSingle();
    if (drugError) throw new Error(drugError.message);
    if (!drug) throw new Error("Drug not found");

    let isProhibited = false;
    let washoutDaysRequired = 0;

    if (data.patientId) {
      const { data: patient } = await supabase
        .from("patients")
        .select("study_id")
        .eq("id", data.patientId)
        .maybeSingle();
      if (patient?.study_id) {
        const { data: prohibited } = await supabase
          .from("prohibited_drugs")
          .select("drug_name, washout_days_required")
          .eq("study_id", patient.study_id);
        const hit = (prohibited ?? []).find(
          (p) => p.drug_name.trim().toLowerCase() === drug.preferred_name.trim().toLowerCase(),
        );
        if (hit) {
          isProhibited = true;
          washoutDaysRequired = hit.washout_days_required ?? 0;
        }
      }
    }

    const result = calculateWashout({
      halfLifeHours: drug.half_life_hours,
      lastDoseDate: data.lastDoseDate,
      isProhibited,
      washoutDaysRequired,
    });

    await supabase.from("washout_calculations").insert({
      drug_dictionary_id: drug.id,
      calculated_by: userId,
      half_life_used: result.halfLifeUsed,
      last_dose_date: data.lastDoseDate,
      clearance_date: result.clearanceDate,
      status: result.status,
      risk: result.risk,
    });

    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "washout_calculation",
      table_name: "drug_dictionary",
      record_id: drug.id,
      summary: `Ad-hoc clearance calculated for ${drug.preferred_name}: ${result.status}`,
      new_data: { clearance_date: result.clearanceDate, status: result.status },
    });

    return result;
  });
