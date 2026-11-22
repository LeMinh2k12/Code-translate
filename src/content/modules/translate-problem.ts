/**
 * Translate-problem skeleton — feature real होने ở giai đoạn 3.
 * Giai đoạn 2: render status nhẹ, không đụng trang.
 */
import type { CfModule, ModuleContext } from './module-interface';
import { registerModule } from './module-interface';
import { isProblemPage } from './url-match';

const translateProblemModule: CfModule = {
  id: 'translate-problem',
  name: 'translate-problem',
  matches: (url) => isProblemPage(url),
  init(ctx: ModuleContext) {
    ctx.setStatus('ok', 'Translate-problem module active (feature landing in stage 3)');
  },
  destroy() {},
};

registerModule(translateProblemModule);
