import { create } from 'zustand';

export type PreviewStatus = 'idle' | 'building' | 'ready' | 'error';

export interface PreviewSession {
    projectId: string;
    status: PreviewStatus;
    url: string | null;
    error: string | null;
    startedAt: string | null;
    updatedAt: string | null;
    revision: number;
}

interface PreviewApiResponse {
    success: boolean;
    message?: string;
    data?: Omit<PreviewSession, 'revision'>;
}

interface PreviewStore {
    sessions: Record<string, PreviewSession>;
    startPreview: (projectId: string) => Promise<PreviewSession>;
    hydratePreview: (projectId: string) => Promise<void>;
    refreshPreview: (projectId: string) => void;
    resetPreview: (projectId: string) => void;
}

const idleSession = (projectId: string): PreviewSession => ({
    projectId,
    status: 'idle',
    url: null,
    error: null,
    startedAt: null,
    updatedAt: null,
    revision: 0,
});
const EMPTY_PREVIEW_SESSION = idleSession('');
const inFlightPreviewStarts = new Map<string, Promise<PreviewSession>>();

export const usePreviewStore = create<PreviewStore>((set, get) => ({
    sessions: {},

    startPreview: async (projectId) => {
        const inFlight = inFlightPreviewStarts.get(projectId);
        if (inFlight) return inFlight;

        const previous = get().sessions[projectId] ?? idleSession(projectId);
        const request = (async () => {
            set((state) => ({
                sessions: {
                    ...state.sessions,
                    [projectId]: {
                        ...previous,
                        status: 'building',
                        error: null,
                        updatedAt: new Date().toISOString(),
                    },
                },
            }));

            try {
                const response = await fetch(
                    `/api/v1/projects/${encodeURIComponent(projectId)}/preview`,
                    {
                        method: 'POST',
                    },
                );
                const payload = (await response.json()) as PreviewApiResponse;
                if (!response.ok || !payload.data) {
                    throw new Error(payload.message || 'The project preview could not be started');
                }

                const next: PreviewSession = {
                    ...payload.data,
                    revision: previous.revision + 1,
                };
                set((state) => ({
                    sessions: { ...state.sessions, [projectId]: next },
                }));
                return next;
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'The project preview could not be started';
                const failed: PreviewSession = {
                    ...previous,
                    status: 'error',
                    error: message,
                    updatedAt: new Date().toISOString(),
                };
                set((state) => ({
                    sessions: { ...state.sessions, [projectId]: failed },
                }));
                throw error;
            }
        })();

        inFlightPreviewStarts.set(projectId, request);
        try {
            return await request;
        } finally {
            if (inFlightPreviewStarts.get(projectId) === request) {
                inFlightPreviewStarts.delete(projectId);
            }
        }
    },

    hydratePreview: async (projectId) => {
        try {
            const response = await fetch(
                `/api/v1/projects/${encodeURIComponent(projectId)}/preview`,
                { cache: 'no-store' },
            );
            if (!response.ok) return;
            const payload = (await response.json()) as PreviewApiResponse;
            if (!payload.data) return;
            const previewData = payload.data;
            set((state) => ({
                sessions: {
                    ...state.sessions,
                    [projectId]: {
                        ...previewData,
                        revision: state.sessions[projectId]?.revision ?? 0,
                    },
                },
            }));
        } catch {
            // The preview is optional; the user can start it explicitly if hydration fails.
        }
    },

    refreshPreview: (projectId) =>
        set((state) => {
            const current = state.sessions[projectId];
            if (!current) return state;
            return {
                sessions: {
                    ...state.sessions,
                    [projectId]: { ...current, revision: current.revision + 1 },
                },
            };
        }),

    resetPreview: (projectId) =>
        set((state) => ({
            sessions: { ...state.sessions, [projectId]: idleSession(projectId) },
        })),
}));

export function selectPreviewSession(projectId: string | undefined) {
    return (state: PreviewStore) =>
        projectId ? (state.sessions[projectId] ?? EMPTY_PREVIEW_SESSION) : EMPTY_PREVIEW_SESSION;
}
