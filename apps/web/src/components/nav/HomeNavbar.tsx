'use client';
import CompanyNavbarLogo from './CompanyNavbarLogo';
import { MdHomeFilled } from 'react-icons/md';
import { usePathname, useRouter } from 'next/navigation';

export default function HomeNavbar() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <div className="w-full min-h-14 text-light/70 px-6 select-none relative flex justify-between items-center z-10">
            <CompanyNavbarLogo />
            <div className="flex items-center justify-center gap-x-6 text-sm">
                {pathname === '/pricing' && (
                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        aria-label="Go home"
                        className="flex min-h-10 min-w-10 items-center justify-center rounded-sm text-light/70 transition-transform hover:-translate-y-0.5 hover:bg-neutral-700/70 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkest"
                    >
                        <MdHomeFilled className="h-7 w-7 p-[4px]" />
                    </button>
                )}
            </div>
        </div>
    );
}
