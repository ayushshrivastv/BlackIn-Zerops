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

export default class Playground {
    static async get_chat(contractId: string) {
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
            const parsedFiles = JSON.parse(data.data.contractFiles || data.data.templateFiles);
            if (parsedFiles) {
                parseFileStructure(parsedFiles);
            }
            setCollapseFileTree(true);
        } catch (error) {
            console.error('Error while fetching chats from server: ', error);
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
