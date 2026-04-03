"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

const items = [
    {
        href: "/docs",
        label: "Documentation",
        icon: IntroBookIcon,
        iconClassName: "sidebar-banner__icon" as const,
    },
    {
        href: "/cookbook",
        label: "Cookbook",
        icon: ChefGearHatIcon,
        iconClassName: "sidebar-banner__icon sidebar-banner__icon--sm" as const,
    },
] as const;

function IntroBookIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
            {...props}
        >
            <desc>Book Open Streamline Icon: https://streamlinehq.com</desc>
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M11 21.8883c0 -0.0016 -0.0023 -0.1748 -0.4069 -0.4886 -0.3882 -0.3012 -1.00952 -0.6173 -1.86014 -0.9072 -1.69024 -0.5762 -4.06795 -0.9763 -6.68827 -1.0543l-0.00023 0C0.976426 19.4061 0.114324 18.5175 0.114563 17.449V3.10201c0 -0.5888 0.220043 -1.12127 0.645144 -1.49501 0.406053 -0.35699 0.913103 -0.49457 1.376103 -0.49457 0.01054 0 0.02107 0.00016 0.03159 0.0005 2.74788 0.08684 5.31759 0.50946 7.23271 1.1658 0.68559 0.23498 1.31609 0.50956 1.84989 0.82751V19.0753c0 0.4142 0.3358 0.75 0.75 0.75s0.75 -0.3358 0.75 -0.75V3.10611c0.5337 -0.31789 1.164 -0.59243 1.8495 -0.82737 1.915 -0.65636 4.4847 -1.07898 7.2331 -1.16581 0.0105 -0.00034 0.0211 -0.0005 0.0316 -0.0005 0.9825 0 2.0212 0.78927 2.0212 1.98958V17.451c0.0003 1.0685 -0.8618 1.9571 -1.9299 1.9891l-0.0006 0c-2.6202 0.0771 -4.9978 0.4767 -6.688 1.0527 -0.8506 0.2898 -1.4718 0.6058 -1.8601 0.9069 -0.4045 0.3138 -0.4068 0.487 -0.4068 0.4886 0 0.5523 -0.4477 1 -1 1s-1 -0.4477 -1 -1Z"
                clipRule="evenodd"
                strokeWidth="1"
            />
        </svg>
    );
}

function ChefGearHatIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" {...props}>
            <desc>Chef Gear Hat Streamline Icon: https://streamlinehq.com</desc>
            <g>
                <path
                    d="M6.21 20a0.51 0.51 0 0 0 -0.37 0.16 0.52 0.52 0 0 0 -0.13 0.39l0.2 2.1A1.5 1.5 0 0 0 7.41 24h9.18a1.5 1.5 0 0 0 1.5 -1.35l0.2 -2.1a0.52 0.52 0 0 0 -0.13 -0.39 0.51 0.51 0 0 0 -0.37 -0.16Z"
                    fill="currentColor"
                    strokeWidth="1"
                />
                <path
                    d="M22.85 8.19a4.33 4.33 0 0 0 -2.34 -2.77A4.55 4.55 0 0 0 18.74 5a0.49 0.49 0 0 1 -0.46 -0.35 6.57 6.57 0 0 0 -12.56 0 0.49 0.49 0 0 1 -0.46 0.35 4.51 4.51 0 0 0 -1.77 0.43 4.33 4.33 0 0 0 -2.34 2.76A4.39 4.39 0 0 0 1.9 12a4.5 4.5 0 0 0 2.77 1.67 0.5 0.5 0 0 1 0.41 0.44l0.39 3.93a0.5 0.5 0 0 0 0.53 0.46h12a0.5 0.5 0 0 0 0.49 -0.45l0.39 -3.93a0.5 0.5 0 0 1 0.41 -0.44A4.5 4.5 0 0 0 22.1 12a4.39 4.39 0 0 0 0.75 -3.81Z"
                    fill="currentColor"
                    strokeWidth="1"
                />
            </g>
        </svg>
    );
}

function SidebarIcon({
    icon: Icon,
    className = "sidebar-banner__icon",
}: {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    className?: string;
}) {
    return <Icon className={className} />;
}

export default function SidebarBanner() {
    const pathname = usePathname();

    return (
        <nav className="sidebar-banner" aria-label="Sidebar sections">
            {items.map((item) => {
                const isActive =
                    item.href === "/docs"
                        ? pathname.startsWith("/docs")
                        : pathname.startsWith(item.href);

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        data-active={isActive ? "true" : undefined}
                        className="sidebar-banner__item"
                    >
                        <SidebarIcon icon={item.icon} className={item.iconClassName} />
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
