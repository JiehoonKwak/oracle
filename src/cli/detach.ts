import type { ModelName } from "../oracle.js";
import { isProModel } from "../oracle/modelResolver.js";

export function shouldDetachSession({
  engine,
  model,
  waitPreference: _waitPreference,
  disableDetachEnv,
}: {
  engine: string;
  model: ModelName;
  waitPreference: boolean;
  disableDetachEnv: boolean;
}): boolean {
  if (disableDetachEnv) return false;
  if (isProModel(model) && engine === "api") return true;
  return false;
}
