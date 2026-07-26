import type { StaticsPatternId } from "@parallel/contracts";
import { concurrentForceEquilibrium } from "./patterns/concurrent-force-equilibrium.js";
import { coupleMoments } from "./patterns/couple-moments.js";
import { equivalentDistributedLoad } from "./patterns/equivalent-distributed-load.js";
import { momentAboutPoint } from "./patterns/moment-about-point.js";
import { resultantCoplanarForces } from "./patterns/resultant-coplanar-forces.js";
import { rigidBodyEquilibrium2d } from "./patterns/rigid-body-equilibrium-2d.js";
import type { StaticsPattern } from "./types.js";

const patterns: Record<StaticsPatternId, StaticsPattern> = {
  concurrent_force_equilibrium: concurrentForceEquilibrium,
  resultant_coplanar_forces: resultantCoplanarForces,
  moment_about_point: momentAboutPoint,
  rigid_body_equilibrium_2d: rigidBodyEquilibrium2d,
  couple_moments: coupleMoments,
  equivalent_distributed_load: equivalentDistributedLoad,
};

export const getPattern = (patternId: StaticsPatternId): StaticsPattern =>
  patterns[patternId];

export const listPatterns = (): readonly StaticsPattern[] =>
  Object.values(patterns);

export type {
  CaseQuantity,
  CaseUnknown,
  DerivedQuantity,
  GeneratedStaticsCase,
  GivenQuantity,
  StaticsPattern,
} from "./types.js";
