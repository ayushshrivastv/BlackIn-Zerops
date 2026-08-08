/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

import './globals.css';
import type { Metadata } from 'next';
import AppProviders from '@/src/providers/AppProviders';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
    title: 'BlackIn',
    description:
        'BlackIn is an AI app studio for generating web apps, dashboards, portals, and workflows from a prompt.',
    metadataBase: new URL('https://blackin.dev'),
    openGraph: {
        title: 'BlackIn',
        description:
            'BlackIn is an AI app studio for generating web apps, dashboards, portals, and workflows from a prompt.',
        url: 'https://blackin.dev',
        siteName: 'BlackIn',
        images: [
            {
                url: '/icons/blackin-mark-dark.svg',
                width: 1200,
                height: 630,
                alt: 'BlackIn Preview',
            },
        ],
        type: 'website',
    },

    twitter: {
        card: 'summary_large_image',
        title: 'BlackIn | AI Web App Studio',
        description:
            'BlackIn turns product prompts into editable web app workspaces with generated files, plans, and previews.',
        images: ['/icons/blackin-mark-dark.svg'],
    },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`antialiased bg-darkest`} suppressHydrationWarning>
                <Toaster
                    theme="dark"
                    closeButton
                    visibleToasts={4}
                    toastOptions={{
                        style: {
                            background: '#11161D',
                            color: '#D5DAE2',
                            border: '1px solid #2A3038',
                            borderRadius: '8px',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
                        },
                        classNames: {
                            title: 'text-white font-semibold',
                            description: 'text-gray-300',
                            actionButton: 'bg-primary text-white hover:bg-primary/90',
                            cancelButton: 'bg-[#121314] text-light/70 hover:bg-gray-800',
                        },
                    }}
                />
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
