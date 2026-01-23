export type FileType = 'code' | 'config' | 'markdown' | 'text' | 'other';

export interface ParsedFile {
  name: string;
  path: string;
  content: string;
  size: number;
  type: FileType;
  language?: string;
}

export interface ParsedFolder {
  name: string;
  path: string;
  files: (ParsedFile | ParsedFolder)[];
}

const CODE_EXTENSIONS: { [key: string]: string } = {
  // JavaScript/TypeScript
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mjs: 'javascript',
  cjs: 'javascript',
  
  // Python
  py: 'python',
  pyx: 'python',
  pyi: 'python',
  
  // Java
  java: 'java',
  kt: 'kotlin',
  scala: 'scala',
  groovy: 'groovy',
  
  // C/C++
  c: 'c',
  cpp: 'cpp',
  cxx: 'cpp',
  cc: 'cpp',
  h: 'c',
  hpp: 'cpp',
  hxx: 'cpp',
  
  // C#
  cs: 'csharp',
  
  // Go
  go: 'go',
  
  // Rust
  rs: 'rust',
  
  // Ruby
  rb: 'ruby',
  
  // PHP
  php: 'php',
  
  // Swift
  swift: 'swift',
  
  // Dart
  dart: 'dart',
  
  // Shell
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  
  // SQL
  sql: 'sql',
  
  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  vue: 'vue',
  svelte: 'svelte',
};

const CONFIG_EXTENSIONS = [
  'json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config', 'xml', 
  'env', 'properties', 'gradle', 'maven', 'cmake', 'makefile', 'mk'
];

const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdx', 'rst', 'adoc'];

const TEXT_EXTENSIONS = ['txt', 'log', 'csv', 'tsv', 'gitignore', 'gitattributes', 'dockerignore'];

// 常见的二进制文件扩展名
const BINARY_EXTENSIONS = [
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'img', 'iso',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'ico', 'webp',
  'mp3', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'wav', 'flac',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
  'ttf', 'otf', 'woff', 'woff2', 'eot'
];

export function getFileType(extension: string): FileType {
  const ext = extension.toLowerCase();
  
  if (CODE_EXTENSIONS[ext]) return 'code';
  if (CONFIG_EXTENSIONS.includes(ext)) return 'config';
  if (MARKDOWN_EXTENSIONS.includes(ext)) return 'markdown';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  
  return 'other';
}

export function getLanguage(extension: string): string | undefined {
  return CODE_EXTENSIONS[extension.toLowerCase()];
}

export function isBinaryFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTENSIONS.includes(ext);
}

export function isLikelyBinaryContent(content: string): boolean {
  // 检查内容是否包含大量 null 字符或不可打印字符
  const nullCharCount = (content.match(/\x00/g) || []).length;
  const totalChars = content.length;
  
  // 如果 null 字符占比超过 1%，认为是二进制文件
  if (nullCharCount > totalChars * 0.01) {
    return true;
  }
  
  // 检查前 1000 个字符中是否有大量不可打印字符（除了换行、制表符等）
  const sample = content.slice(0, 1000);
  let nonPrintableCount = 0;
  
  for (let i = 0; i < sample.length; i++) {
    const charCode = sample.charCodeAt(i);
    // 允许的可打印字符：32-126（空格到~），以及常见的空白字符
    if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
      nonPrintableCount++;
    }
  }
  
  // 如果不可打印字符占比超过 5%，认为是二进制文件
  return nonPrintableCount > sample.length * 0.05;
}

export async function parseFolder(files: File[]): Promise<ParsedFolder> {
  if (files.length === 0) {
    throw new Error('No files provided');
  }

  // Group files by their directory structure
  const rootFiles: (ParsedFile | ParsedFolder)[] = [];
  const folderMap = new Map<string, ParsedFolder>();

  // First pass: create folder structure
  for (const file of files) {
    const pathParts = file.webkitRelativePath ? 
      file.webkitRelativePath.split('/') : 
      [file.name];
    
    let currentPath = '';
    
    // Create folder structure
    for (let i = 0; i < pathParts.length - 1; i++) {
      const folderName = pathParts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
      
      if (!folderMap.has(currentPath)) {
        const folder: ParsedFolder = {
          name: folderName,
          path: currentPath,
          files: []
        };
        
        folderMap.set(currentPath, folder);
        
        if (i === 0) {
          rootFiles.push(folder);
        } else {
          const parentFolder = folderMap.get(parentPath);
          if (parentFolder) {
            parentFolder.files.push(folder);
          }
        }
      }
    }
  }

  // Second pass: add files to folders
  const parsedFiles: ParsedFile[] = [];
  
  for (const file of files) {
    const pathParts = file.webkitRelativePath ? 
      file.webkitRelativePath.split('/') : 
      [file.name];
    
    const fileName = pathParts[pathParts.length - 1];
    const extension = fileName.split('.').pop() || '';
    const fileType = getFileType(extension);
    
    // Skip binary files and large files
    if (fileType === 'other' && !['gitignore', 'dockerignore', 'env'].includes(fileName.toLowerCase())) {
      continue;
    }
    
    if (file.size > 5 * 1024 * 1024) { // Skip files larger than 5MB
      console.warn(`Skipping large file: ${file.name}`);
      continue;
    }

    try {
      const content = await readFileContent(file);
      const parsedFile: ParsedFile = {
        name: fileName,
        path: file.webkitRelativePath || fileName,
        content,
        size: file.size,
        type: fileType,
        language: getLanguage(extension)
      };
      
      parsedFiles.push(parsedFile);
      
      // Add to folder structure
      if (pathParts.length > 1) {
        const folderPath = pathParts.slice(0, -1).join('/');
        const folder = folderMap.get(folderPath);
        if (folder) {
          folder.files.push(parsedFile);
        }
      } else {
        rootFiles.push(parsedFile);
      }
    } catch (error) {
      console.warn(`Failed to read file: ${file.name}`, error);
    }
  }

  // If no folder structure, create a generic folder
  if (rootFiles.length === 0 && parsedFiles.length > 0) {
    return {
      name: 'uploaded-folder',
      path: '',
      files: parsedFiles
    };
  }

  // Find the common root folder
  const rootFolderName = files[0].webkitRelativePath ? 
    files[0].webkitRelativePath.split('/')[0] : 
    'uploaded-folder';

  return {
    name: rootFolderName,
    path: '',
    files: rootFiles
  };
}

async function readFileContent(file: File): Promise<string> {
  // 首先检查文件扩展名
  if (isBinaryFile(file.name)) {
    throw new Error(`跳过二进制文件: ${file.name}`);
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        // 检查内容是否为二进制
        if (isLikelyBinaryContent(content)) {
          reject(new Error(`检测到二进制内容，跳过文件: ${file.name}`));
        } else {
          resolve(content);
        }
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

export function flattenFiles(files: (ParsedFile | ParsedFolder)[], parentPath: string = ''): ParsedFile[] {
  const result: ParsedFile[] = [];
  
  for (const item of files) {
    if ('content' in item) {
      result.push(item);
    } else {
      result.push(...flattenFiles(item.files, `${parentPath}/${item.name}`));
    }
  }
  
  return result;
}
