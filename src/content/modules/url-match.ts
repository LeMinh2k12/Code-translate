/** Shared URL matcher helpers for Codeforces pages. */
export function isProblemPage(url: URL): boolean {
  return /\/(problemset\/problem|problem|contest\/\d+\/problem)\//.test(url.pathname);
}

export function isContestListPage(url: URL): boolean {
  return /^\/contests(\/|$)/.test(url.pathname);
}

export function isProblemsetPage(url: URL): boolean {
  return /^\/problemset(\/|$)/.test(url.pathname) || /^\/problemset\/problem\//.test(url.pathname);
}

export function isBlogPage(url: URL): boolean {
  return /\/blog(\/|$)/.test(url.pathname);
}

export function isSubmissionPage(url: URL): boolean {
  return /\/submission(\/|$)/.test(url.pathname);
}

export function isContestPage(url: URL): boolean {
  return /^\/contest\/\d+/.test(url.pathname);
}
