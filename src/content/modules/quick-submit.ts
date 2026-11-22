/** Quick-submit skeleton — feature real ở giai đoạn 5. */
import type { CfModule, ModuleContext } from './module-interface';
import { registerModule } from './module-interface';
import { isProblemPage } from './url-match';

const quickSubmitModule: CfModule = {
  id: 'quick-submit',
  name: 'quick-submit',
  matches: (url) => isProblemPage(url),
  init(ctx: ModuleContext) {
    ctx.setStatus('ok', 'Quick-submit module active (feature landing in stage 5)');
  },
  destroy() {},
};

registerModule(quickSubmitModule);
