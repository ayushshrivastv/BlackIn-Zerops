/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';

import { useRef, useState } from 'react';
import EditorSidePanel from '../code/EditorSidePanel';
import ToolTipComponent from '../ui/TooltipComponent';
import GithubConnectModal from '../nav/GithubConnectModal';
import { useRouter } from 'next/navigation';
import { useHandleClickOutside } from '@/src/hooks/useHandleClickOutside';
import { usePlaygroundThemeStore } from '@/src/store/code/usePlaygroundThemeStore';
import Image from 'next/image';
import { Settings2 } from 'lucide-react';

interface PlaygroundLeftRailProps {
    visible: boolean;
    onToggle: () => void;
}

export default function PlaygroundLeftRail({ visible, onToggle }: PlaygroundLeftRailProps) {
    const [openGithubModal, setOpenGithubModal] = useState(false);
    const [openHomeConfirmModal, setOpenHomeConfirmModal] = useState(false);
    const homePopoverRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { theme } = usePlaygroundThemeStore();

    useHandleClickOutside([homePopoverRef], setOpenHomeConfirmModal);

    return (
        <>
            {visible ? (
                <aside className="playground-left-rail absolute left-0 top-0 z-40 h-full w-16 bg-black">
                    <div className="flex h-full flex-col">
                        <div className="flex h-14 items-center justify-center px-2">
                            <ToolTipComponent side="right" content="Close sidebar">
                                <button
                                    type="button"
                                    onClick={onToggle}
                                    aria-label="Close sidebar"
                                    className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[#16181d]"
                                >
                                    <Image
                                        src={
                                            theme === 'light'
                                                ? '/icons/blackin-mark-light.svg'
                                                : '/icons/blackin-mark-dark.svg'
                                        }
                                        alt="BlackIn official logo"
                                        width={28}
                                        height={28}
                                        draggable={false}
                                        className="h-7 w-7 select-none object-contain transition-transform duration-300 ease-out rotate-180"
                                    />
                                </button>
                            </ToolTipComponent>
                        </div>

                        <div className="min-h-0 flex-1 py-2">
                            <EditorSidePanel
                                showShell={false}
                                onHomeClick={() => setOpenHomeConfirmModal((prev) => !prev)}
                                onGithubClick={() => setOpenGithubModal(true)}
                                className="h-full w-full min-w-0 border-0 bg-transparent"
                            />
                        </div>

                        <div className="flex items-center justify-center px-3 pb-3 pt-2">
                            <ToolTipComponent
                                side="right"
                                content="Workspace settings · Coming soon"
                            >
                                <button
                                    type="button"
                                    onClick={(event) => event.preventDefault()}
                                    aria-disabled="true"
                                    aria-label="Workspace settings, coming soon"
                                    className="playground-left-rail-profile flex h-10 w-10 cursor-default items-center justify-center rounded-lg text-light/55 transition-colors hover:bg-[#16181d] hover:text-light/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                                >
                                    <Settings2 className="h-[18px] w-[18px]" aria-hidden="true" />
                                </button>
                            </ToolTipComponent>
                        </div>
                    </div>

                    {openHomeConfirmModal && (
                        <div
                            ref={homePopoverRef}
                            className="playground-home-popover absolute left-[calc(100%+0.75rem)] top-4 z-50 w-[13.75rem] rounded-xl border border-neutral-800 bg-[#0b0d10] p-2 shadow-[0_20px_60px_-36px_rgba(0,0,0,1)]"
                        >
                            <div className="playground-home-popover-text text-xs leading-4 text-light/75">
                                <p className="whitespace-nowrap">Close current session and move</p>
                                <p className="whitespace-nowrap">to home page?</p>
                            </div>
                            <div className="mt-2 flex items-center justify-end gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setOpenHomeConfirmModal(false)}
                                    className="playground-home-popover-cancel rounded-md border border-neutral-800 bg-[#111317] px-2.5 py-1.5 text-xs font-medium text-light/80 transition hover:bg-[#171a20]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpenHomeConfirmModal(false);
                                        router.push('/');
                                    }}
                                    className="playground-home-popover-confirm rounded-md bg-[#d8e9ff] px-2.5 py-1.5 text-xs font-semibold text-black transition hover:bg-[#c7dcf7]"
                                >
                                    Home
                                </button>
                            </div>
                        </div>
                    )}
                </aside>
            ) : (
                <div className="absolute left-2 top-2 z-50">
                    <ToolTipComponent side="right" content="Open sidebar">
                        <button
                            type="button"
                            onClick={onToggle}
                            aria-label="Open sidebar"
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-black transition hover:bg-[#16181d]"
                        >
                            <Image
                                src={
                                    theme === 'light'
                                        ? '/icons/blackin-mark-light.svg'
                                        : '/icons/blackin-mark-dark.svg'
                                }
                                alt="BlackIn official logo"
                                width={28}
                                height={28}
                                draggable={false}
                                className="h-7 w-7 select-none object-contain transition-transform duration-300 ease-out"
                            />
                        </button>
                    </ToolTipComponent>
                </div>
            )}

            <GithubConnectModal
                openGithubModal={openGithubModal}
                setOpenGithubModal={setOpenGithubModal}
            />
        </>
    );
}
