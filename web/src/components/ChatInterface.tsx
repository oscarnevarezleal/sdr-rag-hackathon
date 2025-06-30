import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Lock } from 'lucide-react';
import MessageBubble from './MessageBubble';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isTyping: boolean;
  conversationLocked: boolean;
  fileName?: string;
  fileNames?: string[];
}

export default function ChatInterface({ 
  messages, 
  onSendMessage, 
  isTyping, 
  conversationLocked,
  fileName,
  fileNames
}: ChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !conversationLocked && !isTyping) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getHeaderTitle = () => {
    if (fileNames && fileNames.length > 0) {
      return fileNames.length === 1 
        ? `Chatting with ${fileNames[0]}`
        : `Chatting with ${fileNames.length} documents`;
    }
    if (fileName) {
      return `Chatting with ${fileName}`;
    }
    return 'Ready to Chat';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {getHeaderTitle()}
        </h2>
        {fileNames && fileNames.length > 1 && (
          <div className="mt-2">
            <p className="text-sm text-gray-600">Documents:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {fileNames.slice(0, 3).map((name, index) => (
                <span key={index} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {name}
                </span>
              ))}
              {fileNames.length > 3 && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  +{fileNames.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
        {conversationLocked && (
          <div className="flex items-center space-x-2 mt-2 text-sm text-amber-600">
            <Lock className="w-4 h-4" />
            <span>Processing files... Chat will be available shortly</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {messages.length === 0 && !conversationLocked && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">👋 Start the conversation!</p>
            <p>Ask me anything about your uploaded {fileNames && fileNames.length > 1 ? 'documents' : 'document'}.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {isTyping && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">AI</span>
            </div>
            <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin ml-2" />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={conversationLocked ? "Processing files..." : "Type your message..."}
              disabled={conversationLocked || isTyping}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!inputMessage.trim() || conversationLocked || isTyping}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
          >
            {isTyping ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}