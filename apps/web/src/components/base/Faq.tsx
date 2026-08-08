/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';
import { cn } from '@/src/lib/utils';
import { useState, useRef, memo } from 'react';
import { AiOutlinePlus } from 'react-icons/ai';
import { doto } from './FeatureOne';
import { motion, useInView } from 'framer-motion';

/* eslint-disable react/prop-types */
interface FaqData {
    question: string;
    answer: string;
}

interface FaqItemProps {
    faq: FaqData;
    index: number;
    isOpen: boolean;
    onToggle: () => void;
}

const FaqItem = memo<FaqItemProps>(({ faq, index, isOpen, onToggle }) => {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className={cn('overflow-hidden transition-all duration-300 border-b border-neutral-300')}
        >
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="w-full py-5 flex items-center justify-between text-left transition-colors duration-150 cursor-pointer hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-light"
            >
                <span className="text-lg font-semibold text-[#141517] pr-4 hover:text-[#14151795] transition-colors">
                    {faq.question}
                </span>
                <AiOutlinePlus
                    aria-hidden="true"
                    className={`w-6 h-6 text-primary flex-shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-45' : ''
                    }`}
                />
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ${
                    isOpen ? 'max-h-96' : 'max-h-0'
                }`}
            >
                <div className="pb-6 pt-1">
                    <p className="text-darkest/70 leading-relaxed text-left">{faq.answer}</p>
                </div>
            </div>
        </motion.div>
    );
});

FaqItem.displayName = 'FaqItem';

export default function Faq() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqs: FaqData[] = [
        {
            question: 'What is BlackIn?',
            answer: 'BlackIn is an AI app studio for turning product prompts into working web app workspaces with generated files, plans, and previews.',
        },
        {
            question: 'What can I build with it?',
            answer: 'You can build SaaS dashboards, admin panels, customer portals, landing pages, booking flows, analytics views, and internal tools.',
        },
        {
            question: 'Do I need backend experience?',
            answer: 'No. Describe the product outcome. BlackIn plans the app structure, creates the frontend, prepares API routes, and shows the files so you can inspect or edit them.',
        },
        {
            question: 'Can I edit the generated project?',
            answer: 'Yes. The playground keeps chat, file tree, code editor, and terminal together so you can refine features without leaving the browser.',
        },
        {
            question: 'Does it create real project files?',
            answer: 'Yes. The workspace shows familiar app files, components, routes, configuration, and documentation instead of a locked black-box preview.',
        },
        {
            question: 'What about quality checks?',
            answer: 'The agent explains what it is doing, structures files, reviews changes, and gives you a clearer path to test, export, or deploy the app.',
        },
        {
            question: 'Can I use it for a hackathon MVP?',
            answer: 'Yes. It is designed for fast Web2 product prototypes where the live demo, generated files, and project explanation all matter.',
        },
    ];

    const toggleFaq = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section
            id="faq"
            className="relative min-h-screen bg-light px-6 md:px-12 lg:px-20 py-16 lg:py-20 z-10"
        >
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: `
        radial-gradient(circle, rgb(62, 104, 232) 2px, transparent 2px)
      `,
                    backgroundSize: '40px 40px',
                    backgroundPosition: '0 0',
                }}
            />
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                    <div className="flex flex-col items-start justify-start gap-8 lg:gap-12">
                        <h1
                            className={cn(
                                'text-6xl lg:text-[12rem] font-black text-darkest leading-tight text-left bg-light z-10 select-none',
                                doto.className,
                            )}
                        >
                            FAQs
                        </h1>
                        <div className="absolute bottom-2 left-0 md:bottom-12 md:left-10 text-[10px] md:text-[18px] z-10 bg-light p-3">
                            <div className="md:max-w-2xl max-w-sm flex flex-col justify-start items-start text-dark text-md font-normal">
                                <span>Spotted an issue?</span>
                                <span>Help us improve — open it on GitHub.</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 bg-light z-10 py-6 px-6">
                        {faqs.map((faq, index) => (
                            <FaqItem
                                key={index}
                                faq={faq}
                                index={index}
                                isOpen={openIndex === index}
                                onToggle={() => toggleFaq(index)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
