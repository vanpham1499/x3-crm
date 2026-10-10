// Diagnostic scripts use the dependencies installed with the backend worker.
import { createRequire } from 'node:module';
export const callDependency = createRequire(new URL('../../../apps/backend/integrations/zalo/call/package.json', import.meta.url));
