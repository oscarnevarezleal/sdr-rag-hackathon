import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import MultiFileUpload from './components/MultiFileUpload';
import ChatInterface from './components/ChatInterface';
import ProcessingIndicator from './components/ProcessingIndicator';
import MultiProcessingIndicator from './components/MultiProcessingIndicator';
import ConversationSidebar from './components/ConversationSidebar';
import { useFileUpload } from './hooks/useFileUpload';
import { useMultiFileUpload } from './hooks/useMultiFileUpload';
import { useChat } from './hooks/useChat';
import { useConversationHistory } from './hooks/useConversationHistory';
import { Layers, File } from 'lucide-react';

function App() {
  const { uploadFile } = useFileUpload();
  const { uploadFiles } = useMultiFileUpload();
  const { isTyping, sendMessage } = useChat();
  const {
    conversations,
    activeConversationId,
    activeConversation,
    createConversation,
    deleteConversation,
    addMessage,
    updateUploadState,
    updateMultiUploadState,
    switchConversation
  } = useConversationHistory();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationLocked, setConversationLocked] = useState(false);
  const [uploadMode, setUploadMode] = useState<'single' | 'multi'>('single');

  // Lock conversation during processing
  useEffect(() => {
    if (activeConversation) {
      const singleFileProcessing = activeConversation.uploadState.status === 'uploading' || 
                                  activeConversation.uploadState.status === 'processing';
      const multiFileProcessing = activeConversation.multiUploadState?.overallStatus === 'uploading' ||
                                 activeConversation.multiUploadState?.overallStatus === 'processing';
      setConversationLocked(singleFileProcessing || multiFileProcessing);
    }
  }, [activeConversation]);

  const handleFileUpload = async (file: File) => {
    let conversationId = activeConversationId;
    
    // Create new conversation if none exists or current one already has files
    if (!conversationId || 
        activeConversation?.uploadState.file || 
        (activeConversation?.multiUploadState?.files.length || 0) > 0) {
      conversationId = createConversation(file.name);
    }

    // Upload file and update conversation state
    await uploadFile(file, (uploadState) => {
      updateUploadState(conversationId, uploadState);
    });
  };

  const handleMultiFileUpload = async (files: File[]) => {
    let conversationId = activeConversationId;
    
    // Create new conversation if none exists or current one already has files
    if (!conversationId || 
        activeConversation?.uploadState.file || 
        (activeConversation?.multiUploadState?.files.length || 0) > 0) {
      conversationId = createConversation(undefined, files.map(f => f.name));
    }

    // Upload files and update conversation state
    await uploadFiles(files, (multiUploadState) => {
      updateMultiUploadState(conversationId, multiUploadState);
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!activeConversationId) return;

    await sendMessage(
      content,
      (userMessage) => addMessage(activeConversationId, userMessage),
      (assistantMessage) => addMessage(activeConversationId, assistantMessage)
    );
  };

  const handleNewConversation = () => {
    createConversation();
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    switchConversation(id);
    setSidebarOpen(false);
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
  };

  const hasFiles = activeConversation && (
    activeConversation.uploadState.file || 
    (activeConversation.multiUploadState?.files.length || 0) > 0
  );

  const showUpload = !activeConversation || 
                    (activeConversation.uploadState.status === 'idle' && 
                     activeConversation.multiUploadState?.overallStatus === 'idle') || 
                    activeConversation.uploadState.status === 'error' ||
                    activeConversation.multiUploadState?.overallStatus === 'error';

  const showProcessing = activeConversation && (
    (activeConversation.uploadState.status === 'uploading' || 
     activeConversation.uploadState.status === 'processing') ||
    (activeConversation.multiUploadState?.overallStatus === 'uploading' || 
     activeConversation.multiUploadState?.overallStatus === 'processing')
  );

  const showChat = activeConversation && (
    activeConversation.uploadState.status === 'ready' ||
    activeConversation.multiUploadState?.overallStatus === 'ready'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 transition-all ${
          sidebarOpen ? 'ml-80' : 'ml-0'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <h1 className="text-xl font-semibold text-gray-800">DocChat AI</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Upload Mode Toggle */}
              {showUpload && (
                <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setUploadMode('single')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all flex items-center space-x-1 ${
                      uploadMode === 'single'
                        ? 'bg-white text-gray-800 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <File className="w-4 h-4" />
                    <span>Single</span>
                  </button>
                  <button
                    onClick={() => setUploadMode('multi')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all flex items-center space-x-1 ${
                      uploadMode === 'multi'
                        ? 'bg-white text-gray-800 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Multi</span>
                  </button>
                </div>
              )}

              {hasFiles && (
                <button
                  onClick={handleNewConversation}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                >
                  New Session
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all ${
        sidebarOpen ? 'ml-80' : 'ml-0'
      }`}>
        {showUpload && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Chat with Your Documents
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Upload {uploadMode === 'single' ? 'a document' : 'multiple documents'} and start an intelligent conversation. 
                Our AI will analyze your {uploadMode === 'single' ? 'file' : 'files'} and answer questions about the content.
              </p>
            </div>
            
            {uploadMode === 'single' ? (
              <FileUpload 
                onFileUpload={handleFileUpload}
                uploadState={activeConversation?.uploadState || {
                  file: null,
                  status: 'idle',
                  progress: 0
                }}
              />
            ) : (
              <MultiFileUpload
                onFilesUpload={handleMultiFileUpload}
                uploadState={activeConversation?.multiUploadState || {
                  files: [],
                  overallStatus: 'idle',
                  overallProgress: 0,
                  completedCount: 0,
                  totalCount: 0
                }}
              />
            )}
          </div>
        )}

        {showProcessing && (
          <div className="flex items-center justify-center min-h-[60vh]">
            {activeConversation?.multiUploadState?.files.length ? (
              <MultiProcessingIndicator 
                uploadState={activeConversation.multiUploadState}
              />
            ) : (
              <ProcessingIndicator 
                status={activeConversation!.uploadState.status as 'uploading' | 'processing' | 'ready'}
                progress={activeConversation!.uploadState.progress}
                fileName={activeConversation!.uploadState.file?.name}
              />
            )}
          </div>
        )}

        {showChat && (
          <div className="h-[calc(100vh-200px)] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <ChatInterface
              messages={activeConversation!.messages}
              onSendMessage={handleSendMessage}
              isTyping={isTyping}
              conversationLocked={conversationLocked}
              fileName={activeConversation!.uploadState.file?.name}
              fileNames={activeConversation!.fileNames}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;