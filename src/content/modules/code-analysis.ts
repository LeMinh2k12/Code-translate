/** Code-analysis skeleton — feature real ở giai đoạn 7. */
import type { CfModule, ModuleContext } from './module-interface';
import { registerModule } from './module-interface';
import { isSubmissionPage } from './url-match';

const codeAnalysisModule: CfModule = {
  id: 'code-analysis',
  name: 'code-analysis',
  matches: (url) => isSubmissionPage(url),
  init(ctx: ModuleContext) {
    ctx.setStatus('ok', 'Code-analysis module active (feature landing in stage 7)');
  },
  destroy() {},
};

registerModule(codeAnalysisModule);
