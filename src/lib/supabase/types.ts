/**
 * Supabase row shapes for future production tables.
 * Keep in sync with SQL migrations when wiring a real project.
 */

export type DbPatientRow = {
  id: string;
  mrn: string;
  display_name: string;
  date_of_birth: string;
  created_at: string;
};

export type DbAppointmentRow = {
  id: string;
  patient_id: string;
  provider_id: string;
  status: string;
  scheduled_for: string;
  workflow_stage: string;
  created_at: string;
};
