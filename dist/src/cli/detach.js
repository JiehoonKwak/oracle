import { isProModel } from "../oracle/modelResolver.js";
export function shouldDetachSession({ engine, model, waitPreference: _waitPreference, disableDetachEnv, }) {
    if (disableDetachEnv)
        return false;
    if (isProModel(model) && engine === "api")
        return true;
    return false;
}
