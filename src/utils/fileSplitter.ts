import { type ParsedFile, type ParsedFolder, flattenFiles } from './folderParser';

export interface FileChunk {
  index: number;
  totalChunks: number;
  content: string;
  estimatedSize: number;
  fileCount: number;
}

export interface SplitResult {
  chunks: FileChunk[];
  totalSize: number;
  chunkCount: number;
  recommendedChunkSize: number;
}

// 目标文件大小：2MB (Markdown)
const TARGET_MARKDOWN_SIZE = 2 * 1024 * 1024; // 2MB

export function estimateContentSize(content: string): number {
  // 使用 Blob 来估算实际大小
  return new Blob([content]).size;
}

export function calculateTotalEstimatedSize(files: ParsedFile[]): number {
  return files.reduce((total, file) => {
    // Markdown 格式通常比原始文本稍大（因为添加了标题、代码块标记等）
    const markdownMultiplier = 1.2;
    return total + Math.floor(file.content.length * markdownMultiplier);
  }, 0);
}

export function splitFilesIntoChunks(
  folder: ParsedFolder,
  targetSize: number = TARGET_MARKDOWN_SIZE
): SplitResult {
  const allFiles = flattenFiles(folder.files);
  const totalEstimatedSize = calculateTotalEstimatedSize(allFiles);
  
  // 计算需要的分块数量
  const chunkCount = Math.ceil(totalEstimatedSize / targetSize);
  
  const chunks: FileChunk[] = [];
  let currentChunkIndex = 0;
  let currentChunkFiles: ParsedFile[] = [];
  let currentChunkSize = 0;
  
  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    const fileSize = estimateMarkdownSize(file);
    
    // 如果当前块已经有文件，并且添加这个文件会超过目标大小，开始新块
    if (currentChunkFiles.length > 0 && 
        currentChunkSize + fileSize > targetSize && 
        currentChunkIndex < chunkCount - 1) {
      chunks.push(createChunk(currentChunkIndex, chunkCount, currentChunkFiles, folder.name));
      currentChunkIndex++;
      currentChunkFiles = [];
      currentChunkSize = 0;
    }
    
    currentChunkFiles.push(file);
    currentChunkSize += fileSize;
  }
  
  // 添加最后一个块
  if (currentChunkFiles.length > 0) {
    chunks.push(createChunk(currentChunkIndex, chunkCount, currentChunkFiles, folder.name));
  }
  
  // 重新计算实际分块数量和大小
  const actualChunkCount = chunks.length;
  const actualTotalSize = chunks.reduce((sum, chunk) => sum + chunk.estimatedSize, 0);
  
  return {
    chunks,
    totalSize: actualTotalSize,
    chunkCount: actualChunkCount,
    recommendedChunkSize: targetSize
  };
}

function estimateMarkdownSize(file: ParsedFile): number {
  // 估算 Markdown 格式下的文件大小
  // 包括文件名、路径、代码块标记等
  const headerSize = file.path.length + 50; // 文件头信息
  const contentMultiplier = 1.1; // 代码块标记等会增加一点大小
  return Math.floor((file.content.length * contentMultiplier) + headerSize);
}

function createChunk(
  index: number,
  totalChunks: number,
  files: ParsedFile[],
  folderName: string
): FileChunk {
  const content = generateChunkContent(files, folderName, index, totalChunks);
  const estimatedSize = estimateContentSize(content);
  
  return {
    index,
    totalChunks,
    content,
    estimatedSize,
    fileCount: files.length
  };
}

function generateChunkContent(
  files: ParsedFile[],
  folderName: string,
  chunkIndex: number,
  totalChunks: number
): string {
  let content = `# ${folderName} - 项目分析报告 (第 ${chunkIndex + 1} / ${totalChunks} 部分)\n\n`;
  
  // 添加分块信息
  content += `## 分块信息\n\n`;
  content += `**本部分包含 ${files.length} 个文件**\n`;
  content += `**总字符数**: ${files.reduce((sum, f) => sum + f.content.length, 0).toLocaleString()}\n\n`;
  
  if (totalChunks > 1) {
    content += `> **提示**: 本项目已拆分为 ${totalChunks} 个部分，请确保将所有部分都提供给 AI 模型进行分析。\n\n`;
  }
  
  // 文件列表
  content += `## 本部分包含的文件\n\n`;
  files.forEach(file => {
    content += `- \`${file.path}\` (${(file.size / 1024).toFixed(1)} KB)\n`;
  });
  content += `\n---\n\n`;
  
  // 按类型分组文件
  const codeFiles = files.filter(f => f.type === 'code');
  const configFiles = files.filter(f => f.type === 'config');
  const markdownFiles = files.filter(f => f.type === 'markdown');
  const textFiles = files.filter(f => f.type === 'text');
  
  // 配置文件
  if (configFiles.length > 0) {
    content += `## 配置文件\n\n`;
    for (const file of configFiles) {
      content += `### ${file.path}\n\n`;
      content += `\`\`\`${getLanguageFromFilename(file.name)}\n`;
      content += truncateContent(file.content, 100);
      content += `\n\`\`\`\n\n`;
    }
  }
  
  // Markdown 文件
  if (markdownFiles.length > 0) {
    content += `## 文档文件\n\n`;
    for (const file of markdownFiles) {
      content += `### ${file.path}\n\n`;
      content += truncateContent(file.content, 200);
      content += `\n\n`;
    }
  }
  
  // 文本文件
  if (textFiles.length > 0) {
    content += `## 文本文件\n\n`;
    for (const file of textFiles) {
      content += `### ${file.path}\n\n`;
      content += `\`\`\`\n`;
      content += truncateContent(file.content, 100);
      content += `\n\`\`\`\n\n`;
    }
  }
  
  // 代码文件（按语言分组）
  if (codeFiles.length > 0) {
    content += `## 代码文件\n\n`;
    
    const byLanguage = codeFiles.reduce((groups, file) => {
      const lang = file.language || 'other';
      if (!groups[lang]) groups[lang] = [];
      groups[lang].push(file);
      return groups;
    }, {} as Record<string, ParsedFile[]>);
    
    for (const [language, langFiles] of Object.entries(byLanguage)) {
      content += `### ${getLanguageDisplayName(language)} 文件\n\n`;
      
      for (const file of langFiles) {
        content += `#### ${file.path}\n\n`;
        content += `**文件大小**: ${(file.size / 1024).toFixed(2)} KB\n\n`;
        content += `\`\`\`${language}\n`;
        content += file.content;
        content += `\n\`\`\`\n\n`;
      }
    }
  }
  
  return content;
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: { [key: string]: string } = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    dart: 'dart',
    sh: 'bash',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    vue: 'vue',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    md: 'markdown',
  };
  
  return languageMap[ext] || '';
}

function getLanguageDisplayName(language: string): string {
  const displayNames: { [key: string]: string } = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    go: 'Go',
    rust: 'Rust',
    php: 'PHP',
    ruby: 'Ruby',
    swift: 'Swift',
    kotlin: 'Kotlin',
    scala: 'Scala',
    dart: 'Dart',
    bash: 'Shell',
    sql: 'SQL',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'SASS',
    less: 'LESS',
    vue: 'Vue',
  };
  
  return displayNames[language] || language.toUpperCase();
}

function truncateContent(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return content;
  }
  
  return lines.slice(0, maxLines).join('\n') + '\n... (truncated)';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export function shouldSplitFiles(totalSize: number, maxSize: number = TARGET_MARKDOWN_SIZE): boolean {
  return totalSize > maxSize;
}
