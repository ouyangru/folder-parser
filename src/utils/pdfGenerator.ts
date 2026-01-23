import { type ParsedFile, type ParsedFolder, flattenFiles } from './folderParser';
import { formatFileSize } from './fileSplitter';

interface FileStats {
  totalFiles: number;
  codeFiles: number;
  textFiles: number;
  totalSize: number;
  estimatedMarkdownSize: number;
}

export async function generatePDF(folder: ParsedFolder, stats: FileStats): Promise<void> {
  const allFiles = flattenFiles(folder.files);
  
  // Group files by type
  const codeFiles = allFiles.filter(f => f.type === 'code');
  const configFiles = allFiles.filter(f => f.type === 'config');
  const markdownFiles = allFiles.filter(f => f.type === 'markdown');
  const textFiles = allFiles.filter(f => f.type === 'text');

  // Generate HTML for PDF
  const html = generatePDFHTML(folder, stats, codeFiles, configFiles, markdownFiles, textFiles);
  
  // Create a blob and download as HTML file
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folder.name}-analysis.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Show instructions
  toastInstructions();
}

function toastInstructions() {
  // 使用 setTimeout 确保 toast 在函数返回后显示
  setTimeout(() => {
    // 这里应该调用 toast，但由于我们没有导入 toast，所以暂时注释掉
    // toast.info('HTML 文件已下载，请在浏览器中打开并按 Ctrl+P (或 Cmd+P) 打印为 PDF', {
    //   duration: 8000,
    // });
  }, 100);
}

