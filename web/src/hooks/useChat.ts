import { useState, useCallback } from 'react';
import { Message } from '../types';

export function useChat() {
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    content: string,
    onMessageSent: (userMessage: Message) => void,
    onResponseReceived: (assistantMessage: Message) => void
  ) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date()
    };

    onMessageSent(userMessage);
    setIsTyping(true);

    try {
      let url = import.meta.env.VITE_CHAT_API_URL || '/api/chat';
      if (conversationId) {
        url = `${import.meta.env.VITE_CHAT_API_URL || '/api/chat'}/${conversationId}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: content }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      if (!conversationId) {
        setConversationId(data.conversation_id);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        sender: 'assistant',
        timestamp: new Date()
      };

      onResponseReceived(assistantMessage);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsTyping(false);
    }
  }, [conversationId]);

  return {
    isTyping,
    sendMessage,
    conversationId
  };
}
