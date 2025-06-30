import React, { useState } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Clock,
  Files
} from 'lucide-react';
import { Conversation } from '../types';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isOpen,
  onToggle
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.fileNames?.some(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getConversationIcon = (conversation: Conversation) => {
    const hasMultipleFiles = conversation.fileNames && conversation.fileNames.length > 1;
    const hasSingleFile = conversation.fileName || (conversation.fileNames && conversation.fileNames.length === 1);
    
    if (hasMultipleFiles) {
      return <Files className="w-4 h-4 text-purple-600" />;
    } else if (hasSingleFile) {
      return <FileText className="w-4 h-4 text-green-600" />;
    } else {
      return <MessageSquare className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConversationBgColor = (conversation: Conversation) => {
    const hasMultipleFiles = conversation.fileNames && conversation.fileNames.length > 1;
    const hasSingleFile = conversation.fileName || (conversation.fileNames && conversation.fileNames.length === 1);
    
    if (hasMultipleFiles) {
      return 'bg-purple-100';
    } else if (hasSingleFile) {
      return 'bg-green-100';
    } else {
      return 'bg-gray-100';
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="fixed top-20 left-4 z-20 bg-white rounded-lg shadow-md border border-gray-200 p-2 hover:bg-gray-50 transition-all"
      >
        {isOpen ? (
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 shadow-lg transition-transform duration-300 z-20 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } w-80`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Conversations</h2>
              <button
                onClick={onNewConversation}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                title="New Conversation"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
                {!searchQuery && (
                  <p className="text-xs mt-1">Upload files to start chatting</p>
                )}
              </div>
            ) : (
              <div className="p-2">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`group relative p-3 rounded-lg cursor-pointer transition-all mb-2 ${
                      activeConversationId === conversation.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        getConversationBgColor(conversation)
                      }`}>
                        {getConversationIcon(conversation)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-800 text-sm truncate">
                          {conversation.title}
                        </h3>
                        
                        {/* File count indicator for multi-file conversations */}
                        {conversation.fileNames && conversation.fileNames.length > 1 && (
                          <p className="text-xs text-purple-600 mt-1">
                            {conversation.fileNames.length} files
                          </p>
                        )}
                        
                        {conversation.messages.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {conversation.messages[conversation.messages.length - 1].content}
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-2 mt-2">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">
                            {formatDate(conversation.updatedAt)}
                          </span>
                          <span className="text-xs text-gray-400">
                            • {conversation.messages.length} messages
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conversation.id);
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 z-5"
          onClick={onToggle}
        />
      )}
    </>
  );
}