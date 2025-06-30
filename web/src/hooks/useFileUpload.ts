import { useCallback } from 'react';

interface FileUploadState {
  file: File | null;
  status: 'idle' | 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  error?: string;
}

export function useFileUpload() {
  const uploadFile = useCallback(async (
    file: File,
    onStateChange: (state: FileUploadState) => void
  ) => {
    onStateChange({
      file,
      status: 'uploading',
      progress: 0
    });

    try {
      const response = await fetch(import.meta.env.VITE_UPLOAD_API_URL || '/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': file.name, // Send file name in header
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error('File upload failed');
      }

      onStateChange({
        file,
        status: 'processing',
        progress: 50 // Indicate processing started after upload
      });

      // Simulate processing time after successful upload
      await new Promise(resolve => setTimeout(resolve, 2000)); 

      onStateChange({
        file,
        status: 'ready',
        progress: 100
      });

    } catch (error) {
      onStateChange({
        file,
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    }
  }, []);

  return {
    uploadFile
  };
}