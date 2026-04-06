import fs from 'fs';
import path from 'path';

export interface CodebaseSummary {
  projectName: string;
  detectedType: string;
  directoryTree: string;
  manifestContent: string | null;
  readmeContent: string | null;
  configFiles: { name: string; content: string }[];
  entryPoints: { path: string; preview: string }[];
  stats: { filesByExt: Record<string, number>; estimatedLoc: number };
  dockerInfo: string | null;
  envExample: string | null;
}

const NOISE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '__pycache__', '.next',
  'vendor', '.venv', 'venv', 'target', 'docs', '.codeforge', 'coverage',
  '.nyc_output', '.turbo', 'tmp', 'temp', '.cache',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.rb', '.php',
  '.dart', '.swift', '.kt', '.json', '.yaml', '.yml', '.toml', '.md', '.txt',
  '.html', '.css', '.scss', '.sql', '.sh', '.env',
]);

const CONFIG_FILE_CANDIDATES = [
  'next.config.ts', 'next.config.js', 'next.config.mjs',
  'vite.config.ts', 'vite.config.js',
  'webpack.config.js', 'webpack.config.ts',
  'tsconfig.json',
  '.eslintrc.js', '.eslintrc.json', 'eslint.config.js', 'eslint.config.ts',
  'tailwind.config.ts', 'tailwind.config.js',
  'Makefile',
];

const ENTRY_POINT_CANDIDATES = [
  'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
  'src/app.ts', 'src/app.js', 'app.ts', 'app.js', 'index.ts', 'index.js',
  'src/cli.ts', 'main.py', 'app.py',
];

const MANIFEST_MAP: Record<string, string> = {
  'node-ts': 'package.json',
  'node-js': 'package.json',
  python: 'pyproject.toml',
  rust: 'Cargo.toml',
  go: 'go.mod',
  java: 'pom.xml',
  ruby: 'Gemfile',
  php: 'composer.json',
  flutter: 'pubspec.yaml',
  dotnet: '',
};

function readLines(filePath: string, maxLines: number): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    return lines.slice(0, maxLines).join('\n');
  } catch {
    return null;
  }
}

function buildTree(dir: string, prefix: string, depth: number, maxDepth: number): string[] {
  if (depth >= maxDepth) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  entries = entries
    .filter(e => !NOISE_DIRS.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const lines: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    if (entry.isDirectory()) {
      lines.push(`${prefix}${connector}${entry.name}/`);
      lines.push(...buildTree(path.join(dir, entry.name), prefix + childPrefix, depth + 1, maxDepth));
    } else {
      lines.push(`${prefix}${connector}${entry.name}`);
    }
  }
  return lines;
}

function detectProjectType(rootPath: string): string {
  const exists = (name: string) => fs.existsSync(path.join(rootPath, name));

  if (exists('package.json')) {
    return exists('tsconfig.json') ? 'node-ts' : 'node-js';
  }
  if (exists('pyproject.toml') || exists('setup.py') || exists('requirements.txt')) return 'python';
  if (exists('Cargo.toml')) return 'rust';
  if (exists('go.mod')) return 'go';
  if (exists('pom.xml') || exists('build.gradle')) return 'java';
  if (exists('Gemfile')) return 'ruby';
  if (exists('composer.json')) return 'php';
  if (exists('pubspec.yaml')) return 'flutter';

  // dotnet: *.csproj or *.sln
  try {
    const topFiles = fs.readdirSync(rootPath);
    if (topFiles.some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) return 'dotnet';
  } catch { /* ignore */ }

  return 'unknown';
}

