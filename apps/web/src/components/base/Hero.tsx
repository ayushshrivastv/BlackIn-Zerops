/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';
import { ForwardedRef, useEffect, useRef } from 'react';
import { motion, useAnimation, useInView, useScroll, useTransform } from 'framer-motion';
import City from './City';
import DashboardTextAreaComponent from './DashboardTextAreaComponent';
import HighlighterTicker from '../tickers/HighlighterTicker';
import { useTemplateStore } from '@/src/store/user/useTemplateStore';
import Marketplace from '@/src/lib/server/marketplace-server';

interface HeroProps {
    inputRef: ForwardedRef<HTMLTextAreaElement>;
}

export default function Hero({ inputRef }: HeroProps) {
    const heroRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(heroRef, { once: true });
    const controls = useAnimation();
    const { setTemplates } = useTemplateStore();

    useEffect(() => {
        const get_templates = async () => {
            const response = await Marketplace.getTemplates();
            setTemplates(response);
        };
        get_templates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (isInView) {
            controls.start('visible');
        }
    }, [isInView, controls]);

    const { scrollY } = useScroll();
    const fadeOpacity = useTransform(scrollY, [0, 800], [0, 1]);

    return (
        <motion.div className="flex-1 flex justify-center items-center px-4 sticky top-0 md:top-0 z-0">
            <motion.div
                className="absolute inset-0 bg-black pointer-events-none z-30"
                style={{ opacity: fadeOpacity }}
            />
            <City className="absolute inset-0 z-0" />

            <main
                ref={heroRef}
                className="relative flex flex-col justify-center items-center h-screen w-full overflow-visible"
            >
                <motion.div
                    className="relative z-10 w-full max-w-2xl"
                    initial="hidden"
                    animate={controls}
                    variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1, transition: { duration: 0.8 } },
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        className="mb-3"
                    >
                        <h1
                            className="text-[clamp(1.35rem,4.5vw,3.75rem)] whitespace-nowrap font-semibold leading-tight tracking-tight bg-gradient-to-t from-neutral-700 via-neutral-300 to-neutral-200 bg-clip-text text-transparent"
                            style={{
                                fontFamily:
                                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
                            }}
                        >
                            <span>Build web apps by prompt.</span>
                        </h1>
                    </motion.div>

                    <HighlighterTicker />
                    <DashboardTextAreaComponent inputRef={inputRef} />
                </motion.div>

                <a
                    href="https://zerops.io"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Powered by Zerops (opens in a new tab)"
                    className="absolute right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 inline-flex items-center gap-2 text-[11px] font-medium text-white/65 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none md:right-6 md:bottom-6"
                >
                    <span
                        className="h-1.5 w-1.5 rounded-full bg-teal-300 shadow-[0_0_8px_rgba(94,234,212,0.7)]"
                        aria-hidden="true"
                    />
                    <span>
                        Powered by <strong className="font-semibold text-white/90">Zerops</strong>
                    </span>
                </a>
            </main>
        </motion.div>
    );
}
