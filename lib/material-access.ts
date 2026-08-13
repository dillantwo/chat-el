import "server-only";
import type { UserRole } from "@/models/User";
import type { MaterialAudience } from "@/models/LearningMaterial";

/**
 * Whether a role may see a material with the given audience.
 * - teachers see "teacher" + "both"
 * - students see "student" + "both"
 * - admins see everything
 */
export function isAudienceAllowed(role: UserRole, audience: MaterialAudience): boolean {
  if (role === "admin") return true;
  if (audience === "both") return true;
  if (role === "teacher") return audience === "teacher";
  if (role === "student") return audience === "student";
  return false;
}
