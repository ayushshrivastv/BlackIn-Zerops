import { SidePanelValues } from '@/src/types/side-panel';
import { useBuilderChatStore } from '@/src/store/code/useBuilderChatStore';
import { useCodeEditor } from '@/src/store/code/useCodeEditor';
import { usePreviewStore, type PreviewSession } from '@/src/store/code/usePreviewStore';
import { useSidePanelStore } from '@/src/store/code/useSidePanelStore';
import { PHASE_TYPES } from '@/src/types/stream_event_types';

export async function openProjectPreview(projectId: string): Promise<PreviewSession> {
    useSidePanelStore.getState().setCurrentState(SidePanelValues.PREVIEW);
    const previewStore = usePreviewStore.getState();
    const currentSession = previewStore.sessions[projectId];
    if (currentSession?.status === 'ready') return currentSession;
    return previewStore.startPreview(projectId);
}

export function completeProjectHandoff(projectId: string): void {
    const { setActivity, setCurrentFileEditing, setLoading, setPhase } =
        useBuilderChatStore.getState();
    const { clearLivePreview, setCollapseFileTree } = useCodeEditor.getState();

    clearLivePreview();
    setCurrentFileEditing(null);
    setActivity('');
    setLoading(false);
    setPhase(PHASE_TYPES.COMPLETE);
    setCollapseFileTree(true);

    void openProjectPreview(projectId).catch(() => {
        // ProjectPreview renders the actionable compiler error from the preview store.
    });
}
