"use client";

import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

export default function BlogSection({ posts = [] }) {
  const displayPosts =
    posts.length > 0
      ? posts.slice(0, 3)
      : [
          {
            title: "Building Scalable SaaS with Next.js 15",
            slug: "building-scalable-saas-nextjs-15",
            excerpt:
              "A deep dive into server components, streaming, and the app router.",
            createdAt: new Date().toISOString(),
          },
          {
            title: "The Future of 3D Web Experiences",
            slug: "future-of-3d-web",
            excerpt:
              "How WebGL and Three.js are reshaping digital interactions.",
            createdAt: new Date().toISOString(),
          },
          {
            title: "Marketing Automation in 2025",
            slug: "marketing-automation-2025",
            excerpt: "AI-driven growth strategies for modern agencies.",
            createdAt: new Date().toISOString(),
          },
        ];

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-5" />
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-4">
          <div>
            <ScrollReveal y={20}>
              <div className="cinematic-badge mb-6">
                <span>Insights</span>
              </div>
            </ScrollReveal>
            <ScrollReveal y={30} delay={0.1}>
              <h2 className="cinematic-headline mb-4">LATEST ARTICLES</h2>
            </ScrollReveal>
          </div>
          <ScrollReveal y={20} delay={0.2}>
            <Link
              href="/blog"
              className="text-[#00d4ff] inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              View all posts <ArrowRight className="w-4 h-4" />
            </Link>
          </ScrollReveal>
        </div>

        <ScrollReveal
          stagger={0.1}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {displayPosts.map((post, i) => (
            <Scroll3DTilt
              key={post.slug}
              max={8}
              className="ai-module p-6 group block"
            >
              <Link href={`/blog/${post.slug}`} className="block">
                <div className="w-full h-40 rounded-xl bg-gradient-to-br from-[#3b82f6]/10 to-[#00d4ff]/5 mb-4 flex items-center justify-center border border-white/5">
                  <span className="text-5xl font-black text-[#3b82f6]/20">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <Calendar className="w-3 h-3" />
                  {new Date(post.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <h3 className="font-bold text-white mb-2 group-hover:text-[#00d4ff] transition-colors">
                  {post.title}
                </h3>
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
