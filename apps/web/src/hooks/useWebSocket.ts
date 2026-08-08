/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

import { useEffect, useRef, useState } from 'react';
import WebSocketClient, { MessageHandler } from '../class/socket.client';
import { cleanWebSocketClient, getWebSocketClient } from '../lib/singletonWebSocket';
import { useParams } from 'next/navigation';
import { COMMAND } from '@lighthouse/types';
import { COMMAND_WRITER } from '../lib/terminal_commands';

export const useWebSocket = () => {
    const socket = useRef<WebSocketClient | null>(null);
    const params = useParams();
    const contractId = params?.contractId as string | undefined;
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!contractId) return;

        let interval: NodeJS.Timeout | null = null;

        try {
            socket.current = getWebSocketClient('public-access', contractId);
            if (!socket.current) {
                setIsConnected(false);
                return;
            }

            interval = setInterval(() => {
                if (socket.current) {
                    setIsConnected(socket.current.is_connected ?? false);
                }
            }, 250);
        } catch (err) {
            console.error('Failed to initialize WS:', err);
            setIsConnected(false);
        }

        return () => {
            if (interval) clearInterval(interval);
            setIsConnected(false);
            socket.current = null;
            cleanWebSocketClient();
        };
    }, [contractId]);

    function subscribeToHandler(handler: MessageHandler) {
        if (!socket.current) {
            return () => undefined;
        }
        socket.current.subscribe(handler);
        return () => socket.current?.unsubscribe(handler);
    }

    function sendSocketMessage(command: COMMAND, message: COMMAND_WRITER) {
        if (!socket.current) return;

        socket.current.send_message({
            type: command,
            payload: {
                contractName: '',
                message: `executing ${message}`,
            },
        });
    }

    return {
        isConnected,
        socket,
        subscribeToHandler,
        sendSocketMessage,
    };
};
