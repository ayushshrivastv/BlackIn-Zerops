/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';
import BuilderChats from './BuilderChats';
import CodeEditor from '../code/CodeEditor';
import BuilderLoader from './BuilderLoader';
import { JSX, useEffect, useRef, useState } from 'react';
import { useCodeEditor } from '@/src/store/code/useCodeEditor';
import { SidePanelValues } from '../code/EditorSidePanel';
import Terminal from '../code/Terminal';
import { useWebSocket } from '@/src/hooks/useWebSocket';
import { useTerminalLogStore } from '@/src/store/code/useTerminalLogStore';
import {
    FileContent,
    FileNode,
    IncomingPayload,
    NODE,
    TerminalSocketData,
    WSServerIncomingPayload,
} from '@lighthouse/types';
import { useSidePanelStore } from '@/src/store/code/useSidePanelStore';
import FileTree from '../code/Filetree';
import PlanPanel from '../code/PlanPanel';
import ProjectPreview from '../code/ProjectPreview';
import { useCurrentContract } from '@/src/hooks/useCurrentContract';
import { cn } from '@/src/lib/utils';
import { shouldEnableDevAccessClient } from '@/src/lib/runtime-mode';
import { useParams } from 'next/navigation';

const PROJECT_PANEL_WIDTH_STORAGE_KEY = 'blackin.playground.projectPanelWidth';
const CHAT_PANEL_WIDTH_STORAGE_KEY = 'blackin.playground.chatPanelWidth';
const DEFAULT_PROJECT_PANEL_WIDTH = 296;
const DEFAULT_CHAT_PANEL_WIDTH = 520;
const MIN_PROJECT_PANEL_WIDTH = 220;
const MIN_CODE_PANEL_WIDTH = 420;
const MIN_CHAT_PANEL_WIDTH = 360;
const DEV_SAMPLE_FILES: FileContent[] = [
    {
        path: 'apps/web/app/page.tsx',
        content:
            "import { ProjectDashboard } from '@/components/project-dashboard';\n\nexport default function HomePage() {\n  return <ProjectDashboard />;\n}\n",
    },
    {
        path: 'apps/web/app/layout.tsx',
        content:
            "import type { Metadata } from 'next';\n\nexport const metadata: Metadata = {\n  title: 'Acme Portal',\n  description: 'A generated Web2 customer workspace.',\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}\n",
    },
    {
        path: 'apps/web/app/api/projects/route.ts',
        content:
            "import { NextResponse } from 'next/server';\n\nconst projects = [\n  { id: 'roadmap', name: 'Roadmap', status: 'Active' },\n  { id: 'billing', name: 'Billing portal', status: 'Draft' },\n];\n\nexport async function GET() {\n  return NextResponse.json({ projects });\n}\n",
    },
    {
        path: 'apps/web/components/project-dashboard.tsx',
        content:
            'export function ProjectDashboard() {\n  return (\n    <main className="min-h-screen bg-slate-50 p-8 text-slate-950">\n      <section className="mx-auto max-w-5xl space-y-6">\n        <div>\n          <p className="text-sm font-medium text-blue-600">Generated workspace</p>\n          <h1 className="text-4xl font-semibold tracking-tight">Customer success portal</h1>\n          <p className="mt-3 max-w-2xl text-slate-600">\n            Track accounts, requests, onboarding tasks, and team activity from one dashboard.\n          </p>\n        </div>\n        <div className="grid gap-4 md:grid-cols-3">\n          {[\'Open requests\', \'Active customers\', \'Tasks shipped\'].map((label, index) => (\n            <article key={label} className="rounded-xl border bg-white p-5 shadow-sm">\n              <p className="text-sm text-slate-500">{label}</p>\n              <p className="mt-2 text-3xl font-semibold">{[18, 42, 127][index]}</p>\n            </article>\n          ))}\n        </div>\n      </section>\n    </main>\n  );\n}\n',
    },
    {
        path: 'apps/web/components/request-list.tsx',
        content:
            'export function RequestList() {\n  return (\n    <div className="rounded-xl border bg-white">\n      <div className="border-b p-4 font-medium">Recent requests</div>\n      <ul className="divide-y text-sm">\n        <li className="p-4">Invite a new teammate</li>\n        <li className="p-4">Review onboarding checklist</li>\n        <li className="p-4">Export monthly account report</li>\n      </ul>\n    </div>\n  );\n}\n',
    },
    {
        path: 'apps/web/lib/projects.ts',
        content:
            "export type ProjectStatus = 'Draft' | 'Active' | 'Archived';\n\nexport interface ProjectSummary {\n  id: string;\n  name: string;\n  status: ProjectStatus;\n}\n",
    },
    {
        path: '.env.example',
        content:
            'NEXT_PUBLIC_APP_URL=http://localhost:3000\nNEXT_PUBLIC_API_URL=http://localhost:3000/api\nDATABASE_URL=\n',
    },
    {
        path: 'README.md',
        content:
            '# BlackIn Web App Demo Workspace\\n\\nThis local preview demonstrates a generated Web2 app with UI components, API routes, and deployment-ready configuration.\\n',
    },
];