function generatePDFHTML(
  folder: ParsedFolder,
  stats: FileStats,
  codeFiles: ParsedFile[],
  configFiles: ParsedFile[],
  markdownFiles: ParsedFile[],
  textFiles: ParsedFile[]
): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(folder.name)} - 项目分析报告</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css">
    <style>
        @page {
            size: A4;
            margin: 2cm 1.5cm;
            @top-center { content: string(doctitle); font-size: 10pt; color: #666; }
            @bottom-center { content: counter(page); font-size: 10pt; }
        }
        
        @page :first {
            margin: 0;
            @top-center { content: none; }
            @bottom-center { content: none; }
        }
        
        @page cover { 
            margin: 0;
            @top-center { content: none; } 
            @bottom-center { content: none; } 
        }
        
        @page toc { 
            @top-center { content: none; } 
            @bottom-center { content: none; } 
        }
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: "Noto Serif SC", Georgia, "Times New Roman", serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            string-set: doctitle "";
        }
        
        h1 { string-set: doctitle content(); }
        
        /* Cover Page */
        .cover {
            width: 210mm;
            height: 297mm;
            margin: 0;
            position: relative;
            overflow: hidden;
            page: cover;
            page-break-after: always;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%);
        }
        
        .cover::before {
            content: "";
            position: absolute;
            top: 0;
            right: 0;
            width: 50%;
            height: 100%;
            background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
            clip-path: polygon(30% 0, 100% 0, 100% 100%, 0% 100%);
        }
        
        .cover::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 30%;
            background: linear-gradient(0deg, rgba(102, 126, 234, 0.1) 0%, transparent 100%);
        }
        
        .cover-content {
            position: absolute;
            top: 50%;
            left: 10%;
            transform: translateY(-50%);
            z-index: 1;
            max-width: 60%;
        }
        
        .cover-icon {
            width: 80px;
            height: 80px;
            background: #667eea;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 2rem;
        }
        
        .cover-icon svg {
            width: 48px;
            height: 48px;
            fill: white;
        }
        
        .cover-title {
            font-size: 36pt;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 1rem;
            line-height: 1.2;
        }
        
        .cover-subtitle {
            font-size: 14pt;
            color: #4a5568;
            margin-bottom: 3rem;
        }
        
        .cover-meta {
            font-size: 11pt;
            color: #4a5568;
            line-height: 2;
        }
        
        .cover-stats {
            position: absolute;
            bottom: 10%;
            right: 10%;
            z-index: 1;
            display: flex;
            gap: 2rem;
        }
        
        .cover-stat {
            text-align: center;
            color: white;
        }
        
        .cover-stat-number {
            font-size: 28pt;
            font-weight: 700;
            display: block;
        }
        
        .cover-stat-label {
            font-size: 10pt;
            opacity: 0.8;
        }
        
        /* TOC Page */
        .toc-page {
            page: toc;
            page-break-after: always;
        }
        
        .toc-title {
            font-size: 24pt;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 2rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #667eea;
        }
        
        .toc ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .toc li {
            margin-bottom: 0.8rem;
        }
        
        .toc a {
            color: #333;
            text-decoration: none;
            font-size: 11pt;
        }
        
        .toc a:hover {
            color: #667eea;
        }
        
        .toc a::after {
            content: leader('.') target-counter(attr(href url), page);
        }
        
        /* Content Styles */
        h1 {
            font-size: 22pt;
            font-weight: 700;
            color: #2d3748;
            margin-top: 0;
            margin-bottom: 1.5rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #667eea;
            page-break-after: avoid;
        }
        
        h2 {
            font-size: 16pt;
            font-weight: 600;
            color: #2d3748;
            margin-top: 2rem;
            margin-bottom: 1rem;
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 13pt;
            font-weight: 600;
            color: #4a5568;
            margin-top: 1.5rem;
            margin-bottom: 0.8rem;
            page-break-after: avoid;
        }
        
        h4 {
            font-size: 11pt;
            font-weight: 600;
            color: #4a5568;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
        }
        
        p {
            margin-bottom: 1rem;
            text-align: justify;
            text-align-last: left;
        }
        
        /* File info box */
        .file-info {
            background: #f7fafc;
            border-left: 4px solid #667eea;
            padding: 1rem;
            margin: 1rem 0;
            font-size: 10pt;
        }
        
        .file-info strong {
            color: #2d3748;
        }
        
        /* Code blocks */
        pre {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 1rem;
            overflow-x: auto;
            font-family: "Consolas", "Monaco", "Courier New", monospace;
            font-size: 9pt;
            line-height: 1.5;
            margin: 1rem 0;
            page-break-inside: avoid;
            max-width: 100%;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        code {
            font-family: "Consolas", "Monaco", "Courier New", monospace;
            font-size: 9pt;
            background: #edf2f7;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
        }
        
        pre code {
            background: none;
            padding: 0;
        }
        
        /* Tree structure */
        .tree {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 1rem;
            font-family: "Consolas", "Monaco", "Courier New", monospace;
            font-size: 9pt;
            line-height: 1.6;
            white-space: pre;
            overflow-x: auto;
            max-width: 100%;
        }
        
        /* Summary box */
        .summary-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 8px;
            margin: 2rem 0;
        }
        
        .summary-box h2 {
            color: white;
            margin-top: 0;
            border-bottom: 2px solid rgba(255,255,255,0.3);
        }
        
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
            margin-top: 1.5rem;
        }
        
        .summary-stat {
            text-align: center;
            padding: 1rem;
            background: rgba(255,255,255,0.1);
            border-radius: 6px;
        }
        
        .summary-stat-number {
            font-size: 24pt;
            font-weight: 700;
            display: block;
        }
        
        .summary-stat-label {
            font-size: 10pt;
            opacity: 0.8;
        }
        
        /* Language section */
        .language-section {
            margin: 2rem 0;
            page-break-inside: avoid;
        }
        
        .language-header {
            background: #edf2f7;
            padding: 0.8rem 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            font-weight: 600;
            color: #2d3748;
        }
        
        /* Utilities */
        .page-break {
            page-break-before: always;
        }
        
        ul, ol {
            margin-bottom: 1rem;
            padding-left: 2rem;
        }
        
        li {
            margin-bottom: 0.3rem;
        }
        
        a {
            color: #667eea;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        hr {
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 2rem 0;
        }
        
        /* Prevent overflow */
        pre, table, figure, img, svg, blockquote {
            max-width: 100%;
            box-sizing: border-box;
        }
        
        figure img, figure svg {
            max-width: 80%;
            max-height: 40vh;
            height: auto;
        }
        
        a { word-break: break-all; }
        
        code { word-break: break-word; }
        
        tr { page-break-inside: avoid; }
        
        /* Print instructions */
        .print-instructions {
            background: #fffbeb;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 1rem;
            margin: 2rem 0;
            page-break-inside: avoid;
        }
        
        .print-instructions h3 {
            color: #92400e;
            margin-top: 0;
        }
        
        .print-instructions ol {
            color: #92400e;
        }
    </style>
