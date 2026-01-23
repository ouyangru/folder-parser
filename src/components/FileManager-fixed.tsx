import { useState, useCallback } from 'react';
import { type ParsedFile, type ParsedFolder, flattenFiles } from '@/utils/folderParser';
import { Trash2, Edit3, Save, X, FileText, FileCode, FileJson, BookText, FileType, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface FileManagerProps {
  folder: ParsedFolder | null;
  onFolderUpdate: (folder: ParsedFolder) => void;
}

interface EditingFile {
  file: ParsedFile;
  originalContent: string;
}

export function FileManager({ folder, onFolderUpdate }: FileManagerProps) {
  const [selectedFile, setSelectedFile] = useState<ParsedFile | null>(null);
  const [editingFile, setEditingFile] = useState<EditingFile | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 获取所有文件（扁平化）
  const allFiles = folder ? flattenFiles(folder.files) : [];

  // 过滤文件
  const filteredFiles = useCallback(() => {
    let files = allFiles;
    
    // 按类型过滤
    if (filterType !== 'all') {
      files = files.filter(file => file.type === filterType);
    }
    
    // 按搜索词过滤
    if (searchTerm) {
      files = files.filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return files;
  }, [allFiles, filterType, searchTerm]);

  // 获取文件图标
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'code': return <FileCode className="w-4 h-4 text-blue-500" />;
      case 'config': return <FileJson className="w-4 h-4 text-yellow-500" />;
      case 'markdown': return <BookText className="w-4 h-4 text-gray-600" />;
      case 'text': return <FileText className="w-4 h-4 text-green-500" />;
      default: return <FileType className="w-4 h-4 text-gray-400" />;
    }
  };

  // 删除文件
  const handleDeleteFile = (fileToDelete: ParsedFile) => {
    if (!folder) return;
    
    const deleteFromFolder = (items: (ParsedFile | ParsedFolder)[]): (ParsedFile | ParsedFolder)[] => {
      return items.filter(item => {
        if ('content' in item) {
          return !(item.name === fileToDelete.name && item.path === fileToDelete.path);
        } else {
          item.files = deleteFromFolder(item.files);
          return true;
        }
      });
    };
    
    const updatedFolder = { ...folder };
    updatedFolder.files = deleteFromFolder(updatedFolder.files);
    
    onFolderUpdate(updatedFolder);
    
    if (selectedFile && selectedFile.path === fileToDelete.path) {
      setSelectedFile(null);
    }
    
    toast.success(`已删除文件: ${fileToDelete.name}`);
  };

  // 开始编辑文件
  const handleEditFile = (file: ParsedFile) => {
    setEditingFile({ file, originalContent: file.content });
    setSelectedFile(file);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingFile || !folder) return;
    
    const updateFileContent = (items: (ParsedFile | ParsedFolder)[]): (ParsedFile | ParsedFolder)[] => {
      return items.map(item => {
        if ('content' in item) {
          if (item.name === editingFile.file.name && item.path === editingFile.file.path) {
            return { ...item, content: editingFile.file.content };
          }
          return item;
        } else {
          return { ...item, files: updateFileContent(item.files) };
        }
      });
    };
    
    const updatedFolder = { ...folder };
    updatedFolder.files = updateFileContent(updatedFolder.files);
    
    onFolderUpdate(updatedFolder);
    setEditingFile(null);
    toast.success(`已保存文件: ${editingFile.file.name}`);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    if (editingFile) {
      // 恢复原始内容
      const restoredFile = { ...editingFile.file, content: editingFile.originalContent };
      setSelectedFile(restoredFile);
    }
    setEditingFile(null);
  };

  // 更新编辑内容
  const handleContentChange = (newContent: string) => {
    if (editingFile) {
      setEditingFile({
        ...editingFile,
        file: { ...editingFile.file, content: newContent }
      });
    }
  };

  // 获取文件类型统计
  const fileStats = useCallback(() => {
    const stats = { code: 0, config: 0, markdown: 0, text: 0, other: 0 };
    allFiles.forEach(file => {
      stats[file.type]++;
    });
    return stats;
  }, [allFiles]);

  const stats = fileStats();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
      {/* 左侧：文件列表 */}
      <div className="lg:col-span-1 space-y-4">
        {/* 搜索和过滤 */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input
              placeholder="搜索文件名或内容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
              >
                全部 ({allFiles.length})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'code' ? 'default' : 'outline'}
                onClick={() => setFilterType('code')}
              >
                代码 ({stats.code})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'config' ? 'default' : 'outline'}
                onClick={() => setFilterType('config')}
              >
                配置 ({stats.config})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'markdown' ? 'default' : 'outline'}
                onClick={() => setFilterType('markdown')}
              >
                文档 ({stats.markdown})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 文件列表 */}
        <Card className="flex-1 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">文件列表 ({filteredFiles().length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[400px] overflow-y-auto">
            {filteredFiles().length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>没有找到匹配的文件</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredFiles().map((file, index) => (
                  <div
                    key={`${file.path}-${index}`}
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${
                      selectedFile?.path === file.path ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getFileIcon(file.type)}
                        <span className="text-sm font-medium truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditFile(file);
                          }}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {file.path} · {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 右侧：文件内容预览/编辑 */}
      <div className="lg:col-span-2">
        {selectedFile ? (
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getFileIcon(selectedFile.type)}
                  <CardTitle className="text-lg">{selectedFile.name}</CardTitle>
                </div>
                <Badge variant="outline">{(selectedFile.size / 1024).toFixed(1)} KB</Badge>
              </div>
              <div className="text-sm text-gray-500">{selectedFile.path}</div>
            </CardHeader>
            <CardContent className="p-0 h-[500px] flex flex-col">
              {editingFile ? (
                <>
                  <div className="flex items-center justify-between p-4 border-b">
                    <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      编辑模式
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        <X className="w-4 h-4 mr-1" />
                        取消
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Save className="w-4 h-4 mr-1" />
                        保存
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={editingFile.file.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    className="flex-1 resize-none font-mono text-sm p-4 border-0 focus-visible:ring-0"
                    placeholder="文件内容..."
                  />
                  <div className="p-3 border-t text-xs text-gray-500">
                    字符数: {editingFile.file.content.length}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 border-b">
                    <span className="text-sm text-gray-500">只读预览</span>
                    <Button size="sm" onClick={() => handleEditFile(selectedFile)}>
                      <Edit3 className="w-4 h-4 mr-1" />
                      编辑
                    </Button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 bg-gray-50">
                    <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
                      {selectedFile.content}
                    </pre>
                  </div>
                  <div className="p-3 border-t text-xs text-gray-500">
                    字符数: {selectedFile.content.length}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>选择一个文件来预览或编辑</p>
              <p className="text-sm mt-2">
                支持的文件类型：代码文件、配置文件、Markdown 文档、文本文件
                <br />
                <span className="text-xs text-gray-400">自动跳过图片、音频、视频、压缩包等二进制文件</span>
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
