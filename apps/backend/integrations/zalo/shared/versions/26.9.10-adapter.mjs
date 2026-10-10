// Version-specific entry point kept outside the vendor installation.
// The current implementation remains shared for backward compatibility.
// A future verified build may select a different implementation here.
export { runtimeExpression, runtimeCall } from "../runtime.mjs";
