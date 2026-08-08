/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';
import { Clock3 } from 'lucide-react';
import { HoverBorderGradient } from '../ui/hover-border-gradient';

export default function NavbarSigninAction() {
    return (
        <div className="group relative">
            <button
                type="button"
                onClick={(event) => event.preventDefault()}
                aria-disabled="true"
                aria-label="Sign in, coming soon. BlackIn is available without an account."
                aria-describedby="signin-status-tooltip"
                className="inline-flex min-h-10 cursor-default rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkest"
            >
                <HoverBorderGradient
                    as="span"
                    containerClassName="min-h-10 rounded-full cursor-default"
                    className="flex items-center gap-x-2 rounded-full bg-[#05070a] px-4 py-2 text-[13px] font-semibold tracking-wide text-white"
                    gradientColors={['rgb(193, 232, 255)', 'rgb(125, 160, 202)', 'rgb(5, 38, 89)']}
                    duration={5}
                    speed={0.14}
                    noiseIntensity={0.18}
                    backdropBlur
                >
                    <span>Sign in</span>
                    <span className="inline-flex items-center gap-1 border-l border-white/15 pl-2 text-[11px] font-medium text-white/60">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        Soon
                    </span>
                </HoverBorderGradient>
            </button>

            <div
                id="signin-status-tooltip"
                role="tooltip"
                className="invisible absolute right-0 top-[calc(100%+0.75rem)] z-[9999] w-64 rounded-md border border-neutral-800 bg-[#0d1117] px-3 py-2 text-left text-xs tracking-wide opacity-0 shadow-lg transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
            >
                <span className="block font-semibold text-neutral-100">Sign-in is coming soon</span>
                <span className="mt-0.5 block leading-4 text-neutral-400">
                    BlackIn is open to use now without an account.
                </span>
            </div>
        </div>
    );
}
