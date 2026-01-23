import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Upload, FileText, Folder, Code, FileCode, FileJson, FileType, CheckCircle, AlertCircle, Loader2, Download, BookText, FileArchive, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { generatePDF } from '@/utils/pdfGenerator';
import { generateMarkdown } from '@/utils/markdownGenerator';
import { parseFolder, type ParsedFile, type ParsedFolder, flattenFiles } from '@/utils/folderParser';
import { calculateTotalEstimatedSize, formatFileSize, splitFilesIntoChunks, type SplitResult } from '@/utils/fileSplitter';
import { FileManager } from '@/components/FileManager';
import './App.css';

interface FileStats {
  totalFiles: number;
  codeFiles: number;
  textFiles: number;
  totalSize: number;
  estimatedMarkdownSize: number;
}

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedFolder, setParsedFolder] = useState<ParsedFolder | null>(null);
  const [fileStats, setFileStats] = useState<FileStats | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 文件大小阈值
  const MARKDOWN_SIZE_THRESHOLD = 2 * 1024 * 1024; // 2MB
  const PDF_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    
    if (items.length === 0) {
      toast.error('请拖入有效的文件夹');
      return;
    }

    // Check if it's a folder drop
    const hasFolder = items.some(item => item.kind === 'file' && item.webkitGetAsEntry()?.isDirectory);
    
    if (!hasFolder) {
      toast.error('请拖入文件夹，而非单个文件');
      return;
    }

    await parseAndProcessFiles(items);
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check if it's a folder selection
    const hasDirectory = Array.from(files).some(file => file.webkitRelativePath !== '');
    
    if (!hasDirectory) {
      toast.error('请选择文件夹，使用"上传文件夹"按钮');
      return;
    }

    await parseAndProcessFolderFiles(Array.from(files));
  };

  const parseAndProcessFolderFiles = async (files: File[]) => {
    setIsParsing(true);
    try {
      const folder = await parseFolder(files);
      setParsedFolder(folder);
      
      const stats = calculateStats(folder);
      setFileStats(stats);
      
      const mdContent = generateMarkdown(folder);
      setMarkdownContent(mdContent);
      
      // 计算是否需要拆分
      const splitResult = splitFilesIntoChunks(folder, MARKDOWN_SIZE_THRESHOLD);
      setSplitResult(splitResult);
      
      setActiveTab('preview');
      toast.success(`成功解析 ${stats.totalFiles} 个文件`);
    } catch (error) {
      console.error('解析失败:', error);
      toast.error('文件夹解析失败，请检查文件格式');
    } finally {
      setIsParsing(false);
    }
  };

  const parseAndProcessFiles = async (items: DataTransferItem[]) => {
    setIsParsing(true);
    try {
      const files: File[] = [];
      
      // Collect all files from dropped items
      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await collectFilesFromEntry(entry, files);
          }
        }
      }

      if (files.length === 0) {
        toast.error('未找到有效文件');
        return;
      }

      const folder = await parseFolder(files);
      setParsedFolder(folder);
      
      const stats = calculateStats(folder);
      setFileStats(stats);
      
      const mdContent = generateMarkdown(folder);
      setMarkdownContent(mdContent);
      
      // 计算是否需要拆分
      const splitResult = splitFilesIntoChunks(folder, MARKDOWN_SIZE_THRESHOLD);
      setSplitResult(splitResult);
      
      setActiveTab('preview');
      toast.success(`成功解析 ${stats.totalFiles} 个文件`);
    } catch (error) {
      console.error('解析失败:', error);
      toast.error('文件夹解析失败，请检查文件格式');
    } finally {
      setIsParsing(false);
    }
  };

  const collectFilesFromEntry = async (entry: FileSystemEntry, files: File[]): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      return new Promise((resolve) => {
        fileEntry.file((file) => {
          files.push(file);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      
      return new Promise((resolve, reject) => {
        const readEntries = () => {
          reader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve();
            } else {
              for (const subEntry of entries) {
                await collectFilesFromEntry(subEntry, files);
              }
              readEntries(); // Continue reading until no more entries
            }
          }, reject);
        };
        readEntries();
      });
    }
  };

  const calculateStats = (folder: ParsedFolder): FileStats => {
    let totalFiles = 0;
    let codeFiles = 0;
    let textFiles = 0;
    let totalSize = 0;

    const countFiles = (files: (ParsedFile | ParsedFolder)[]) => {
      for (const item of files) {
        if ('content' in item) {
          totalFiles++;
          totalSize += item.size;
          if (item.type === 'code') codeFiles++;
          else if (item.type === 'text') textFiles++;
        } else {
          countFiles(item.files);
        }
      }
    };

    countFiles(folder.files);
    
    const allFiles = flattenFiles(folder.files);
    const estimatedMarkdownSize = calculateTotalEstimatedSize(allFiles);
    
    return { totalFiles, codeFiles, textFiles, totalSize, estimatedMarkdownSize };
  };

  const handleGeneratePDF = async () => {
    if (!parsedFolder || !fileStats) return;
    
    try {
      // 检查文件大小
      if (fileStats.estimatedMarkdownSize > PDF_SIZE_THRESHOLD) {
        toast.error(`文件太大 (${formatFileSize(fileStats.estimatedMarkdownSize)})，建议使用拆分下载功能`);
        return;
      }
      
      await generatePDF(parsedFolder, fileStats);
      toast.success('PDF生成成功！');
    } catch (error) {
      console.error('PDF生成失败:', error);
      toast.error('PDF生成失败');
    }
  };

  const handleDownloadMarkdown = () => {
    if (!markdownContent || !parsedFolder) return;
    
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parsedFolder.name}-analysis.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Markdown下载成功！');
  };

  const handleDownloadSplitFiles = () => {
    if (!splitResult || !parsedFolder) return;
    
    // 创建多个文件并打包下载
    downloadMultipleFiles(splitResult.chunks, parsedFolder.name);
  };

  const downloadMultipleFiles = (chunks: SplitResult['chunks'], folderName: string) => {
    // 创建一个临时的下载列表
    chunks.forEach((chunk, index) => {
      setTimeout(() => {
        const blob = new Blob([chunk.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folderName}-part${index + 1}-of${chunk.totalChunks}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, index * 500); // 错开下载时间
    });
    
    toast.success(`已开始下载 ${chunks.length} 个拆分文件`);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'code': return <FileCode className="w-4 h-4 text-blue-500" />;
      case 'config': return <FileJson className="w-4 h-4 text-yellow-500" />;
      case 'markdown': return <BookText className="w-4 h-4 text-gray-600" />;
      case 'text': return <FileText className="w-4 h-4 text-green-500" />;
      default: return <FileType className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderFileTree = (items: (ParsedFile | ParsedFolder)[], level: number = 0) => {
    return items.map((item, index) => {
      const key = `${level}-${index}`;
      if ('content' in item) {
        return (
          <div key={key} className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded" style={{ paddingLeft: `${level * 16 + 8}px` }}>
            {getFileIcon(item.type)}
            <span className="text-sm text-gray-700">{item.name}</span>
            <Badge variant="outline" className="ml-auto text-xs">
              {(item.size / 1024).toFixed(1)} KB
            </Badge>
          </div>
        );
      } else {
        return (
          <div key={key}>
            <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded" style={{ paddingLeft: `${level * 16 + 8}px` }}>
              <Folder className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-800">{item.name}</span>
            </div>
            {renderFileTree(item.files, level + 1)}
          </div>
        );
      }
    });
  };

  // 计算是否需要拆分
  const needsSplitting = useMemo(() => {
    return fileStats ? fileStats.estimatedMarkdownSize > MARKDOWN_SIZE_THRESHOLD : false;
  }, [fileStats]);

  // 文件大小警告信息
  const sizeWarning = useMemo(() => {
    if (!fileStats) return null;
    
    const warnings = [];
    
    if (fileStats.estimatedMarkdownSize > MARKDOWN_SIZE_THRESHOLD) {
      warnings.push({
        type: 'markdown',
        size: fileStats.estimatedMarkdownSize,
        threshold: MARKDOWN_SIZE_THRESHOLD,
        message: `Markdown 文件较大，建议拆分下载`
      });
    }
    
    if (fileStats.estimatedMarkdownSize > PDF_SIZE_THRESHOLD) {
      warnings.push({
        type: 'pdf',
        size: fileStats.estimatedMarkdownSize,
        threshold: PDF_SIZE_THRESHOLD,
        message: `PDF 文件过大，无法直接生成`
      });
    }
    
    return warnings.length > 0 ? warnings : null;
  }, [fileStats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Folder className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">文件夹解析工具</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            拖拽上传文件夹，自动解析代码和文档，生成整合的PDF或Markdown文件，方便上传至AI模型进行分析
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto mb-6">
            <TabsTrigger value="upload">上传文件夹</TabsTrigger>
            <TabsTrigger value="preview" disabled={!parsedFolder}>文件预览</TabsTrigger>
            <TabsTrigger value="manage" disabled={!parsedFolder}>文件管理</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
              <CardContent className="p-8">
                <div
                  className={`flex flex-col items-center justify-center min-h-[300px] rounded-lg transition-all ${
                    isDragging ? 'bg-blue-50 border-blue-400 border-2' : 'border-2 border-transparent'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {isParsing ? (
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-700 mb-2">正在解析文件夹...</p>
                      <p className="text-sm text-gray-500">请稍候</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-blue-100 rounded-full mb-4">
                        <Upload className="w-10 h-10 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">拖拽文件夹到此处</h3>
                      <p className="text-gray-600 mb-4">或点击按钮选择文件夹</p>
                      <div className="flex gap-4">
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Folder className="w-4 h-4 mr-2" />
                          上传文件夹
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          webkitdirectory=""
                          directory=""
                          onChange={handleFileInput}
                          className="hidden"
                          multiple
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-4">
                        支持常见代码文件 (.js, .ts, .py, .java, .cpp 等)、配置文件 (.json, .yaml, .toml 等)、文档 (.md, .txt, .rst 等)
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Code className="w-5 h-5 text-blue-600" />
                    代码文件
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-2">自动识别并提取代码内容</p>
                  <Badge variant="outline">.js .ts .py .java .cpp .c .go .rs 等</Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileJson className="w-5 h-5 text-yellow-600" />
                    配置文件
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-2">包含项目配置和依赖信息</p>
                  <Badge variant="outline">.json .yaml .yml .toml .ini .xml 等</Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-green-600" />
                    文档文件
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-2">项目说明和文档内容</p>
                  <Badge variant="outline">.md .txt .rst .html .css 等</Badge>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="preview">
            {parsedFolder && fileStats && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      解析完成
                    </CardTitle>
                    <CardDescription>
                      文件夹 "{parsedFolder.name}" 已成功解析
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{fileStats.totalFiles}</div>
                        <div className="text-sm text-gray-600">总文件数</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{fileStats.codeFiles}</div>
                        <div className="text-sm text-gray-600">代码文件</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{fileStats.textFiles}</div>
                        <div className="text-sm text-gray-600">文档文件</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{(fileStats.totalSize / 1024).toFixed(1)}</div>
                        <div className="text-sm text-gray-600">总大小 (KB)</div>
                      </div>
                      <div className="text-center p-4 bg-amber-50 rounded-lg">
                        <div className="text-2xl font-bold text-amber-600">{formatFileSize(fileStats.estimatedMarkdownSize)}</div>
                        <div className="text-sm text-gray-600">预估大小</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 文件大小警告 */}
                {sizeWarning && (
                  <Card className="border-amber-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="w-5 h-5" />
                        文件大小提示
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {sizeWarning.map((warning, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                          <div>
                            <p className="font-medium text-amber-800">{warning.message}</p>
                            <p className="text-sm text-amber-700">
                              当前大小: {formatFileSize(warning.size)} (限制: {formatFileSize(warning.threshold)})
                            </p>
                          </div>
                          {warning.type === 'markdown' && splitResult && splitResult.chunkCount > 1 && (
                            <Badge variant="outline" className="ml-4">
                              建议拆分为 {splitResult.chunkCount} 个文件
                            </Badge>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Folder className="w-5 h-5 text-amber-600" />
                        文件结构
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                        {renderFileTree(parsedFolder.files)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-blue-600" />
                        导出选项
                      </CardTitle>
                      <CardDescription>
                        选择导出格式，方便上传至 AI 模型进行分析
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 完整 PDF 下载 */}
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-blue-900">PDF 格式</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {formatFileSize(fileStats.estimatedMarkdownSize)}
                          </Badge>
                        </div>
                        <p className="text-sm text-blue-800 mb-3">
                          生成格式良好的 PDF 文档，包含完整的文件结构和代码高亮，适合详细阅读和存档
                        </p>
                        <Button 
                          onClick={handleGeneratePDF}
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={fileStats.estimatedMarkdownSize > PDF_SIZE_THRESHOLD}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          生成 PDF
                        </Button>
                        {fileStats.estimatedMarkdownSize > PDF_SIZE_THRESHOLD && (
                          <p className="text-xs text-red-600 mt-2">文件过大，无法生成 PDF</p>
                        )}
                      </div>

                      {/* 完整 Markdown 下载 */}
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BookText className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-900">完整 Markdown</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {formatFileSize(fileStats.estimatedMarkdownSize)}
                          </Badge>
                        </div>
                        <p className="text-sm text-green-800 mb-3">
                          生成单个 Markdown 文件，保持纯文本格式，文件体积小，适合直接粘贴到 AI 对话中
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleDownloadMarkdown}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            下载完整版
                          </Button>
                        </div>
                      </div>

                      {/* 拆分下载 */}
                      {needsSplitting && splitResult && splitResult.chunkCount > 1 && (
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileArchive className="w-5 h-5 text-amber-600" />
                              <span className="font-medium text-amber-900">拆分下载</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {splitResult.chunkCount} 个文件
                            </Badge>
                          </div>
                          <p className="text-sm text-amber-800 mb-3">
                            将项目拆分为多个小文件，每个文件约 {formatFileSize(splitResult.recommendedChunkSize)}，方便分批上传至 AI 模型
                          </p>
                          <div className="space-y-2">
                            <Button 
                              onClick={handleDownloadSplitFiles}
                              className="bg-amber-600 hover:bg-amber-700 w-full"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              下载所有拆分文件
                            </Button>
                            <div className="text-xs text-amber-700 space-y-1">
                              {splitResult.chunks.map((chunk, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>第 {idx + 1} 部分:</span>
                                  <span>{formatFileSize(chunk.estimatedSize)} ({chunk.fileCount} 个文件)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      使用提示
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">PDF 格式适用场景：</h4>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>需要完整保留代码格式和结构</li>
                          <li>上传至支持 PDF 的 AI 模型</li>
                          <li>需要存档或分享分析结果</li>
                          <li>代码量较大，需要分页阅读</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Markdown 格式适用场景：</h4>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>直接粘贴到聊天对话中</li>
                          <li>文件大小限制较严格</li>
                          <li>需要快速查看和编辑内容</li>
                          <li>AI 模型对纯文本支持更好</li>
                        </ul>
                      </div>
                      <div className="md:col-span-2 mt-4 p-3 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-1">拆分下载提示：</h4>
                        <p className="text-sm text-blue-800">
                          当文件超过 {formatFileSize(MARKDOWN_SIZE_THRESHOLD)} 时，建议拆分为多个小文件。
                          这样可以避免 AI 模型的 token 限制，分批进行分析。
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manage">
            {parsedFolder && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Folder className="w-5 h-5 text-blue-600" />
                      文件管理
                    </CardTitle>
                    <CardDescription>
                      预览、编辑、删除文件。自动跳过二进制文件（图片、音频、视频、压缩包等）
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FileManager 
                      folder={parsedFolder} 
                      onFolderUpdate={(updatedFolder) => {
                        setParsedFolder(updatedFolder);
                        // 更新统计信息
                        const newStats = calculateStats(updatedFolder);
                        setFileStats(newStats);
                        
                        // 更新 Markdown 内容
                        const newMdContent = generateMarkdown(updatedFolder);
                        setMarkdownContent(newMdContent);
                        
                        // 更新拆分结果
                        const newSplitResult = splitFilesIntoChunks(updatedFolder, MARKDOWN_SIZE_THRESHOLD);
                        setSplitResult(newSplitResult);
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <footer className="text-center mt-12 text-sm text-gray-500">
          <p>文件夹解析工具 · 让 AI 更好地理解你的代码项目</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
