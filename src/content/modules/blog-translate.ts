/** Blog-translate skeleton — feature real ở giai đoạn 6. */
import type { CfModule, ModuleContext } from './module-interface';
import { registerModule } from './module-interface';
import { isBlogPage } from './url-match';

const blogTranslateModule: CfModule = {
  id: 'blog-translate',
  name: 'blog-translate',
  matches: (url) => isBlogPage(url),
  init(ctx: ModuleContext) {
    ctx.setStatus('ok', 'Blog-translate module active (feature landing in stage 6)');
  },
  destroy() {},
};

registerModule(blogTranslateModule);
