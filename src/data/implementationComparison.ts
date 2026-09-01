import {
  COMPANY_IMPLEMENTATIONS,
  type CompanyImplementation,
} from "./companyImplementations";

export type ImplementationPeerMatch = {
  implementation: CompanyImplementation;
  sharedFamilyIds: CompanyImplementation["mergeFamilyIds"];
  sharedMechanisms: string[];
  sharesWorkload: boolean;
};

function compareIds(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * Finds a production peer using declared comparison fields only. Family IDs and
 * named mechanisms come directly from the reviewed source record; prose is never
 * searched to infer an engine or implementation choice.
 */
export function recommendImplementationPeer(
  current: CompanyImplementation,
  implementations: readonly CompanyImplementation[] = COMPANY_IMPLEMENTATIONS,
): ImplementationPeerMatch | null {
  const matches = implementations
    .filter((candidate) => candidate.id !== current.id)
    .map((candidate): ImplementationPeerMatch => ({
      implementation: candidate,
      sharedFamilyIds: current.mergeFamilyIds.filter((familyId) => candidate.mergeFamilyIds.includes(familyId)),
      sharedMechanisms: current.mechanisms.filter((mechanism) => candidate.mechanisms.includes(mechanism)),
      sharesWorkload: current.workload === candidate.workload,
    }))
    .filter((match) => match.sharedFamilyIds.length > 0 || match.sharedMechanisms.length > 0 || match.sharesWorkload)
    .sort((left, right) => (
      right.sharedFamilyIds.length - left.sharedFamilyIds.length
      || right.sharedMechanisms.length - left.sharedMechanisms.length
      || Number(right.sharesWorkload) - Number(left.sharesWorkload)
      || compareIds(left.implementation.id, right.implementation.id)
    ));

  return matches[0] ?? null;
}