function collectStats(rootPath: string): { filesByExt: Record<string, number>; estimatedLoc: number } {
  const filesByExt: Record<string, number> = {};
  let estimatedLoc = 0;
  let fileCount = 0;
  const maxFiles = 10_000;

  function walk(dir: string, isSourceDir: boolean) {
    if (fileCount >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (fileCount >= maxFiles) return;
      if (NOISE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const childIsSource = isSourceDir || entry.name === 'src' || entry.name === 'lib';
        walk(fullPath, childIsSource);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (TEXT_EXTENSIONS.has(ext)) {
          filesByExt[ext] = (filesByExt[ext] || 0) + 1;
          fileCount++;
          if (isSourceDir) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              estimatedLoc += content.split('\n').length;
            } catch { /* ignore */ }
          }
        }
      }
    }
  }

  walk(rootPath, false);
  return { filesByExt, estimatedLoc };
}

function extractProjectName(rootPath: string, detectedType: string): string {
  const manifestFile = MANIFEST_MAP[detectedType];
  if (manifestFile) {
    const manifestPath = path.join(rootPath, manifestFile);
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      if (manifestFile.endsWith('.json')) {
        const parsed = JSON.parse(content);
        if (parsed.name) return parsed.name;
      } else if (manifestFile.endsWith('.toml')) {
        const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
        if (nameMatch) return nameMatch[1];
      } else if (manifestFile === 'pubspec.yaml') {
        const nameMatch = content.match(/^name:\s*(.+)/m);
        if (nameMatch) return nameMatch[1].trim();
      }
    } catch { /* ignore */ }
  }
  return path.basename(rootPath);
}

export function scanCodebase(rootPath: string): CodebaseSummary {
  const detectedType = detectProjectType(rootPath);
  const projectName = extractProjectName(rootPath, detectedType);

  // Directory tree (depth 3)
  const treeLines = buildTree(rootPath, '', 0, 3);
  const directoryTree = treeLines.join('\n');

  // Manifest
  const manifestFile = MANIFEST_MAP[detectedType];
  let manifestContent: string | null = null;
  if (manifestFile) {
    manifestContent = readLines(path.join(rootPath, manifestFile), 500);
  }

  // README
  let readmeContent: string | null = null;
  for (const name of ['README.md', 'README.rst', 'README.txt']) {
    readmeContent = readLines(path.join(rootPath, name), 500);
    if (readmeContent !== null) break;
  }

  // Config files (max 5, each 200 lines)
  const configFiles: { name: string; content: string }[] = [];
  for (const name of CONFIG_FILE_CANDIDATES) {
    if (configFiles.length >= 5) break;
    const content = readLines(path.join(rootPath, name), 200);
    if (content !== null) {
      configFiles.push({ name, content });
    }
  }

  // Entry points (max 3, each 50 lines)
  const entryPoints: { path: string; preview: string }[] = [];

  // Try manifest main/bin first
  if (manifestContent && detectedType.startsWith('node')) {
    try {
      const pkg = JSON.parse(manifestContent);
      const candidates: string[] = [];
      if (pkg.main) candidates.push(pkg.main);
      if (pkg.bin) {
        if (typeof pkg.bin === 'string') candidates.push(pkg.bin);
        else if (typeof pkg.bin === 'object') candidates.push(...Object.values(pkg.bin) as string[]);
      }
      for (const ep of candidates) {
        if (entryPoints.length >= 3) break;
        const preview = readLines(path.join(rootPath, ep), 50);
        if (preview !== null) {
          entryPoints.push({ path: ep, preview });
        }
      }
    } catch { /* ignore */ }
  }

  // Fill remaining from conventional paths
  for (const ep of ENTRY_POINT_CANDIDATES) {
    if (entryPoints.length >= 3) break;
    if (entryPoints.some(e => e.path === ep)) continue;
    const preview = readLines(path.join(rootPath, ep), 50);
    if (preview !== null) {
      entryPoints.push({ path: ep, preview });
    }
  }

  // Docker info (100 lines total)
  let dockerInfo: string | null = null;
  const dockerParts: string[] = [];
  let dockerLines = 0;
  for (const name of ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml']) {
    if (dockerLines >= 100) break;
    const content = readLines(path.join(rootPath, name), 100 - dockerLines);
    if (content !== null) {
      dockerParts.push(`### ${name}\n${content}`);
      dockerLines += content.split('\n').length;
    }
  }
  if (dockerParts.length > 0) dockerInfo = dockerParts.join('\n\n');

  // .env example (100 lines)
  let envExample: string | null = null;
  for (const name of ['.env.example', '.env.sample', '.env.template']) {
    envExample = readLines(path.join(rootPath, name), 100);
    if (envExample !== null) break;
  }

  // Stats
  const stats = collectStats(rootPath);

  return {
    projectName,
    detectedType,
    directoryTree,
    manifestContent,
    readmeContent,
    configFiles,
    entryPoints,
    stats,
    dockerInfo,
    envExample,
  };
}

