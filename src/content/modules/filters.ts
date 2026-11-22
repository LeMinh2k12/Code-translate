/** Filters skeleton — feature real ở giai đoạn 4. */
import type { CfModule, ModuleContext } from './module-interface';
import { registerModule } from './module-interface';
import { isContestListPage, isProblemsetPage } from './url-match';

const filtersModule: CfModule = {
  id: 'filters',
  name: 'filters',
  matches: (url) => isProblemsetPage(url) || isContestListPage(url),
  init(ctx: ModuleContext) {
    ctx.setStatus('ok', 'Filters module active (feature landing in stage 4)');
  },
  destroy() {},
};

registerModule(filtersModule);
