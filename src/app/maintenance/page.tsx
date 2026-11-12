import { redirect } from "next/navigation";
import { isCrewLoginDisabled } from "@/lib/login-maintenance";
import { CrewMaintenancePage } from "@/components/crew-maintenance-page";

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  if (!isCrewLoginDisabled()) redirect("/crew");
  return <CrewMaintenancePage />;
}
