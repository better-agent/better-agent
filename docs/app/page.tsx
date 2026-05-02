import CodeDemo from "./_components/code-demo";
import CtaSection from "./_components/cta-section";
import FeaturesSection from "./_components/features-section";
import HeroSection from "./_components/hero-section";
import PrimitivesShowcase from "./_components/primitives-showcase";
import SiteFooter from "./_components/site-footer";

function Divider() {
    return (
        <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-8">
            <div className="h-px w-full bg-[color:color-mix(in_srgb,var(--foreground)_7%,transparent)]" />
        </div>
    );
}

export default function Home() {
    return (
        <main className="landing-shell relative flex-1">
            <HeroSection />

            <CodeDemo />

            <Divider />

            <FeaturesSection />

            <Divider />

            <PrimitivesShowcase />

            <Divider />

            <CtaSection />

            <SiteFooter />
        </main>
    );
}
