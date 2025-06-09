"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Code,
  GanttChart,
  Smartphone,
  Globe,
  Zap,
  BarChart,
  PenTool,
  Trophy,
  Database,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Reusable animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

export default function Home() {
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  const servicesData = [
    {
      icon: <Code className="h-12 w-12 text-primary" />,
      title: "Software Development",
      description:
        "Custom software solutions tailored to your business needs with cutting-edge technologies and best practices.",
    },
    {
      icon: <GanttChart className="h-12 w-12 text-primary" />,
      title: "Web Development",
      description:
        "Modern, responsive websites and web applications that drive engagement and deliver results.",
    },
    {
      icon: <Smartphone className="h-12 w-12 text-primary" />,
      title: "Mobile Development",
      description:
        "Native and cross-platform mobile applications that provide seamless user experiences across devices.",
    },
    {
      icon: <Database className="h-12 w-12 text-primary" />,
      title: "Cloud Solutions",
      description:
        "Scalable cloud infrastructure and services to optimize your business operations and reduce costs.",
    },
    {
      icon: <BarChart className="h-12 w-12 text-primary" />,
      title: "Digital Marketing",
      description:
        "Results-driven digital marketing strategies that boost your online presence and drive targeted traffic.",
    },
    {
      icon: <PenTool className="h-12 w-12 text-primary" />,
      title: "UI/UX Design",
      description:
        "User-centered design solutions that enhance usability and create memorable brand experiences.",
    },
  ];

  const statsData = [
    { value: "10+", label: "Years Experience" },
    { value: "22", label: "Projects Completed" },
    { value: "20+", label: "Team Members" },
    { value: "98%", label: "Client Satisfaction" },
  ];

  const clientLogos = [
    "/clients/logo1.svg",
    "/clients/logo2.svg",
    "/clients/logo3.svg",
    "/clients/logo4.svg",
    "/clients/logo5.svg",
    "/clients/logo6.svg",
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero Section - Futuristic with animated elements */}
      <section className="relative py-20 lg:py-32 overflow-hidden bg-gradient-to-b from-background to-background/60">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
          <div className="absolute right-0 bottom-0 left-0 h-80 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="container relative z-10 px-6 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="inline-flex"
              >
                <Badge
                  variant="outline"
                  className="px-4 py-1 border-primary/20 bg-primary/5 text-primary rounded-full"
                >
                  Software Development & Marketing
                </Badge>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl font-bold !leading-tight tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                We Build
                <br />
                <span className="text-primary">Digital Solutions</span>
                <br />
                That Drive Growth
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground max-w-md"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                Full-service website design, development and digital marketing
                company specializing in SEO and content marketing solutions that
                grow your brand.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4 pt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Button size="lg" asChild className="group">
                  <Link href="/services">
                    Explore Services
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/contact">Contact Us</Link>
                </Button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative overflow-hidden rounded-2xl border shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 via-background/0 to-background/0 z-10 rounded-2xl"></div>
                <img
                  src="https://rfwmtrsvoiwmzeowdmyv.supabase.co/storage/v1/object/public/wehoware-thumbnails/wehoware/technological-ecology-concept_23-2148437384.avif"
                  alt="Wehoware Dashboard"
                  width={600}
                  height={400}
                  className="rounded-2xl w-full object-cover"
                />
              </div>

              <motion.div
                className="absolute -top-6 -right-6 p-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg flex items-center gap-4 max-w-xs border"
                initial={{ opacity: 0, x: 20, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
              >
                <div className="p-2 bg-primary/10 rounded-full">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">10+ Years Experience</p>
                  <p className="text-xs text-muted-foreground">
                    Delivering cutting-edge solutions
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="absolute -bottom-6 -left-6 p-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg flex items-center gap-4 max-w-xs border"
                initial={{ opacity: 0, x: -20, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.5, delay: 1 }}
              >
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">22 Completed Projects</p>
                  <p className="text-xs text-muted-foreground">
                    With 98% client satisfaction
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Floating elements */}
        <div className="absolute top-1/4 left-10 h-20 w-20 rounded-full bg-primary/10 blur-xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-10 h-32 w-32 rounded-full bg-blue-500/10 blur-xl animate-pulse"></div>
      </section>

      {/* Stats Section with SVG wave divider */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        <div className="container relative">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {statsData.map((stat, index) => (
              <motion.div
                key={index}
                className="text-center"
                variants={fadeInUp}
              >
                <h3 className="text-4xl md:text-5xl font-bold text-primary mb-2">
                  {stat.value}
                </h3>
                <p className="text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Services Section with overlapping cards */}
      <section
        className="relative py-24 overflow-hidden bg-muted/30"
        ref={targetRef}
      >
        <div className="container relative z-10">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.h2
              className="text-3xl md:text-4xl font-bold mb-4"
              variants={fadeInUp}
            >
              Our Premium Services
            </motion.h2>
            <motion.p
              className="text-lg text-muted-foreground"
              variants={fadeInUp}
            >
              We deliver cutting-edge solutions that help businesses thrive in
              the digital landscape.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            style={{ scale, opacity }}
          >
            {servicesData.map((service, index) => (
              <motion.div
                key={index}
                className="relative p-6 rounded-xl bg-card hover:shadow-lg transition-all duration-300 border border-border hover:border-primary/40 group overflow-hidden"
                whileHover={{ y: -5 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full transition-transform duration-500 group-hover:scale-150"></div>
                <div className="relative">
                  <div className="p-3 rounded-xl bg-primary/10 inline-flex mb-4">
                    {service.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {service.description}
                  </p>
                  <Link
                    href={`/services#${service.title
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                    className="inline-flex items-center text-primary font-medium hover:underline"
                  >
                    Learn more <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-xl"></div>
        <div className="absolute -bottom-20 -left-10 h-60 w-60 rounded-full bg-blue-500/10 blur-xl"></div>
      </section>

      {/* Trusted by section with logos */}
      <section className="py-20 overflow-hidden bg-background">
        <div className="container">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-semibold mb-1">
              Trusted by Great Companies
            </h2>
            <p className="text-muted-foreground">
              Join the companies that trust Wehoware for their digital needs
            </p>
          </motion.div>

          <motion.div
            className="flex flex-wrap justify-center items-center gap-12 md:gap-16 opacity-70"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {clientLogos.map((logo, index) => (
              <motion.div
                key={index}
                className="h-12 w-24 md:h-16 md:w-32 relative grayscale hover:grayscale-0 transition-all duration-300"
                variants={scaleIn}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-full h-8 md:h-10 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Call to Action with gradient background */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background z-0"></div>

        <div className="container relative z-10">
          <motion.div
            className="max-w-4xl mx-auto bg-card shadow-lg rounded-2xl p-10 border border-border relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>

            <div className="relative text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your Digital Presence?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Whether you need a new website, custom software, or a
                comprehensive digital marketing strategy, our team is ready to
                help you achieve your goals.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href="/contact">Get Started Today</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/services">Explore Our Services</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