export function buildScanContext(summary: CodebaseSummary, userNotes?: string): string {
  const HARD_CAP = 30_000;

  const filesByExtSummary = Object.entries(summary.stats.filesByExt)
    .sort((a, b) => b[1] - a[1])
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(', ');

  // Build sections in priority order (higher priority = harder to truncate)
  const sections: { label: string; content: string; priority: number }[] = [];

  sections.push({
    label: '## 프로젝트 기본 정보',
    content: `- 이름: ${summary.projectName}\n- 감지된 타입: ${summary.detectedType}\n- 예상 코드 규모: ~${summary.stats.estimatedLoc} 줄\n- 파일 구성: ${filesByExtSummary}`,
    priority: 10,
  });

  sections.push({
    label: '## 디렉토리 구조',
    content: summary.directoryTree,
    priority: 9,
  });

  const manifestFileName = MANIFEST_MAP[summary.detectedType] || 'manifest';
  if (summary.manifestContent) {
    sections.push({
      label: `## 주요 설정 파일: ${manifestFileName}`,
      content: summary.manifestContent,
      priority: 8,
    });
  }

  if (summary.readmeContent) {
    sections.push({
      label: '## README',
      content: summary.readmeContent,
      priority: 7,
    });
  }

  for (const cf of summary.configFiles) {
    sections.push({
      label: `### ${cf.name}`,
      content: cf.content,
      priority: 5,
    });
  }
  // Group config files under a header
  const configIdx = sections.findIndex(s => s.label.startsWith('### ') && summary.configFiles.some(cf => s.label === `### ${cf.name}`));
  if (configIdx !== -1) {
    sections.splice(configIdx, 0, { label: '## 설정 파일들', content: '', priority: 5 });
  }

  for (const ep of summary.entryPoints) {
    sections.push({
      label: `### ${ep.path}`,
      content: ep.preview,
      priority: 6,
    });
  }
  const epIdx = sections.findIndex(s => summary.entryPoints.some(ep => s.label === `### ${ep.path}`));
  if (epIdx !== -1) {
    sections.splice(epIdx, 0, { label: '## 엔트리포인트', content: '', priority: 6 });
  }

  if (summary.dockerInfo) {
    sections.push({
      label: '## 도커/인프라',
      content: summary.dockerInfo,
      priority: 3,
    });
  }

  if (summary.envExample) {
    sections.push({
      label: '## 환경 변수 (.env.example)',
      content: summary.envExample,
      priority: 4,
    });
  }

  if (userNotes) {
    sections.push({
      label: '## 사용자 메모',
      content: userNotes,
      priority: 10,
    });
  }

  // Assemble and apply hard cap
  let result = sections.map(s => s.content ? `${s.label}\n${s.content}` : s.label).join('\n\n');

  if (result.length > HARD_CAP) {
    // Truncate from lowest priority sections
    const sorted = [...sections].sort((a, b) => a.priority - b.priority);
    for (const sec of sorted) {
      if (result.length <= HARD_CAP) break;
      const fullBlock = sec.content ? `${sec.label}\n${sec.content}` : sec.label;
      const truncated = `${sec.label}\n[truncated]`;
      result = result.replace(fullBlock, truncated);
    }
    if (result.length > HARD_CAP) {
      result = result.slice(0, HARD_CAP) + '\n\n[...truncated]';
    }
  }

  return result;
}
