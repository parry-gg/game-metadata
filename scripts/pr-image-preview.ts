import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';

const STICKY_MARKER = '<!-- pr-image-preview -->';
const CDN_URL_REGEX = /https:\/\/parrygg\.b-cdn\.net\/[^\s"'`)]+/g;

interface FailedURL {
  url: string;
  reason: string;
}

interface FileEntry {
  path: string;
  newURLs: string[];
}

function fileAtRev(rev: string, path: string): string {
  try {
    return execSync(`git show ${rev}:${path}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function extractURLs(text: string): Set<string> {
  if (!text) return new Set();
  return new Set(text.match(CDN_URL_REGEX) ?? []);
}

function changedJSONFiles(baseSha: string, headSha: string): string[] {
  const out = execSync(`git diff --name-only ${baseSha} ${headSha} -- games`, {
    encoding: 'utf8',
  });
  return out.split('\n').filter((p) => p && p.endsWith('.json'));
}

async function checkURL(url: string): Promise<FailedURL | null> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return { url, reason: `HTTP ${res.status}` };
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return { url, reason: `Content-Type: ${ct || '(none)'}` };
    return null;
  } catch (err) {
    return { url, reason: `Fetch failed: ${(err as Error).message}` };
  }
}

function buildBody(entries: FileEntry[], failures: FailedURL[]): string {
  const lines: string[] = [STICKY_MARKER, '', '## Image preview'];

  if (failures.length) {
    lines.push('', '### ❌ Fetch errors', '');
    for (const f of failures) lines.push(`- \`${f.url}\` — ${f.reason}`);
  }

  const withNew = entries.filter((e) => e.newURLs.length > 0);
  if (withNew.length === 0) {
    lines.push('', '_No new CDN images in this PR._');
  } else {
    for (const entry of withNew) {
      lines.push('', `### \`${entry.path}\``, '');
      for (const url of entry.newURLs) {
        lines.push(`<img src="${url}" alt="" width="200" />`);
      }
    }
  }

  return lines.join('\n');
}

async function findStickyComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
) {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  return comments.find((c) => c.body?.startsWith(STICKY_MARKER));
}

async function main() {
  const baseSha = process.env.GITHUB_BASE_SHA;
  const headSha = process.env.GITHUB_HEAD_SHA;
  const dryRun = process.argv.includes('--dry-run');

  if (!baseSha || !headSha) {
    throw new Error('GITHUB_BASE_SHA and GITHUB_HEAD_SHA are required');
  }

  const files = changedJSONFiles(baseSha, headSha);
  const entries: FileEntry[] = [];
  const allNewURLs = new Set<string>();

  for (const file of files) {
    const headContent = fileAtRev(headSha, file);
    if (!headContent) continue;
    const baseURLs = extractURLs(fileAtRev(baseSha, file));
    const headURLs = extractURLs(headContent);
    const newURLs = [...headURLs].filter((u) => !baseURLs.has(u));
    newURLs.forEach((u) => allNewURLs.add(u));
    entries.push({ path: file, newURLs });
  }

  const failures: FailedURL[] = [];
  for (const url of allNewURLs) {
    const res = await checkURL(url);
    if (res) failures.push(res);
  }

  const body = buildBody(entries, failures);

  if (dryRun) {
    console.log(body);
    console.log('\n---');
    console.log(`Failures: ${failures.length}`);
    return;
  }

  const prNumberStr = process.env.PR_NUMBER;
  const repoSlug = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!prNumberStr || !repoSlug || !token) {
    throw new Error(
      'PR_NUMBER, GITHUB_REPOSITORY, and GITHUB_TOKEN are required (or pass --dry-run)',
    );
  }
  const prNumber = parseInt(prNumberStr, 10);
  const [owner, repo] = repoSlug.split('/');
  const octokit = new Octokit({ auth: token });

  const existing = await findStickyComment(octokit, owner, repo, prNumber);
  if (existing) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
  }

  if (failures.length) {
    console.error(`Failing job: ${failures.length} unreachable image(s)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
