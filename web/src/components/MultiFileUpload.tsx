import React, { useCallback, useState } from 'react';
import { Upload, File, CheckCircle, AlertCircle, Loader2, X, FileText } from 'lucide-react';
import { MultiFileUploadState } from '../types';

interface MultiFileUploadProps {
  onFilesUpload: (files: File[]) => void;
  uploadState: MultiFileUploadState;
  maxFiles?: number;
}

export default function MultiFileUpload({ 
  onFilesUpload, 
  uploadState, 
  maxFiles = 10 
}: MultiFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).slice(0, maxFiles);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, [maxFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files).slice(0, maxFiles);
      setSelectedFiles(fileArray);
    }
  }, [maxFiles]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(() => {
    if (selectedFiles.length > 0) {
      onFilesUpload(selectedFiles);
      setSelectedFiles([]);
    }
  }, [selectedFiles, onFilesUpload]);

  const getOverallStatusIcon = () => {
    switch (uploadState.overallStatus) {
      case 'uploading':
        return <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />;
      case 'processing':
        return <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />;
      case 'ready':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />;
    }
  };

  const getOverallStatusText = () => {
    switch (uploadState.overallStatus) {
      case 'uploading':
        return `Uploading files... (${uploadState.completedCount}/${uploadState.totalCount})`;
      case 'processing':
        return `Processing documents... (${uploadState.completedCount}/${uploadState.totalCount})`;
      case 'ready':
        return `Ready to chat with ${uploadState.totalCount} document${uploadState.totalCount > 1 ? 's' : ''}`;
      case 'error':
        return 'Some files failed to upload';
      default:
        return selectedFiles.length > 0 
          ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
          : 'Drop your files here or click to browse';
    }
  };

  const getBorderColor = () => {
    if (isDragOver) return 'border-blue-400 bg-blue-50';
    switch (uploadState.overallStatus) {
      case 'uploading':
        return 'border-blue-300 bg-blue-50';
      case 'processing':
        return 'border-amber-300 bg-amber-50';
      case 'ready':
        return 'border-green-300 bg-green-50';
      case 'error':
        return 'border-red-300 bg-red-50';
      default:
        return 'border-gray-300 hover:border-blue-400 hover:bg-blue-50';
    }
  };

  const isUploading = uploadState.overallStatus === 'uploading' || uploadState.overallStatus === 'processing';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${getBorderColor()} group cursor-pointer`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && document.getElementById('multi-file-input')?.click()}
      >
        <input
          id="multi-file-input"
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.txt,.md"
          multiple
          disabled={isUploading}
        />
        
        <div className="flex flex-col items-center space-y-4">
          {getOverallStatusIcon()}
          
          <div>
            <p className="text-lg font-medium text-gray-700 mb-2">
              {getOverallStatusText()}
            </p>
            
            {uploadState.overallStatus === 'idle' && (
              <p className="text-sm text-gray-500">
                Supports PDF, DOC, DOCX, TXT, and MD files (max {maxFiles} files)
              </p>
            )}
          </div>
          
          {(uploadState.overallStatus === 'uploading' || uploadState.overallStatus === 'processing') && (
            <div className="w-full max-w-md">
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    uploadState.overallStatus === 'uploading' ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${uploadState.overallProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">{uploadState.overallProgress}% Complete</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && uploadState.overallStatus === 'idle' && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-800">
              Selected Files ({selectedFiles.length})
            </h3>
            <button
              onClick={handleUpload}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Files</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress Details */}
      {uploadState.files.length > 0 && isUploading && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Upload Progress</h3>
          <div className="space-y-3">
            {uploadState.files.map((fileItem) => (
              <div key={fileItem.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  {fileItem.status === 'ready' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {fileItem.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {(fileItem.status === 'uploading' || fileItem.status === 'processing') && (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                  {fileItem.status === 'pending' && <File className="w-5 h-5 text-gray-400" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{fileItem.file.name}</p>
                    <span className="text-xs text-gray-500">{fileItem.progress}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        fileItem.status === 'ready' ? 'bg-green-500' :
                        fileItem.status === 'error' ? 'bg-red-500' :
                        fileItem.status === 'processing' ? 'bg-amber-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${fileItem.progress}%` }}
                    />
                  </div>
                  
                  {fileItem.error && (
                    <p className="text-xs text-red-500 mt-1">{fileItem.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Files Summary */}
      {uploadState.overallStatus === 'ready' && uploadState.files.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-medium text-green-800">Upload Complete!</h3>
          </div>
          <p className="text-sm text-green-700">
            Successfully processed {uploadState.completedCount} file{uploadState.completedCount > 1 ? 's' : ''}. 
            You can now start chatting with your documents.
          </p>
        </div>
      )}
    </div>
  );
}