/** Runtime config — chạy CHỈ trong background, đọc key. Content script không import file này. */
import { readSettings, type PublicSettings } from '../../shared/settings';
import { readKeys, type LlmKeys } from '../../shared/secrets';

export type { LlmKeys };
export { readKeys, writeKeys } from '../../shared/secrets';

export async function readRuntimeSettings(): Promise<PublicSettings & { keys: LlmKeys }> {
  const cfg = await readSettings();
  const keys = await readKeys();
  return { ...cfg, keys };
}
