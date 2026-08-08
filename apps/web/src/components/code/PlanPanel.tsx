/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

import { JSX, useState } from 'react';
import PlanExecutorPanel from './PlanExecutorPanel';
import { useExecutorStore } from '@/src/store/model/useExecutorStore';
import { useSidePanelStore } from '@/src/store/code/useSidePanelStore';
import { SidePanelValues } from '@/src/types/side-panel';

export default function PlanPanel(): JSX.Element {
    const [collapsePanel, setCollapsePanel] = useState<boolean>(false);
    const { editExeutorPlanPanel, setEditExeutorPlanPanel } = useExecutorStore();
    const { setCurrentState } = useSidePanelStore();
    // if (!message)
    //     return (
    //         <div className="w-full h-full flex items-center justify-center text-light/50 bg-[#151617]">
    //             No Plan Selected
    //         </div>
    //     );
    return (
        <div className="playground-plan-panel w-full h-full min-h-0 flex justify-center bg-[#070708] overflow-hidden">
            <PlanExecutorPanel
                plan={DUMMY_PLAN}
                onCollapse={() => {
                    setCollapsePanel((prev) => !prev);
                }}
                onEdit={() => {
                    setEditExeutorPlanPanel(!editExeutorPlanPanel);
                }}
                onExpand={() => {
                    setCurrentState(SidePanelValues.PLAN);
                }}
                onDone={() => {
                    setEditExeutorPlanPanel(false);
                }}
                collapse={collapsePanel}
                expanded
                editExeutorPlanPanel={editExeutorPlanPanel}
                className="w-full h-full min-h-0 px-4 py-2"
            />
        </div>
    );
}

const DUMMY_PLAN = {
    contract_name: 'web_app_launch',
    contract_title: 'Web App Launch Plan',
    short_description:
        'Step-by-step execution plan to generate, review, and launch a Web2 application.',
    long_description:
        'This plan covers turning the prompt into product requirements, creating the frontend, wiring API routes, and preparing the project for deployment.',
    contract_instructions: [
        {
            title: 'Map Product',
            short_description: 'Turn the prompt into a scoped app plan.',
            long_description:
                'Identify the primary users, screens, data states, and workflows needed for the first working version.',
        },
        {
            title: 'Scaffold UI',
            short_description: 'Create the web app structure.',
            long_description:
                'Generate routes, components, layout, empty states, and responsive UI for the requested product.',
        },
        {
            title: 'Wire API',
            short_description: 'Add data and action endpoints.',
            long_description:
                'Create API route stubs, validation notes, and environment placeholders so the app can connect to real services.',
        },
        {
            title: 'Ship Frontend',
            short_description: 'Review and prepare deployment.',
            long_description:
                'Check generated files, document setup, and prepare export or deployment configuration for a live URL.',
        },
    ],
};