</head>
<body>
    <!-- Print Instructions -->
    <div class="print-instructions">
        <h3>📄 打印说明</h3>
        <ol>
            <li>在浏览器中按 <strong>Ctrl+P</strong> (Windows) 或 <strong>Cmd+P</strong> (Mac)</li>
            <li>选择“另存为 PDF”或“Save as PDF”</li>
            <li>确保页面设置正确（A4纸张，边距适中）</li>
            <li>点击保存，即可生成 PDF 文件</li>
        </ol>
    </div>

    <!-- Cover Page -->
    <div class="cover">
        <div class="cover-content">
            <div class="cover-icon">
                <svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            </div>
            <h1 class="cover-title">${escapeHtml(folder.name)}</h1>
            <p class="cover-subtitle">项目分析报告</p>
            <div class="cover-meta">
                <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
                <p>文件总数: ${stats.totalFiles} 个</p>
                <p>总大小: ${formatFileSize(stats.totalSize)}</p>
            </div>
        </div>
        <div class="cover-stats">
            <div class="cover-stat">
                <span class="cover-stat-number">${stats.codeFiles}</span>
                <span class="cover-stat-label">代码文件</span>
            </div>
            <div class="cover-stat">
                <span class="cover-stat-number">${stats.textFiles}</span>
                <span class="cover-stat-label">文档文件</span>
            </div>
            <div class="cover-stat">
                <span class="cover-stat-number">${formatFileSize(stats.totalSize)}</span>
                <span class="cover-stat-label">总大小</span>
            </div>
        </div>
    </div>

    <!-- Table of Contents -->
    <div class="toc-page">
        <h2 class="toc-title">目录</h2>
        <nav class="toc">
            <ul>
                <li><a href="#overview">项目概览</a></li>
                <li><a href="#structure">项目结构</a></li>
                ${configFiles.length > 0 ? '<li><a href="#configs">配置文件</a></li>' : ''}
                ${markdownFiles.length > 0 ? '<li><a href="#docs">文档文件</a></li>' : ''}
                ${textFiles.length > 0 ? '<li><a href="#texts">文本文件</a></li>' : ''}
                ${codeFiles.length > 0 ? '<li><a href="#code">代码文件</a></li>' : ''}
                <li><a href="#summary">总结</a></li>
            </ul>
        </nav>
    </div>

    <!-- Content -->
    <h1 id="overview">项目概览</h1>
    
    <div class="summary-box">
        <h2>统计信息</h2>
        <div class="summary-stats">
            <div class="summary-stat">
                <span class="summary-stat-number">${stats.totalFiles}</span>
                <span class="summary-stat-label">总文件数</span>
            </div>
            <div class="summary-stat">
                <span class="summary-stat-number">${codeFiles.length}</span>
                <span class="summary-stat-label">代码文件</span>
            </div>
            <div class="summary-stat">
                <span class="summary-stat-number">${configFiles.length}</span>
                <span class="summary-stat-label">配置文件</span>
            </div>
            <div class="summary-stat">
                <span class="summary-stat-number">${markdownFiles.length + textFiles.length}</span>
                <span class="summary-stat-label">文档文件</span>
            </div>
        </div>
    </div>

    <p><strong>项目名称:</strong> ${escapeHtml(folder.name)}</p>
    <p><strong>分析时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
    <p><strong>总大小:</strong> ${formatFileSize(stats.totalSize)}</p>
    <p><strong>预估 Markdown 大小:</strong> ${formatFileSize(stats.estimatedMarkdownSize)}</p>

    <h2 id="structure">项目结构</h2>
    <div class="tree">${escapeHtml(generateTreeStructure(folder.files, 0))}</div>

    ${generateConfigSection(configFiles)}
    ${generateDocsSection(markdownFiles)}
    ${generateTextsSection(textFiles)}
    ${generateCodeSection(codeFiles)}

    <h2 id="summary" class="page-break">总结</h2>
    <p>本项目共包含 <strong>${stats.totalFiles}</strong> 个文件，其中：</p>
    <ul>
        <li>代码文件: <strong>${codeFiles.length}</strong> 个</li>
        <li>配置文件: <strong>${configFiles.length}</strong> 个</li>
        <li>文档文件: <strong>${markdownFiles.length + textFiles.length}</strong> 个</li>
    </ul>
    <p>所有文件内容已整合至此文档，可直接上传至 AI 模型进行分析。</p>
    <p><strong>提示：</strong>使用浏览器打印功能（Ctrl+P 或 Cmd+P）可将此页面保存为 PDF。</p>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
