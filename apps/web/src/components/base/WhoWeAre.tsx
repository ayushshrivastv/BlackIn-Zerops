/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';

import React from 'react';
import ArchitectureTitleComponent from './ArchitectureTitleComponent';
import FeatureOne from './FeatureOne';
import DonutComponent from '../ui/DonutComponent';

const productMetaOptions = [
    {
        title: 'PromptFlow',
        subtitle: 'Product briefs into app plans',
        description:
            'PromptFlow turns a plain-English product request into a scoped build plan with screens, data needs, states, and the first version of the app workspace.',
    },
    {
        title: 'EditWizard',
        subtitle: 'Iterate inside the workspace',
        description:
            'EditWizard helps you refine generated code through chat or direct edits while preserving app structure, typing discipline, and component consistency.',
    },
    {
        title: 'ShipDesk',
        subtitle: 'Prepare for live deployment',
        description:
            'ShipDesk keeps export, repo handoff, environment notes, and deployment readiness visible so your Web2 MVP can move from prompt to URL.',
    },
];

export default function WhoWeAre() {
    const containerRef = React.useRef<HTMLDivElement>(null);

    return (
        <>
            <ArchitectureTitleComponent firstText="BlackIn's" secondText="APP FLOW" />
            <section ref={containerRef} className="bg-[#0a0c0d] w-screen">
                <div className="grid md:grid-cols-2 gap-0">
                    <div className="h-screen hidden md:sticky top-0 md:flex items-center justify-center bg-[#0a0c0d]">
                        <DonutComponent />
                    </div>

                    <div className="min-h-[300vh] flex flex-col justify-between z-10 bg-[#0a0c0d]">
                        {productMetaOptions.map((option, index) => (
                            <FeatureOne
                                key={index}
                                title={option.title}
                                subTitle={option.subtitle}
                                description={option.description}
                            />
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
