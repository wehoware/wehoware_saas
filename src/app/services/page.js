"use client";

import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Code,
  Smartphone,
  BrainCircuit,
  Server,
  LineChart,
  Cog,
} from "lucide-react";

export default function ServicesPage() {
  const services = [
    {
      id: "web-development",
      title: "Web Development",
      description:
        "Custom web applications built with cutting-edge technologies. Our full-stack development team creates responsive, performant, and scalable solutions that drive business growth.",
      icon: <Code size={40} className="text-primary" />,
    },
    {
      id: "mobile-apps",
      title: "Mobile Applications",
      description:
        "Native and cross-platform mobile solutions for iOS and Android. We deliver intuitive, feature-rich mobile experiences that engage users and extend your digital presence.",
      icon: <Smartphone size={40} className="text-primary" />,
    },
    {
      id: "ai-ml",
      title: "AI & Machine Learning",
      description:
        "Harness the power of artificial intelligence and machine learning to automate processes, gain insights from your data, and create innovative solutions that keep you ahead of the competition.",
      icon: <BrainCircuit size={40} className="text-primary" />,
    },
    {
      id: "cloud-services",
      title: "Cloud Services",
      description:
        "Comprehensive cloud solutions including migration, optimization, and management. We help you leverage the full potential of AWS, Azure, and Google Cloud to enhance scalability and reduce costs.",
      icon: <Server size={40} className="text-primary" />,
    },
    {
      id: "data-analytics",
      title: "Data Analytics",
      description:
        "Transform raw data into actionable insights with our advanced analytics solutions. We develop custom dashboards, reporting tools, and predictive models that drive informed decision-making.",
      icon: <LineChart size={40} className="text-primary" />,
    },
    {
      id: "custom-software",
      title: "Custom Software",
      description:
        "Bespoke software solutions tailored to your unique business requirements. Our development team builds reliable, scalable, and maintainable applications that solve your specific challenges.",
      icon: <Cog size={40} className="text-primary" />,
    },
  ];

  // Animation variants for framer-motion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100, damping: 10 },
    },
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <>
      <Head>
        <title>Our Services - Wehoware Technologies</title>
        <meta
          name="description"
          content="Comprehensive software development and IT solutions tailored to your business needs. Web development, mobile apps, AI/ML, cloud services, and more."
        />
      </Head>
      <div className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <motion.div
          className="mb-16 mt-28 text-center"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <h1 className="text-4xl font-bold mb-4">Our Software Solutions</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Cutting-edge software development and IT solutions tailored to your
            business requirements, delivered with expertise and innovative
            thinking.
          </p>
        </motion.div>

        <motion.div
          className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {services.map((service) => (
            <motion.div
              key={service.id}
              variants={itemVariants}
              whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
            >
              <Link
                href={`/services/${service.id}`}
                className="group block h-full border rounded-xl p-8 transition-all hover:shadow-md hover:border-primary/50 bg-card"
              >
                <div className="mb-4 transform transition-transform group-hover:scale-110">
                  {service.icon}
                </div>
                <h2 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                  {service.title}
                </h2>
                <p className="text-muted-foreground">{service.description}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="mt-16 bg-muted/50 border rounded-xl p-8 text-center"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <h2 className="text-2xl font-semibold mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Schedule a consultation with our technical experts to discuss your
            project requirements and discover how our solutions can help you
            achieve your goals.
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/contact"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Schedule a Consultation
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