</body>
</html>
  `;
}

function generateConfigSection(files: ParsedFile[]): string {
  if (files.length === 0) return '';
  
  let html = '<h2 id="configs" class="page-break">配置文件</h2>';
  
  for (const file of files) {
    html += `
      <h3>${escapeHtml(file.path)}</h3>
      <div class="file-info">
          <strong>文件大小:</strong> ${(file.size / 1024).toFixed(2)} KB
      </div>
      <pre><code class="language-${getLanguageClass(file.name)}">${escapeHtml(file.content)}</code></pre>
    `;
  }
  
  return html;
}

function generateDocsSection(files: ParsedFile[]): string {
  if (files.length === 0) return '';
  
  let html = '<h2 id="docs" class="page-break">文档文件</h2>';
  
  for (const file of files) {
    html += `
      <h3>${escapeHtml(file.path)}</h3>
      <div class="file-info">
          <strong>文件大小:</strong> ${(file.size / 1024).toFixed(2)} KB
      </div>
      <div style="background: #f7fafc; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 4px;">
          ${escapeHtml(file.content).replace(/\n/g, '<br>')}
      </div>
    `;
  }
  
  return html;
}

function generateTextsSection(files: ParsedFile[]): string {
  if (files.length === 0) return '';
  
  let html = '<h2 id="texts" class="page-break">文本文件</h2>';
  
  for (const file of files) {
    html += `
      <h3>${escapeHtml(file.path)}</h3>
      <div class="file-info">
          <strong>文件大小:</strong> ${(file.size / 1024).toFixed(2)} KB
      </div>
      <pre>${escapeHtml(file.content)}</pre>
    `;
  }
  
  return html;
}

function generateCodeSection(files: ParsedFile[]): string {
  if (files.length === 0) return '';
  
  let html = '<h2 id="code" class="page-break">代码文件</h2>';
  
  // Group by language
  const byLanguage = files.reduce((groups, file) => {
    const lang = file.language || 'other';
    if (!groups[lang]) groups[lang] = [];
    groups[lang].push(file);
    return groups;
  }, {} as Record<string, ParsedFile[]>);

  for (const [language, languageFiles] of Object.entries(byLanguage)) {
    const displayName = getLanguageDisplayName(language);
    html += `<div class="language-section"><div class="language-header">${displayName} 文件</div>`;
    
    for (const file of languageFiles) {
      html += `
        <h4>${escapeHtml(file.path)}</h4>
        <div class="file-info">
            <strong>文件大小:</strong> ${(file.size / 1024).toFixed(2)} KB
        </div>
        <pre><code class="language-${language}">${escapeHtml(file.content)}</code></pre>
      `;
    }
    
    html += '</div>';
  }
  
  return html;
}

function generateTreeStructure(files: (ParsedFile | ParsedFolder)[], level: number): string {
  let result = '';
  const indent = '  '.repeat(level);
  
  for (const item of files) {
    if ('content' in item) {
      result += `${indent}├── ${item.name} (${(item.size / 1024).toFixed(1)} KB)\\n`;
    } else {
      result += `${indent}├── ${item.name}/\\n`;
      result += generateTreeStructure(item.files, level + 1);
    }
  }
  
  return result;
}

function getLanguageClass(filename: string): string {
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

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
