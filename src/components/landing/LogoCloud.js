"use client";

import ScrollReveal from "@/components/gsap/ScrollReveal";

const logos = [
  "Vercel", "Stripe", "Linear", "OpenAI", "Anthropic", "Supabase", "Cloudflare", "Figma",
];

export default function LogoCloud() {
  return (
    <section className="relative py-16 border-y border-white/5 bg-white/[0.01]">
      <div className="max-w-6xl mx-auto px-6">
        <ScrollReveal y={15}>
          <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-10">
            Trusted by engineering teams at fast-growing companies
          </p>
        </ScrollReveal>

        <div className="marquee-container">
          <div className="marquee-track">
            {[...logos, ...logos].map((logo, i) => (
              <span
                key={`${logo}-${i}`}
                className="text-2xl font-bold text-gray-600 hover:text-[#00d4ff] transition-colors whitespace-nowrap"
                style={{ letterSpacing: "-0.02em" }}
              >
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
