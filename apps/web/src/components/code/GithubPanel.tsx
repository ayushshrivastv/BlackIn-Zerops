/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';
import { PiGithubLogoFill } from 'react-icons/pi';
import { Button } from '../ui/button';
import { FaGithub } from 'react-icons/fa';
import { Clock3 } from 'lucide-react';

export default function GithubPanel() {
    return (
        <div className="playground-github-panel flex flex-col items-center justify-start h-full w-full text-light/90">
            <div className="flex flex-col items-center gap-y-4 px-5 py-6">
                <PiGithubLogoFill size={48} />
                <h2 className="text-lg font-semibold">GitHub export</h2>
                <p className="playground-github-panel-text text-[13px] text-light/60 text-center tracking-wide">
                    Repository export and continuous sync are coming soon. You can generate and
                    review projects now without connecting an account.
                </p>
                <Button
                    disabled
                    size="xs"
                    className="playground-github-panel-btn w-full cursor-not-allowed gap-2.5 rounded-[4px] border border-neutral-800 bg-[#17191d] font-semibold tracking-wider text-light/60"
                >
                    <FaGithub className="size-3.5" />
                    <span className="text-[11px]">Connect GitHub</span>
                    <Clock3 className="size-3.5" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}
