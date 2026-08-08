/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';

import { ReactNode, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';
import { OnchainKitProvider } from '@coinbase/onchainkit';

export default function AppProviders({ children }: { children: ReactNode }) {
    const walletConnectProjectId = (process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '').trim();
    const queryClient = useMemo(() => new QueryClient(), []);
    const wagmiConfig = useMemo(
        () =>
            createConfig({
                chains: [baseSepolia, base],
                connectors: [
                    injected(),
                    coinbaseWallet({ appName: 'BlackIn' }),
                    ...(walletConnectProjectId
                        ? [
                              walletConnect({
                                  projectId: walletConnectProjectId,
                                  showQrModal: true,
                              }),
                          ]
                        : []),
                ],
                transports: {
                    [baseSepolia.id]: http(
                        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
                    ),
                    [base.id]: http(
                        process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
                    ),
                },
            }),
        [walletConnectProjectId],
    );

    type OnchainKitProviderProps = {
        children: ReactNode;
        apiKey?: string;
        chain?: unknown;
    };
    const OnchainKitProviderComponent =
        OnchainKitProvider as unknown as React.ComponentType<OnchainKitProviderProps>;

    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <OnchainKitProviderComponent
                    apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
                    chain={baseSepolia}
                >
                    {children}
                </OnchainKitProviderComponent>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
