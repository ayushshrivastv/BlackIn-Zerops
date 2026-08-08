/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

'use client';

import Image from 'next/image';

interface City3DProps {
    className?: string;
}

export default function City3D({ className = '' }: City3DProps) {
    return (
        <div
            className={`fixed inset-0 overflow-hidden bg-[#070708] ${className}`}
            aria-hidden="true"
        >
            <Image
                src="/images/blackin-landing-background-4k.jpg"
                alt=""
                fill
                priority
                quality={100}
                sizes="100vw"
                draggable={false}
                className="pointer-events-none select-none object-cover object-center [image-rendering:auto]"
            />
            <div className="pointer-events-none absolute inset-0 bg-black/40" />
        </div>
    );
}
