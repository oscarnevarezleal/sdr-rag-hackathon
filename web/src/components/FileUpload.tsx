import React, { useCallback, useState } from 'react';
import { Upload, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  uploadState: {
    file: File | null;
    status: 'idle' | 'uploading' | 'processing' | 'ready' | 'error';
    progress: number;
    error?: string;
  };
}

export default function FileUpload({ onFileUpload, uploadState }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileUpload(files[0]);
    }
  }, [onFileUpload]);

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
    if (files && files.length > 0) {
      onFileUpload(files[0]);
    }
  }, [onFileUpload]);

  const getStatusIcon = () => {
    switch (uploadState.status) {
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

  const getStatusText = () => {
    switch (uploadState.status) {
      case 'uploading':
        return 'Uploading file...';
      case 'processing':
        return 'Processing document...';
      case 'ready':
        return `Ready to chat with ${uploadState.file?.name}`;
      case 'error':
        return uploadState.error || 'Upload failed';
      default:
        return 'Drop your file here or click to browse';
    }
  };

  const getBorderColor = () => {
    if (isDragOver) return 'border-blue-400 bg-blue-50';
    switch (uploadState.status) {
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

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${getBorderColor()} group cursor-pointer`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => uploadState.status === 'idle' && document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.txt,.md"
          disabled={uploadState.status !== 'idle'}
        />
        
        <div className="flex flex-col items-center space-y-4">
          {getStatusIcon()}
          
          <div>
            <p className="text-lg font-medium text-gray-700 mb-2">
              {getStatusText()}
            </p>
            
            {uploadState.status === 'idle' && (
              <p className="text-sm text-gray-500">
                Supports PDF, DOC, DOCX, TXT, and MD files
              </p>
            )}
            
            {uploadState.file && (
              <div className="flex items-center justify-center space-x-2 mt-2 text-sm text-gray-600">
                <File className="w-4 h-4" />
                <span>{uploadState.file.name}</span>
              </div>
            )}
          </div>
          
          {(uploadState.status === 'uploading' || uploadState.status === 'processing') && (
            <div className="w-full max-w-xs">
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    uploadState.status === 'uploading' ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{uploadState.progress}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}