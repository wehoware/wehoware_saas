"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import PremiumNav from "@/components/landing/PremiumNav";
import HeroSection from "@/components/landing/HeroSection";
import LogoCloud from "@/components/landing/LogoCloud";
import StatsSection from "@/components/landing/StatsSection";
import Interactive3DShowcase from "@/components/landing/Interactive3DShowcase";
import ServicesSection from "@/components/landing/ServicesSection";
import CompanyStorySection from "@/components/landing/CompanyStorySection";
import ProcessSection from "@/components/landing/ProcessSection";
import AICommandCenter from "@/components/landing/AICommandCenter";
import GrowthEngineSection from "@/components/landing/GrowthEngineSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import TechStackSection from "@/components/landing/TechStackSection";
import TeamSection from "@/components/landing/TeamSection";
import BlogSection from "@/components/landing/BlogSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";
import SeamlessSection from "@/components/landing/SeamlessSection";
import ScrollBackground from "@/components/landing/ScrollBackground";
import { ScrollProvider } from "@/components/gsap/ScrollContext";

const CustomCursor = dynamic(() => import("@/components/gsap/CustomCursor"), { ssr: false });
const ScrollProgress = dynamic(() => import("@/components/gsap/ScrollProgress"), { ssr: false });
const Preloader = dynamic(() => import("@/components/gsap/Preloader"), { ssr: false });

function LenisSmoothScroll() {
  useEffect(() => {
    let lenis;
    (async () => {
      const Lenis = (await import("lenis")).default;
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    })();
    return () => {
      if (lenis) lenis.destroy();
    };
  }, []);
  return null;
}

export default function Home() {
  const [blogPosts, setBlogPosts] = useState([]);

  useEffect(() => {
    async function fetchBlogs() {
      try {
        const res = await fetch("/api/v1/blogs?limit=3");
        if (res.ok) {
          const data = await res.json();
          setBlogPosts(data.posts || data || []);
        }
      } catch {
        // Fallback posts are handled in BlogSection
      }
    }
    fetchBlogs();
  }, []);

  return (
    <ScrollProvider>
      <LenisSmoothScroll />
      <Preloader />
      <CustomCursor />
      <ScrollProgress />
      <PremiumNav />

      {/* Animated scroll-reactive gradient background */}
      <ScrollBackground />

      {/* Dark readability overlay */}
      <div className="readability-overlay" aria-hidden="true" />

      {/* All content */}
      <div className="landing-3d content-layer">
        <HeroSection />

        <SeamlessSection>
          <LogoCloud />
        </SeamlessSection>

        <SeamlessSection>
          <CompanyStorySection />
        </SeamlessSection>

        <SeamlessSection>
          <ServicesSection />
        </SeamlessSection>

        <div id="process" className="relative z-10">
          <ProcessSection />
        </div>

        <SeamlessSection id="ai-command">
          <AICommandCenter />
        </SeamlessSection>

        <SeamlessSection id="showcase">
          <Interactive3DShowcase />
        </SeamlessSection>

        <SeamlessSection>
          <StatsSection />
        </SeamlessSection>

        <SeamlessSection id="growth">
          <GrowthEngineSection />
        </SeamlessSection>

        <SeamlessSection>
          <TestimonialsSection />
        </SeamlessSection>

        <SeamlessSection>
          <TechStackSection />
        </SeamlessSection>

        <SeamlessSection>
          <TeamSection />
        </SeamlessSection>

        <SeamlessSection>
          <BlogSection posts={blogPosts} />
        </SeamlessSection>

        <SeamlessSection id="pricing">
          <PricingSection />
        </SeamlessSection>

        <SeamlessSection>
          <CTASection />
        </SeamlessSection>
      </div>
    </ScrollProvider>
  );
}

