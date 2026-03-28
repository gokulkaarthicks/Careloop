import type { Prescription, UUID } from "@/types/workflow";

export type PharmacySubmitResult = {
  externalOrderId: string;
  status: "accepted" | "rejected";
};

/**
 * Future pharmacy / e-prescribing integration (Surescripts, vendor API, etc.).
 */
export async function submitPrescriptionToPharmacy(
  prescription: Prescription,
  pharmacyId: UUID,
): Promise<PharmacySubmitResult> {
  void prescription;
  void pharmacyId;
  throw new Error(
    "Pharmacy integration not configured. The demo updates local state only.",
  );
}
