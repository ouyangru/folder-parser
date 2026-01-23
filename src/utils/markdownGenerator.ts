import { type ParsedFile, type ParsedFolder, flattenFiles } from './folderParser';

export function generateMarkdown(folder: ParsedFolder): string {
  const allFiles = flattenFiles(folder.files);
  const codeFiles = allFiles.filter(f => f.type === 'code');
  const configFiles = allFiles.filter(f => f.type === 'config');
  const markdownFiles = allFiles.filter(f => f.type === 'markdown');
  const textFiles = allFiles.filter(f => f.type === 'text');

  let markdown = `# ${folder.name} - 项目分析报告\n\n`;
  
  // Add metadata
  markdown += `## 项目概览\n\n`;
  markdown += `**项目名称**: ${folder.name}\n`;
  markdown += `**分析时间**: ${new Date().toLocaleString('zh-CN')}\n`;
  markdown += `**总文件数**: ${allFiles.length}\n`;
  markdown += `**代码文件**: ${codeFiles.length}\n`;
  markdown += `**配置文件**: ${configFiles.length}\n`;
  markdown += `**文档文件**: ${markdownFiles.length + textFiles.length}\n`;
  markdown += `**总大小**: ${(allFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB\n\n`;

  // Table of Contents
  markdown += `## 目录\n\n`;
  markdown += `- [项目结构](#项目结构)\n`;
  if (configFiles.length > 0) markdown += `- [配置文件](#配置文件)\n`;
  if (markdownFiles.length > 0) markdown += `- [文档文件](#文档文件)\n`;
  if (textFiles.length > 0) markdown += `- [文本文件](#文本文件)\n`;
  if (codeFiles.length > 0) markdown += `- [代码文件](#代码文件)\n`;
  markdown += `\n`;

  // Project structure
  markdown += `## 项目结构\n\n`;
  markdown += `\`\`\`\n`;
  markdown += generateTreeStructure(folder.files, 0);
  markdown += `\`\`\`\n\n`;

  // Config files
  if (configFiles.length > 0) {
    markdown += `## 配置文件\n\n`;
    for (const file of configFiles) {
      markdown += `### ${file.path}\n\n`;
      markdown += `\`\`\`${getLanguageFromFilename(file.name)}\n`;
      markdown += truncateContent(file.content, 100);
      markdown += `\n\`\`\`\n\n`;
    }
  }

  // Markdown files
  if (markdownFiles.length > 0) {
    markdown += `## 文档文件\n\n`;
    for (const file of markdownFiles) {
      markdown += `### ${file.path}\n\n`;
      markdown += truncateContent(file.content, 200);
      markdown += `\n\n`;
    }
  }

  // Text files
  if (textFiles.length > 0) {
    markdown += `## 文本文件\n\n`;
    for (const file of textFiles) {
      markdown += `### ${file.path}\n\n`;
      markdown += `\`\`\`\n`;
      markdown += truncateContent(file.content, 100);
      markdown += `\n\`\`\`\n\n`;
    }
  }

  // Code files
  if (codeFiles.length > 0) {
    markdown += `## 代码文件\n\n`;
    
    // Group by language
    const byLanguage = codeFiles.reduce((groups, file) => {
      const lang = file.language || 'other';
      if (!groups[lang]) groups[lang] = [];
      groups[lang].push(file);
      return groups;
    }, {} as Record<string, ParsedFile[]>);

    for (const [language, files] of Object.entries(byLanguage)) {
      markdown += `### ${getLanguageDisplayName(language)} 文件\n\n`;
      
      for (const file of files) {
        markdown += `#### ${file.path}\n\n`;
        markdown += `**文件大小**: ${(file.size / 1024).toFixed(2)} KB\n\n`;
        markdown += `\`\`\`${language}\n`;
        markdown += file.content;
        markdown += `\n\`\`\`\n\n`;
      }
    }
  }

  // Summary
  markdown += `---\n\n`;
  markdown += `## 总结\n\n`;
  markdown += `本项目共包含 **${allFiles.length}** 个文件，其中：\n`;
  markdown += `- 代码文件: **${codeFiles.length}** 个\n`;
  markdown += `- 配置文件: **${configFiles.length}** 个\n`;
  markdown += `- 文档文件: **${markdownFiles.length + textFiles.length}** 个\n`;
  markdown += `\n`;
  markdown += `所有文件内容已整合至此文档，可直接上传至 AI 模型进行分析。\n`;

  return markdown;
}

function generateTreeStructure(files: (ParsedFile | ParsedFolder)[], level: number): string {
  let result = '';
  const indent = '  '.repeat(level);
  
  for (const item of files) {
    if ('content' in item) {
      result += `${indent}├── ${item.name} (${(item.size / 1024).toFixed(1)} KB)\n`;
    } else {
      result += `${indent}├── ${item.name}/\n`;
      result += generateTreeStructure(item.files, level + 1);
    }
  }
  
  return result;
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