export default function BuilderDashboard(): JSX.Element {
    const contract = useCurrentContract();
    const params = useParams();
    const contractId = params?.contractId as string | undefined;
    const { loading } = contract;
    const { collapseChat, livePreviewFilePath } = useCodeEditor();
    const activePanel = useSidePanelStore((state) => state.currentState);
    const { isConnected, subscribeToHandler } = useWebSocket();
    const { addLog, setLogs, setIsCommandRunning, setTerminalLoader } = useTerminalLogStore();
    const chatSplitContainerRef = useRef<HTMLDivElement | null>(null);
    const [chatPanelWidth, setChatPanelWidth] = useState<number>(DEFAULT_CHAT_PANEL_WIDTH);
    const [isResizingChatPanels, setIsResizingChatPanels] = useState<boolean>(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout | null = null;
        function handleIncomingTerminalLogs(message: WSServerIncomingPayload<IncomingPayload>) {
            const payload = message.payload as IncomingPayload | string;
            if (
                typeof payload !== 'string' &&
                payload?.contractId &&
                contractId &&
                payload.contractId !== contractId
            ) {
                return;
            }

            setTerminalLoader(false);
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                setTerminalLoader(true);
            }, 5000);

            if (message.type === TerminalSocketData.EXECUTING_COMMAND) {
                setIsCommandRunning(true);
            }
            if (
                [
                    TerminalSocketData.COMPLETED,
                    TerminalSocketData.ERROR_MESSAGE,
                    TerminalSocketData.BUILD_ERROR,
                    TerminalSocketData.VALIDATION_ERROR,
                ].includes(message.type)
            ) {
                setIsCommandRunning(false);
            }

            const line = typeof payload === 'string' ? payload : payload?.line;
            if (!line) return;

            if (message.type === TerminalSocketData.CONNECTED) {
                setLogs([
                    {
                        type: message.type,
                        text: line,
                    },
                ]);
                setIsCommandRunning(false);
                return;
            }

            addLog({
                type: message.type,
                text: line,
            });
        }

        let unsubscribe: (() => void) | undefined;
        if (isConnected) {
            unsubscribe = subscribeToHandler(handleIncomingTerminalLogs);
        }

        return () => {
            if (timeout) clearTimeout(timeout);
            unsubscribe?.();
        };
    }, [
        addLog,
        contractId,
        isConnected,
        setIsCommandRunning,
        setLogs,
        setTerminalLoader,
        subscribeToHandler,
    ]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const savedWidth = window.localStorage.getItem(CHAT_PANEL_WIDTH_STORAGE_KEY);
        if (!savedWidth) return;
        const parsedWidth = Number(savedWidth);
        if (Number.isNaN(parsedWidth)) return;
        setChatPanelWidth(parsedWidth);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(
            CHAT_PANEL_WIDTH_STORAGE_KEY,
            String(Math.round(chatPanelWidth)),
        );
    }, [chatPanelWidth]);

    useEffect(() => {
        if (collapseChat) return;

        function syncWidthWithinBounds() {
            if (!chatSplitContainerRef.current) return;
            const rect = chatSplitContainerRef.current.getBoundingClientRect();
            setChatPanelWidth((prev) => clampChatPanelWidth(prev, rect.width));
        }

        syncWidthWithinBounds();
        window.addEventListener('resize', syncWidthWithinBounds);
        return () => window.removeEventListener('resize', syncWidthWithinBounds);
    }, [collapseChat]);

    useEffect(() => {
        function handleResizeMove(event: MouseEvent) {
            if (!isResizingChatPanels || !chatSplitContainerRef.current) return;
            const rect = chatSplitContainerRef.current.getBoundingClientRect();
            const rawWidth = event.clientX - rect.left;
            setChatPanelWidth(clampChatPanelWidth(rawWidth, rect.width));
        }

        function handleResizeStop() {
            setIsResizingChatPanels(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        if (isResizingChatPanels) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeStop);
        }

        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeStop);
        };
    }, [isResizingChatPanels]);

    function handleChatResizeStart(event: React.MouseEvent) {
        event.preventDefault();
        setIsResizingChatPanels(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    return (
        <div className="playground-builder-dashboard w-full h-full flex flex-row bg-black z-0 overflow-hidden">
            {!collapseChat && (
                <>
                    <div className="w-full h-full min-h-0 sm:hidden">
                        {activePanel === SidePanelValues.PREVIEW ? <Editing /> : <BuilderChats />}
                    </div>
                    <div
                        ref={chatSplitContainerRef}
                        className="hidden sm:flex sm:flex-1 h-full min-h-0 min-w-0"
                    >
                        <div
                            className="relative h-full min-h-0"
                            style={{ width: `${chatPanelWidth}px` }}
                        >
                            <BuilderChats />
                            <EdgeResizeHandle side="right" onMouseDown={handleChatResizeStart} />
                        </div>
                        <div className="flex flex-1 pt-0 pb-4 pr-4 pl-0 h-full min-h-0 min-w-0">
                            <div className="playground-main-panel w-full h-full min-h-0 z-10 relative border border-neutral-800/90 rounded-[16px] overflow-hidden bg-[#08090a]">
                                {loading && !livePreviewFilePath ? <BuilderLoader /> : <Editing />}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {collapseChat && (
                <div className="hidden sm:flex sm:flex-1 pt-0 pb-4 px-4 h-full min-h-0 min-w-0">
                    <div className="playground-main-panel w-full h-full min-h-0 z-10 relative border-0 rounded-none overflow-visible bg-transparent">
                        {loading && !livePreviewFilePath ? <BuilderLoader /> : <Editing />}
                    </div>
                </div>
            )}
        </div>
    );
}

function Editing() {
    const params = useParams();
    const contractId = params?.contractId as string | undefined;
    const { currentState } = useSidePanelStore();
    const { collapseChat, fileTree, parseFileStructure, selectFile } = useCodeEditor();
    const splitContainerRef = useRef<HTMLDivElement | null>(null);
    const [projectPanelWidth, setProjectPanelWidth] = useState<number>(DEFAULT_PROJECT_PANEL_WIDTH);
    const [isResizingPanels, setIsResizingPanels] = useState<boolean>(false);
    const showDevFileStructure = shouldEnableDevAccessClient() && !contractId;
    const showWorkspaceFileTree = showDevFileStructure || fileTree.length > 0;

    useEffect(() => {
        if (!showDevFileStructure) return;
        if (fileTree.length > 0) return;

        const root = parseFileStructure(DEV_SAMPLE_FILES);
        const firstFile = findFirstFile(root);
        if (firstFile) {
            selectFile(firstFile);
        }
    }, [fileTree.length, parseFileStructure, selectFile, showDevFileStructure]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const savedWidth = window.localStorage.getItem(PROJECT_PANEL_WIDTH_STORAGE_KEY);
        if (!savedWidth) return;
        const parsedWidth = Number(savedWidth);
        if (Number.isNaN(parsedWidth)) return;
        setProjectPanelWidth(parsedWidth);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(
            PROJECT_PANEL_WIDTH_STORAGE_KEY,
            String(Math.round(projectPanelWidth)),
        );
    }, [projectPanelWidth]);

    useEffect(() => {
        if (!collapseChat) return;

        function syncWidthWithinBounds() {
            if (!splitContainerRef.current) return;
            const rect = splitContainerRef.current.getBoundingClientRect();
            setProjectPanelWidth((prev) => clampProjectPanelWidth(prev, rect.width));
        }

        syncWidthWithinBounds();
        window.addEventListener('resize', syncWidthWithinBounds);
        return () => window.removeEventListener('resize', syncWidthWithinBounds);
    }, [collapseChat]);

    useEffect(() => {
        function handleResizeMove(event: MouseEvent) {
            if (!isResizingPanels || !splitContainerRef.current) return;
            const rect = splitContainerRef.current.getBoundingClientRect();
            const rawWidth = event.clientX - rect.left;
            const clampedWidth = clampProjectPanelWidth(rawWidth, rect.width);
            setProjectPanelWidth(clampedWidth);
        }

        function handleResizeStop() {
            setIsResizingPanels(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        if (isResizingPanels) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeStop);
        }

        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeStop);
        };
    }, [isResizingPanels]);

    function handleResizeStart(event: React.MouseEvent) {
        event.preventDefault();
        setIsResizingPanels(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    function renderEditorPanels() {
        switch (currentState) {
            case SidePanelValues.FILE:
                return <CodeEditor />;
            case SidePanelValues.GITHUB:
                return <CodeEditor />;
            case SidePanelValues.PLAN:
                return <PlanPanel />;
            case SidePanelValues.PREVIEW:
                return <ProjectPreview />;
        }
    }

    if (collapseChat && showWorkspaceFileTree) {
        return (
            <div ref={splitContainerRef} className="flex h-full min-h-0 gap-3">
                <div
                    className="playground-split-panel relative h-full min-h-0 rounded-[16px] border border-neutral-800/90 bg-[#08090a] overflow-hidden"
                    style={{ width: `${projectPanelWidth}px` }}
                >
                    <FileTree />
                    <EdgeResizeHandle side="right" onMouseDown={handleResizeStart} />
                </div>

                <div className="playground-split-panel relative min-w-0 flex-1 h-full rounded-[16px] border border-neutral-800/90 bg-[#08090a] overflow-hidden">
                    <EdgeResizeHandle side="left" onMouseDown={handleResizeStart} />
                    {renderEditorPanels()}
                    <Terminal />
                </div>
            </div>
        );
    }

    if (collapseChat) {
        return (
            <div className="playground-split-panel flex h-full min-h-0 rounded-[16px] border border-neutral-800/90 bg-[#08090a] overflow-hidden">
                {renderEditorPanels()}
                <Terminal />
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 rounded-[16px] overflow-hidden">
            {renderEditorPanels()}
            <Terminal />
        </div>
    );
}

interface EdgeResizeHandleProps {
    side: 'left' | 'right';
    onMouseDown: (event: React.MouseEvent) => void;
}

function EdgeResizeHandle({ side, onMouseDown }: EdgeResizeHandleProps) {
    return (
        <button
            type="button"
            aria-label="Resize panels"
            onMouseDown={onMouseDown}
            className={cn(
                'group absolute top-0 bottom-0 z-20 w-4 cursor-col-resize touch-none',
                side === 'left' ? '-left-2' : '-right-2',
            )}
        >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full bg-neutral-600/0 transition-colors group-hover:bg-neutral-500/90 group-focus-visible:bg-neutral-500/90" />
        </button>
    );
}

function clampProjectPanelWidth(width: number, totalWidth: number) {
    const maxProjectWidth = Math.max(MIN_PROJECT_PANEL_WIDTH, totalWidth - MIN_CODE_PANEL_WIDTH);
    return Math.min(Math.max(width, MIN_PROJECT_PANEL_WIDTH), maxProjectWidth);
}

function clampChatPanelWidth(width: number, totalWidth: number) {
    const maxChatWidth = Math.max(MIN_CHAT_PANEL_WIDTH, totalWidth - MIN_CODE_PANEL_WIDTH);
    return Math.min(Math.max(width, MIN_CHAT_PANEL_WIDTH), maxChatWidth);
}

function findFirstFile(node: FileNode): FileNode | null {
    if (node.type === NODE.FILE) return node;
    if (!node.children || node.children.length === 0) return null;

    for (const child of node.children) {
        const result = findFirstFile(child);
        if (result) return result;
    }

    return null;
}
