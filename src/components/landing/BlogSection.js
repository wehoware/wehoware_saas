"use client";

import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

export default function BlogSection({ posts = [] }) {
  const displayPosts = posts.length > 0 ? posts.slice(0, 3) : [
    { title: "Building Scalable SaaS with Next.js 15", slug: "building-scalable-saas-nextjs-15", excerpt: "A deep dive into server components, streaming, and the app router.", createdAt: new Date().toISOString() },
    { title: "The Future of 3D Web Experiences", slug: "future-of-3d-web", excerpt: "How WebGL and Three.js are reshaping digital interactions.", createdAt: new Date().toISOString() },
    { title: "Marketing Automation in 2025", slug: "marketing-automation-2025", excerpt: "AI-driven growth strategies for modern agencies.", createdAt: new Date().toISOString() },
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <ScrollReveal y={20} rotateX={10}>
              <div className="inline-block px-3 py-1 rounded-full glass-card text-sm text-[#00d4ff] mb-4">
                Insights
              </div>
            </ScrollReveal>
            <ScrollReveal y={30} delay={0.1} rotateX={15}>
              <h2 className="text-4xl md:text-5xl font-bold">
                Latest <span className="gradient-text">Articles</span>
              </h2>
            </ScrollReveal>
          </div>
          <ScrollReveal y={20} delay={0.2} opacity={0}>
            <Link href="/blog" className="text-[#00d4ff] inline-flex items-center gap-1 hover:gap-2 transition-all">
              View all posts <ArrowRight className="w-4 h-4" />
            </Link>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.1} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayPosts.map((post, i) => (
            <Scroll3DTilt key={i} max={10} className="glass-card p-6 group block">
              <Link href={`/blog/${post.slug}`} className="block">
                <div className="w-full h-40 rounded-lg bg-gradient-to-br from-[#3b82f6]/20 to-[#00d4ff]/10 mb-4 flex items-center justify-center">
                  <span className="text-4xl font-bold text-[#3b82f6]/30">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <Calendar className="w-3 h-3" />
                  {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <h3 className="font-bold text-gray-100 mb-2 group-hover:text-[#00d4ff] transition-colors">{post.title}</h3>
                <p className="text-sm text-gray-400 mb-4">{post.excerpt}</p>
                <span className="text-sm text-[#60a5fa] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  Read more <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </Scroll3DTilt>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
