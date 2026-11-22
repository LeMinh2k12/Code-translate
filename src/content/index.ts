/**
 * Content script entry — bootstrap.
 * Modules self-register on import (see src/content/modules/index.ts).
 */
import { createLoader } from './modules/loader';
import './modules/index'; // registers all modules via registerModule()

const loader = createLoader({ autoInit: true });

// Cleanup on unmount (e.g. extension reload) — nothing to do in MV3 content script,
// but keep handle for tests.
export { loader };
