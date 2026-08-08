/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { GitCompareArrows, LoaderCircle, MonitorPlay } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import ToolTipComponent from '../ui/TooltipComponent';
import { useCurrentContract } from '@/src/hooks/useCurrentContract';
import { useCodeEditor } from '@/src/store/code/useCodeEditor';
import { useSidePanelStore } from '@/src/store/code/useSidePanelStore';
import { selectPreviewSession, usePreviewStore } from '@/src/store/code/usePreviewStore';
import { SidePanelValues } from '../code/EditorSidePanel';
import { FileNode, NODE } from '@lighthouse/types';

export default function RightPanelActions() {
    const [showDiffPanel, setShowDiffPanel] = useState(false);
    const diffPanelRef = useRef<HTMLDivElement | null>(null);
    const { loading } = useCurrentContract();
    const { fileTree, originalFileContents } = useCodeEditor();
    const params = useParams<{ contractId?: string | string[] }>();
    const contractId = Array.isArray(params?.contractId)
        ? params.contractId[0]
        : params?.contractId;
    const preview = usePreviewStore(selectPreviewSession(contractId));
    const startPreview = usePreviewStore((state) => state.startPreview);
    const setCurrentState = useSidePanelStore((state) => state.setCurrentState);
    const diffSummary = useMemo(
        () => buildDiffSummary(fileTree, originalFileContents),
        [fileTree, originalFileContents],
    );
    const hasDiffChanges = diffSummary.totalAdded > 0 || diffSummary.totalRemoved > 0;
    const hasProjectFiles = fileTree.some(
        (node) => node.children?.length || node.type === NODE.FILE,
    );
    const isStartingPreview = preview.status === 'building';

    useEffect(() => {
        function handleDismiss(event: MouseEvent | KeyboardEvent) {
            if (event instanceof KeyboardEvent && event.key === 'Escape') {
                setShowDiffPanel(false);
                return;
            }
            if (
                event instanceof MouseEvent &&
                diffPanelRef.current &&
                !diffPanelRef.current.contains(event.target as Node)
            ) {
                setShowDiffPanel(false);
            }
        }
        if (showDiffPanel) {
            document.addEventListener('mousedown', handleDismiss);
            document.addEventListener('keydown', handleDismiss);
        }
        return () => {
            document.removeEventListener('mousedown', handleDismiss);
            document.removeEventListener('keydown', handleDismiss);
        };
    }, [showDiffPanel]);

    async function handleDeploy() {
        if (!contractId || !hasProjectFiles || loading || isStartingPreview) return;
        setCurrentState(SidePanelValues.PREVIEW);
        if (preview.status === 'ready') return;
        try {
            await startPreview(contractId);
            toast.success('Interactive preview is running');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Preview failed to start');
        }
    }

    const deployTooltip = !hasProjectFiles
        ? 'Generate a project to enable preview'
        : preview.status === 'ready'
          ? 'View running project'
          : 'Run project preview';

    return (
        <div className="pointer-events-auto flex items-center justify-end gap-2">
            <div className="relative" ref={diffPanelRef}>
                <ToolTipComponent content="View repo changes" side="bottom">
                    <button
                        type="button"
                        onClick={() => setShowDiffPanel((current) => !current)}
                        aria-label="Toggle differences panel"
                        aria-expanded={showDiffPanel}
                        className="inline-flex size-10 items-center justify-center rounded-[6px] text-light/70 transition-colors hover:bg-neutral-900 hover:text-light focus-visible:ring-2 focus-visible:ring-[#8fb7ff]"
                    >
                        <GitCompareArrows className="size-4" />
                    </button>
                </ToolTipComponent>

                {showDiffPanel && (
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-[8px] border border-neutral-800 bg-[#090a0b] p-3 shadow-lg">
                        <div className="flex items-center gap-2 text-xs font-medium text-light/90">
                            <GitCompareArrows className="size-4 text-light/60" />
                            Repository changes
                        </div>
                        {hasDiffChanges ? (
                            <p className="mt-2 pl-6 text-xs">
                                <span className="text-emerald-400">+{diffSummary.totalAdded}</span>
                                <span className="mx-2 text-neutral-600">/</span>
                                <span className="text-red-400">-{diffSummary.totalRemoved}</span>
                            </p>
                        ) : (
                            <p className="mt-2 pl-6 text-xs text-neutral-500">No local changes</p>
                        )}
                    </div>
                )}
            </div>

            <ToolTipComponent content={deployTooltip} side="bottom">
                <Button
                    type="button"
                    disabled={!hasProjectFiles || loading || isStartingPreview}
                    onClick={handleDeploy}
                    aria-busy={isStartingPreview}
                    className="min-h-10 rounded-[6px] bg-light px-3 text-darkest hover:bg-white hover:text-darkest disabled:cursor-not-allowed disabled:opacity-45"
                >
                    {isStartingPreview ? (
                        <LoaderCircle className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                        <MonitorPlay className="mr-2 size-4" />
                    )}
                    <span className="text-xs font-semibold">
                        {isStartingPreview
                            ? 'Starting'
                            : preview.status === 'ready'
                              ? 'Preview'
                              : 'Deploy'}
                    </span>
                </Button>
            </ToolTipComponent>
        </div>
    );
}

interface DiffSummary {
    totalAdded: number;
    totalRemoved: number;
}

function buildDiffSummary(
    fileTree: FileNode[],
    originalFileContents: Record<string, string>,
): DiffSummary {
    const currentFileContents: Record<string, string> = {};
    collectFileContents(fileTree, currentFileContents);
    const allPaths = new Set([
        ...Object.keys(originalFileContents),
        ...Object.keys(currentFileContents),
    ]);
    let totalAdded = 0;
    let totalRemoved = 0;

    for (const filePath of allPaths) {
        const previous = originalFileContents[filePath] ?? '';
        const current = currentFileContents[filePath] ?? '';
        if (previous === current) continue;
        const delta = calculateLineDelta(previous, current);
        totalAdded += delta.added;
        totalRemoved += delta.removed;
    }
    return { totalAdded, totalRemoved };
}

function collectFileContents(nodes: FileNode[], target: Record<string, string>) {
    for (const node of nodes) {
        if (node.type === NODE.FILE) target[node.id] = node.content ?? '';
        if (node.children?.length) collectFileContents(node.children, target);
    }
}

function calculateLineDelta(previous: string, current: string) {
    const previousLines = splitLines(previous);
    const currentLines = splitLines(current);
    const previousCount = new Map<string, number>();
    const currentCount = new Map<string, number>();
    for (const line of previousLines) previousCount.set(line, (previousCount.get(line) ?? 0) + 1);
    for (const line of currentLines) currentCount.set(line, (currentCount.get(line) ?? 0) + 1);
    let common = 0;
    for (const [line, count] of previousCount) {
        common += Math.min(count, currentCount.get(line) ?? 0);
    }
    return {
        added: Math.max(0, currentLines.length - common),
        removed: Math.max(0, previousLines.length - common),
    };
}

function splitLines(content: string) {
    return content ? content.replace(/\r\n/g, '\n').split('\n') : [];
}
