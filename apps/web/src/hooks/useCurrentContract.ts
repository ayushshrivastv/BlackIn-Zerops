/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

import { useBuilderChatStore } from '../store/code/useBuilderChatStore';

const emptyContract = useBuilderChatStore.getState().getCurrentContract();

export const useCurrentContract = () => {
    return useBuilderChatStore((state) => {
        if (!state.currentContractId) return emptyContract;
        return state.contracts[state.currentContractId] ?? emptyContract;
    });
};
