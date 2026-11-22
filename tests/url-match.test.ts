import { describe, expect, it } from 'vitest';
import { isContestListPage, isProblemsetPage, isSubmissionPage, isContestPage, isBlogPage } from '../src/content/modules/url-match';

describe('url-match', () => {
  it('matches problem pages', () => {
    expect(isProblemsetPage(new URL('https://codeforces.com/problemset/problem/4/A'))).toBe(true);
    expect(isProblemsetPage(new URL('https://codeforces.com/problemset/problem/1335/A'))).toBe(true);
  });

  it('matches contest list and problemset pages', () => {
    expect(isContestListPage(new URL('https://codeforces.com/contests'))).toBe(true);
    expect(isContestListPage(new URL('https://codeforces.com/contests/1225'))).toBe(true);
    expect(isProblemsetPage(new URL('https://codeforces.com/problemset'))).toBe(true);
    expect(isProblemsetPage(new URL('https://codeforces.com/problemset/'))).toBe(true);
  });

  it('matches blog pages', () => {
    expect(isBlogPage(new URL('https://codeforces.com/blog/entry/longtitle'))).toBe(true);
  });

  it('matches submission pages', () => {
    expect(isSubmissionPage(new URL('https://codeforces.com/submission/1234567'))).toBe(true);
  });

  it('matches contest pages', () => {
    expect(isContestPage(new URL('https://codeforces.com/contest/1335/'))).toBe(true);
    expect(isContestPage(new URL('https://codeforces.com/contest/1335/problem/1335A'))).toBe(true);
    expect(isContestPage(new URL('https://codeforces.com/problemset/problem/4/A'))).toBe(false);
  });
});
