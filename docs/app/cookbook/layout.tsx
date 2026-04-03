import SiteFooter from "@/app/_components/site-footer";
import type { ReactNode } from "react";

export default function CookbookLayout({ children }: { children: ReactNode }) {
    return (
        <div className="pb-20">
            {children}
            <div className="fixed inset-x-0 bottom-0 z-30 bg-[var(--background)]">
                <SiteFooter />
            </div>
        </div>
    );
}
