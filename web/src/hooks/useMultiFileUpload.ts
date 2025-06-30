import { useCallback } from 'react';
import { MultiFileUploadState, FileUploadItem } from '../types';

export function useMultiFileUpload() {
  const uploadFiles = useCallback(async (
    files: File[],
    onStateChange: (state: MultiFileUploadState) => void
  ) => {
    const fileItems: FileUploadItem[] = files.map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      progress: 0
    }));

    const initialState: MultiFileUploadState = {
      files: fileItems,
      overallStatus: 'uploading',
      overallProgress: 0,
      completedCount: 0,
      totalCount: files.length
    };

    onStateChange(initialState);

    try {
      for (let i = 0; i < fileItems.length; i++) {
        const fileItem = fileItems[i];
        
        fileItems[i] = { ...fileItem, status: 'uploading' };
        onStateChange({
          ...initialState,
          files: [...fileItems],
          overallProgress: Math.round((i / files.length) * 100)
        });

        const response = await fetch(import.meta.env.VITE_UPLOAD_API_URL || '/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-File-Name': fileItem.file.name,
          },
          body: fileItem.file,
        });

        if (!response.ok) {
          throw new Error(`File ${fileItem.file.name} upload failed`);
        }

        fileItems[i] = { ...fileItem, status: 'processing', progress: 50 };
        onStateChange({
          ...initialState,
          files: [...fileItems],
          overallStatus: 'processing'
        });

        await new Promise(resolve => setTimeout(resolve, 1000)); 

        fileItems[i] = { ...fileItem, status: 'ready', progress: 100 };
        initialState.completedCount = i + 1;
        
        onStateChange({
          ...initialState,
          files: [...fileItems],
          overallProgress: Math.round(((i + 1) / files.length) * 100),
          overallStatus: i === files.length - 1 ? 'ready' : 'processing'
        });
      }

    } catch (error) {
      const errorState: MultiFileUploadState = {
        ...initialState,
        overallStatus: 'error',
        files: fileItems.map(item => 
          item.status === 'uploading' || item.status === 'processing'
            ? { ...item, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' } // Use error from catch block
            : item
        )
      };
      onStateChange(errorState);
    }
  }, []);

  return {
    uploadFiles
  };
}