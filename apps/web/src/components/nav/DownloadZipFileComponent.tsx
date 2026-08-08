/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';
import { AiFillFileZip } from 'react-icons/ai';
import ToolTipComponent from '../ui/TooltipComponent';

export default function DownloadZipFileComponent() {
    return (
        <div className="px-4 py-2 text-[12.5px] text-light/70">
            <ToolTipComponent content="ZIP export is coming soon" side="left">
                <button
                    type="button"
                    aria-disabled="true"
                    onClick={(event) => event.preventDefault()}
                    className="flex min-h-10 w-full cursor-default items-center justify-between rounded-[4px] border border-neutral-800 bg-dark/50 px-2 tracking-wide text-light/45 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkest"
                >
                    Download ZIP · Soon
                    <AiFillFileZip className="size-4" aria-hidden="true" />
                </button>
            </ToolTipComponent>
        </div>
    );
}
