import { useState, useCallback, useEffect } from 'react';
import { Conversation, Message, FileUploadState, MultiFileUploadState } from '../types';

const STORAGE_KEY = 'docChat_conversations';

export function useConversationHistory() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const conversationsWithDates = parsed.map((conv: Conversation) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg: Message) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        setConversations(conversationsWithDates);
        
        // Set active conversation to the most recent one
        if (conversationsWithDates.length > 0) {
          const mostRecent = conversationsWithDates.sort((a: Conversation, b: Conversation) => 
            b.updatedAt.getTime() - a.updatedAt.getTime()
          )[0];
          setActiveConversationId(mostRecent.id);
        }
      } catch (error) {
        console.error('Failed to load conversations from localStorage:', error);
      }
    }
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations]);

  const createConversation = useCallback((fileName?: string, fileNames?: string[]): string => {
    const now = new Date();
    let title = 'New Conversation';
    
    if (fileNames && fileNames.length > 0) {
      title = fileNames.length === 1 
        ? `Chat with ${fileNames[0]}`
        : `Chat with ${fileNames.length} files`;
    } else if (fileName) {
      title = `Chat with ${fileName}`;
    }

    const newConversation: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      fileName,
      fileNames,
      messages: [],
      uploadState: {
        file: null,
        status: 'idle',
        progress: 0
      },
      multiUploadState: {
        files: [],
        overallStatus: 'idle',
        overallProgress: 0,
        completedCount: 0,
        totalCount: 0
      },
      createdAt: now,
      updatedAt: now
    };

    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    return newConversation.id;
  }, []);

  const updateConversation = useCallback((
    conversationId: string, 
    updates: Partial<Omit<Conversation, 'id' | 'createdAt'>>
  ) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, ...updates, updatedAt: new Date() }
        : conv
    ));
  }, []);

  const deleteConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    
    // If we're deleting the active conversation, switch to another one
    if (activeConversationId === conversationId) {
      setConversations(current => {
        const remaining = current.filter(conv => conv.id !== conversationId);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          setActiveConversationId(null);
        }
        return remaining;
      });
    }
  }, [activeConversationId]);

  const addMessage = useCallback((conversationId: string, message: Message) => {
    updateConversation(conversationId, {
      messages: [...(conversations.find(c => c.id === conversationId)?.messages || []), message]
    });
  }, [conversations, updateConversation]);

  const updateUploadState = useCallback((conversationId: string, uploadState: FileUploadState) => {
    updateConversation(conversationId, { uploadState });
  }, [updateConversation]);

  const updateMultiUploadState = useCallback((conversationId: string, multiUploadState: MultiFileUploadState) => {
    updateConversation(conversationId, { multiUploadState });
  }, [updateConversation]);

  const getActiveConversation = useCallback((): Conversation | null => {
    return conversations.find(conv => conv.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const switchConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, []);

  return {
    conversations,
    activeConversationId,
    activeConversation: getActiveConversation(),
    createConversation,
    updateConversation,
    deleteConversation,
    addMessage,
    updateUploadState,
    updateMultiUploadState,
    switchConversation
  };
}