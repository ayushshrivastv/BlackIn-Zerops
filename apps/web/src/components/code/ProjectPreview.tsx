'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    AlertCircle,
    Code2,
    ExternalLink,
    LoaderCircle,
    MonitorPlay,
    RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/button';
import ToolTipComponent from '../ui/TooltipComponent';
import { SidePanelValues } from '@/src/types/side-panel';
import { useSidePanelStore } from '@/src/store/code/useSidePanelStore';
import { selectPreviewSession, usePreviewStore } from '@/src/store/code/usePreviewStore';

export default function ProjectPreview() {
    const params = useParams<{ contractId?: string | string[] }>();
    const contractId = Array.isArray(params?.contractId)
        ? params.contractId[0]
        : params?.contractId;
    const session = usePreviewStore(selectPreviewSession(contractId));
    const { startPreview, hydratePreview, refreshPreview } = usePreviewStore();
    const setCurrentState = useSidePanelStore((state) => state.setCurrentState);
    const [frameLoading, setFrameLoading] = useState(true);

    useEffect(() => {
        if (!contractId || session.status !== 'idle') return;
        void hydratePreview(contractId);
    }, [contractId, hydratePreview, session.status]);

    useEffect(() => {
        if (session.status === 'ready') setFrameLoading(true);
    }, [session.revision, session.status]);

    async function handleStart() {
        if (!contractId) return;
        try {
            await startPreview(contractId);
        } catch {
            // The store exposes the inline recovery state.
        }
    }

    function handleOpenNewTab() {
        if (!session.url) return;
        window.open(`${session.url}?revision=${session.revision}`, '_blank', 'noopener,noreferrer');
    }

    if (session.status === 'building') {
        return (
            <PreviewStateShell>
                <LoaderCircle className="size-7 animate-spin text-[#8fb7ff] motion-reduce:animate-none" />
                <div className="space-y-1 text-center">
                    <p className="text-sm font-medium text-neutral-100">Starting project preview</p>
                    <p className="max-w-sm text-xs leading-5 text-neutral-400">
                        Compiling the generated client in the controlled runtime.
                    </p>
                </div>
            </PreviewStateShell>
        );
    }

    if (session.status === 'error') {
        return (
            <PreviewStateShell>
                <AlertCircle className="size-7 text-red-400" />
                <div className="space-y-1 text-center">
                    <p className="text-sm font-medium text-neutral-100">Preview did not start</p>
                    <p className="max-w-md text-xs leading-5 text-neutral-400">{session.error}</p>
                </div>
                <Button
                    type="button"
                    onClick={handleStart}
                    className="min-h-10 rounded-[6px] bg-neutral-100 px-4 text-xs font-semibold text-neutral-950 hover:bg-white"
                >
                    <RefreshCw className="mr-2 size-4" />
                    Try again
                </Button>
            </PreviewStateShell>
        );
    }

    if (session.status !== 'ready' || !session.url) {
        return (
            <PreviewStateShell>
                <MonitorPlay className="size-8 text-neutral-500" />
                <div className="space-y-1 text-center">
                    <p className="text-sm font-medium text-neutral-100">
                        Run your generated project
                    </p>
                    <p className="max-w-sm text-xs leading-5 text-neutral-400">
                        Start an interactive browser preview without leaving the playground.
                    </p>
                </div>
                <Button
                    type="button"
                    onClick={handleStart}
                    className="min-h-10 rounded-[6px] bg-neutral-100 px-4 text-xs font-semibold text-neutral-950 hover:bg-white"
                >
                    <MonitorPlay className="mr-2 size-4" />
                    Start preview
                </Button>
            </PreviewStateShell>
        );
    }

    const frameUrl = `${session.url}?revision=${session.revision}`;

    return (
        <div className="flex h-full min-h-0 w-full flex-col bg-[#121318]">
            <div className="flex min-h-11 items-center justify-between border-b border-neutral-800 bg-[#121318] px-3 text-neutral-300">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                    <span
                        className="size-2 shrink-0 rounded-full bg-emerald-400"
                        aria-hidden="true"
                    />
                    <span className="truncate font-medium">Local preview</span>
                    <span className="hidden text-neutral-500 md:inline">Running</span>
                </div>
                <div className="flex items-center gap-1">
                    <ToolTipComponent content="Back to code" side="bottom">
                        <button
                            type="button"
                            onClick={() => setCurrentState(SidePanelValues.FILE)}
                            aria-label="Back to code"
                            className="inline-flex size-10 items-center justify-center rounded-[6px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white focus-visible:ring-2 focus-visible:ring-[#8fb7ff]"
                        >
                            <Code2 className="size-4" />
                        </button>
                    </ToolTipComponent>
                    <ToolTipComponent content="Refresh preview" side="bottom">
                        <button
                            type="button"
                            onClick={() => contractId && refreshPreview(contractId)}
                            aria-label="Refresh preview"
                            className="inline-flex size-10 items-center justify-center rounded-[6px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white focus-visible:ring-2 focus-visible:ring-[#8fb7ff]"
                        >
                            <RefreshCw className="size-4" />
                        </button>
                    </ToolTipComponent>
                    <ToolTipComponent content="Open preview in new tab" side="bottom">
                        <button
                            type="button"
                            onClick={handleOpenNewTab}
                            aria-label="Open preview in new tab"
                            className="inline-flex size-10 items-center justify-center rounded-[6px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white focus-visible:ring-2 focus-visible:ring-[#8fb7ff]"
                        >
                            <ExternalLink className="size-4" />
                        </button>
                    </ToolTipComponent>
                </div>
            </div>

            <div className="relative min-h-0 flex-1 bg-white">
                {frameLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#101114] text-neutral-400">
                        <div className="flex items-center gap-2 text-xs">
                            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                            Loading preview
                        </div>
                    </div>
                )}
                <iframe
                    key={frameUrl}
                    src={frameUrl}
                    title="Generated project preview"
                    sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-scripts"
                    onLoad={() => setFrameLoading(false)}
                    className="h-full w-full border-0 bg-white"
                />
            </div>
        </div>
    );
}

function PreviewStateShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#121318] px-6 text-neutral-200">
            {children}
        </div>
    );
}
