import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';

const STICKY_PREFIX = '<!-- pr-image-preview';
const CDN_URL_REGEX = /https:\/\/parrygg\.b-cdn\.net\/[^\s"'`)]+/g;
// GitHub caps issue/PR comment bodies at 65,536 chars; leave headroom for markers.
const MAX_BODY_BYTES = 60_000;

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

function buildIntro(withNew: FileEntry[], failures: FailedURL[]): string {
  const lines = ['## Image preview'];
  if (failures.length) {
    lines.push('', '### ❌ Fetch errors', '');
    for (const f of failures) lines.push(`- \`${f.url}\` — ${f.reason}`);
  }
  if (withNew.length === 0) {
    lines.push('', '_No new CDN images in this PR._');
  } else {
    const total = withNew.reduce((n, e) => n + e.newURLs.length, 0);
    lines.push(
      '',
      `_${total} new image(s) across ${withNew.length} file(s). Expand to review._`,
    );
  }
  return lines.join('\n');
}

function buildFileBlock(entry: FileEntry): string {
  const count = entry.newURLs.length;
  const lines = [
    '<details>',
    `<summary><code>${entry.path}</code> — ${count} image${count === 1 ? '' : 's'}</summary>`,
    '',
    ...entry.newURLs.map((url) => `<img src="${url}" alt="" width="200" />`),
    '',
    '</details>',
  ];
  return lines.join('\n');
}

function packBodies(intro: string, fileBlocks: string[]): string[] {
  // Pack the intro + file blocks into bodies, splitting at file boundaries when
  // a body would exceed GitHub's comment size limit.
  const parts: string[] = [];
  let current = intro;
  for (const block of fileBlocks) {
    const candidate = `${current}\n\n${block}`;
    if (candidate.length > MAX_BODY_BYTES) {
      parts.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  parts.push(current);

  const total = parts.length;
  return parts.map((body, idx) => {
    const part = idx + 1;
    const marker = `<!-- pr-image-preview part=${part} -->`;
    const header = total > 1 && idx > 0 ? `## Image preview (part ${part}/${total})\n\n` : '';
    const footer = total > 1 ? `\n\n_Part ${part} of ${total}_` : '';
    return `${marker}\n\n${header}${body}${footer}`;
  });
}

function buildBodies(entries: FileEntry[], failures: FailedURL[]): string[] {
  const withNew = entries.filter((e) => e.newURLs.length > 0);
  const intro = buildIntro(withNew, failures);
  const fileBlocks = withNew.map(buildFileBlock);
  return packBodies(intro, fileBlocks);
}

async function syncStickyComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  bodies: string[],
) {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const existing = comments
    .filter((c) => c.body?.startsWith(STICKY_PREFIX))
    .sort((a, b) => a.id - b.id);

  for (let i = 0; i < bodies.length; i++) {
    if (i < existing.length) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing[i].id,
        body: bodies[i],
      });
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: bodies[i],
      });
    }
  }
  for (let i = bodies.length; i < existing.length; i++) {
    await octokit.rest.issues.deleteComment({
      owner,
      repo,
      comment_id: existing[i].id,
    });
  }
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

  const bodies = buildBodies(entries, failures);

  if (dryRun) {
    bodies.forEach((b, i) => {
      console.log(`\n===== Comment ${i + 1}/${bodies.length} (${b.length} chars) =====\n`);
      console.log(b);
    });
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

  await syncStickyComments(octokit, owner, repo, prNumber, bodies);

  if (failures.length) {
    console.error(`Failing job: ${failures.length} unreachable image(s)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
