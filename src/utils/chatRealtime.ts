import type { ChatMessage } from '@/services/chatService';

const MEMBERSHIP_ACTIONS = new Set([
  'ADD_MEMBER',
  'REMOVE_MEMBER',
  'LEAVE_GROUP',
  'SET_ADMIN',
  'REMOVE_ADMIN',
]);

export const getChatSystemAction = (message?: Pick<ChatMessage, 'isSystem' | 'systemMetadata'>): string => {
  if (!message?.isSystem) return '';
  let metadata = message.systemMetadata || {};
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      return '';
    }
  }
  return typeof metadata?.action === 'string' ? metadata.action : '';
};

export const isChatMembershipSystemMessage = (
  message?: Pick<ChatMessage, 'isSystem' | 'systemMetadata'>
): boolean => MEMBERSHIP_ACTIONS.has(getChatSystemAction(message));

