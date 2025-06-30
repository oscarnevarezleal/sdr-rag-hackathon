export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export interface FileUploadState {
  file: File | null;
  status: 'idle' | 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  error?: string;
}

export interface MultiFileUploadState {
  files: FileUploadItem[];
  overallStatus: 'idle' | 'uploading' | 'processing' | 'ready' | 'error';
  overallProgress: number;
  completedCount: number;
  totalCount: number;
}

export interface FileUploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  fileName?: string;
  fileNames?: string[];
  messages: Message[];
  uploadState: FileUploadState;
  multiUploadState?: MultiFileUploadState;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppState {
  conversations: Conversation[];
  activeConversationId: string | null;
  sidebarOpen: boolean;
}