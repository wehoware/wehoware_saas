'use client';

import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function BlogPage() {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 10,
      },
    },
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  // This would typically come from a CMS or database
  const blogPosts = [
    {
      id: 'modern-react-patterns',
      title: 'Modern React Patterns for 2025',
      excerpt:
        'Explore the latest patterns and best practices for building efficient and maintainable React applications.',
      date: 'April 01, 2025',
      author: 'Sarah Johnson',
      readTime: '8 min read',
      category: 'Development',
    },
    {
      id: 'ai-driven-development',
      title: 'AI-Driven Development: The Future of Coding',
      excerpt:
        'How artificial intelligence is revolutionizing software development and increasing developer productivity.',
      date: 'March 28, 2025',
      author: 'Michael Chen',
      readTime: '6 min read',
      category: 'AI & ML',
    },
    {
      id: 'cloud-architecture-tips',
      title: 'Top 10 Cloud Architecture Best Practices',
      excerpt:
        'Expert advice on designing scalable, secure, and cost-effective cloud infrastructure for your applications.',
      date: 'March 15, 2025',
      author: 'David Rodriguez',
      readTime: '5 min read',
      category: 'Cloud',
    },
    {
      id: 'microservices-architecture',
      title: 'Microservices vs. Monoliths: Making the Right Choice',
      excerpt:
        'A comprehensive analysis of architecture patterns to help you decide the best approach for your next project.',
      date: 'March 10, 2025',
      author: 'Emma Patel',
      readTime: '10 min read',
      category: 'Architecture',
    },
    {
      id: 'mobile-dev-trends',
      title: 'Mobile Development Trends to Watch in 2025',
      excerpt:
        'The latest frameworks, tools, and approaches that are shaping the future of mobile application development.',
      date: 'March 5, 2025',
      author: 'James Wilson',
      readTime: '7 min read',
      category: 'Mobile',
    },
  ];

  return (
    <>
      <Head>
        <title>Blog - Wehoware Technologies</title>
        <meta
          name="description"
          content="Latest news, updates, and insights on software development, technology trends, and digital innovation from Wehoware experts."
        />
      </Head>
      <div className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <motion.div
          className="mb-12 mt-32 text-center"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <h1 className="text-4xl font-bold mb-4">Tech Insights</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay informed with the latest news, guides, and insights on software
            development, emerging technologies, and digital innovation.
          </p>
        </motion.div>

        <motion.div
          className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {blogPosts.map((post) => (
            <motion.article
              key={post.id}
              className="border rounded-lg overflow-hidden transition-all hover:shadow-md group bg-card h-full"
              variants={itemVariants}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <Link href={`/blog/${post.id}`} className="block h-full">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>{post.date}</span>
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {post.category}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-muted-foreground mb-4 flex-grow">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center mt-auto pt-4 border-t border-border/50">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium mr-3">
                      {post.author
                        .split(' ')
                        .map((name) => name[0])
                        .join('')}
                    </div>
                    <span className="text-sm font-medium">{post.author}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {post.readTime}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </motion.div>

        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <Link
            href="/blog/all"
            className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-8 text-sm font-medium text-secondary-foreground shadow transition-colors hover:bg-secondary/90"
          >
            View All Articles
          </Link>
        </motion.div>
      </div>
    </>
  );
}
