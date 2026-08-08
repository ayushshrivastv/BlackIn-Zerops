/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

import { GET_CHAT_URL } from '@/routes/api_routes';
import { useBuilderChatStore } from '@/src/store/code/useBuilderChatStore';
import { useCodeEditor } from '@/src/store/code/useCodeEditor';
import axios from 'axios';

export type PersistedGenerationState = 'pending' | 'complete' | 'error';

interface PersistedMessage {
    id: string;
    role: string;
    stage?: string;
    createdAt: string | Date;
}

export interface ChatHydrationResult {
    generationState: PersistedGenerationState;
    hasFiles: boolean;
}

export default class Playground {
    static async get_chat(contractId: string): Promise<ChatHydrationResult> {
        const { upsertMessage } = useBuilderChatStore.getState();
        const { parseFileStructure, setCollapseFileTree } = useCodeEditor.getState();
        try {
            const { data } = await axios.post(GET_CHAT_URL, {
                contractId: contractId,
            });

            const sortedMessages = [...data.data.messages].sort((a, b) => {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });

            for (let i = 0; i < sortedMessages.length; i++) {
                upsertMessage(sortedMessages[i]);
            }
            const serializedFiles = data.data.contractFiles || data.data.templateFiles;
            const parsedFiles = serializedFiles ? JSON.parse(serializedFiles) : [];
            if (Array.isArray(parsedFiles) && parsedFiles.length > 0) {
                parseFileStructure(parsedFiles);
            }
            setCollapseFileTree(true);
            return {
                generationState: getPersistedGenerationState(sortedMessages),
                hasFiles: Array.isArray(parsedFiles) && parsedFiles.length > 0,
            };
        } catch (error) {
            console.error('Error while fetching chats from server: ', error);
            return { generationState: 'pending', hasFiles: false };
        }
    }

    static async get_generation_state(
        contractId: string,
        expectedUserMessageId?: string,
    ): Promise<PersistedGenerationState> {
        try {
            const { data } = await axios.post(GET_CHAT_URL, { contractId });
            return getPersistedGenerationState(
                data.data.messages as PersistedMessage[],
                expectedUserMessageId,
            );
        } catch (error) {
            console.warn('Unable to reconcile generation state:', error);
            return 'pending';
        }
    }
}

export function getPersistedGenerationState(
    messages: PersistedMessage[],
    expectedUserMessageId?: string,
): PersistedGenerationState {
    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const userMessageIndex = expectedUserMessageId
        ? sortedMessages.findIndex((message) => message.id === expectedUserMessageId)
        : sortedMessages.findLastIndex((message) => message.role === 'USER');

    if (userMessageIndex < 0) return 'pending';

    const latestTerminalMessage = sortedMessages
        .slice(userMessageIndex + 1)
        .reverse()
        .find(
            (message) =>
                message.stage === 'ERROR' || (message.role === 'AI' && message.stage === 'END'),
        );

    if (!latestTerminalMessage) return 'pending';
    return latestTerminalMessage.stage === 'ERROR' ? 'error' : 'complete';
}
