"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import PremiumNav from "@/components/landing/PremiumNav";
import HeroSection from "@/components/landing/HeroSection";
import LogoCloud from "@/components/landing/LogoCloud";
import BentoFeatures from "@/components/landing/BentoFeatures";
import StatsSection from "@/components/landing/StatsSection";
import Interactive3DShowcase from "@/components/landing/Interactive3DShowcase";
import PlatformSection from "@/components/landing/PlatformSection";
import ServicesSection from "@/components/landing/ServicesSection";
import ProcessSection from "@/components/landing/ProcessSection";
import CaseStudiesSection from "@/components/landing/CaseStudiesSection";
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
const Global3DScene = dynamic(() => import("@/components/three/Global3DScene"), { ssr: false });

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
      <Preloader />
      <CustomCursor />
      <ScrollProgress />
      <PremiumNav />

      {/* Persistent 3D canvas background - fixed, behind all content */}
      <Global3DScene />

      {/* Animated scroll-reactive gradient background */}
      <ScrollBackground />

      {/* Dark readability overlay between 3D background and content */}
      <div className="readability-overlay" aria-hidden="true" />

      {/* All content sits above the 3D canvas */}
      <div className="landing-3d content-layer">
        <HeroSection />

        <SeamlessSection>
          <LogoCloud />
        </SeamlessSection>

        <SeamlessSection>
          <BentoFeatures />
        </SeamlessSection>

        <SeamlessSection>
          <StatsSection />
        </SeamlessSection>

        <SeamlessSection id="showcase">
          <Interactive3DShowcase />
        </SeamlessSection>

        <SeamlessSection>
          <PlatformSection />
        </SeamlessSection>

        <SeamlessSection>
          <ServicesSection />
        </SeamlessSection>

        <SeamlessSection>
          <ProcessSection />
        </SeamlessSection>

        <SeamlessSection>
          <CaseStudiesSection />
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

        <SeamlessSection>
          <PricingSection />
        </SeamlessSection>

        <SeamlessSection>
          <CTASection />
        </SeamlessSection>
      </div>
    </ScrollProvider>
  );
}

