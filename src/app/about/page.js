"use client";

import { motion } from 'framer-motion';
import { Check, ChevronRight, Users, Code, Clock, Award, } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AboutPage() {
  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };
  
  const fadeInLeft = {
    hidden: { opacity: 0, x: -30 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.6 }
    }
  };
  
  const fadeInRight = {
    hidden: { opacity: 0, x: 30 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.6 }
    }
  };
  
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  // Team members
  const team = [
    {
      name: 'Alex Johnson',
      position: 'CEO & Founder',
      bio: 'With over 15 years of experience in software development and business management, Alex leads Wehoware with a focus on innovation and client success.',
      image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8OHx8YnVzaW5lc3MlMjBwZXJzb258ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60'
    },
    {
      name: 'Sarah Patel',
      position: 'CTO',  
      bio: 'Sarah brings a wealth of technical expertise and a passion for cutting-edge technologies. She oversees all technical aspects of Wehoware solutions.',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8YnVzaW5lc3MlMjB3b21hbnxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60'
    },
    {
      name: 'Michael Lee',
      position: 'Head of Design',
      bio: 'Michael leads our design team with a keen eye for aesthetics and user experience. His work ensures our solutions are both beautiful and functional.',
      image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MTh8fGJ1c2luZXNzJTIwcGVyc29ufGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60'
    },
    {
      name: 'Emily Rodriguez',
      position: 'Client Relations Director',
      bio: 'Emily ensures our clients receive exceptional service from the first interaction to project completion and beyond.',
      image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8Y29ycG9yYXRlJTIwd29tYW58ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60'
    }
  ];

  // Values
  const values = [
    {
      icon: <Users className="h-12 w-12 text-primary" />,
      title: 'Client-Focused',
      description: 'Our clients success is our success. We work closely with each client to understand their unique needs and deliver solutions that exceed expectations.'
    },
    {
      icon: <Code className="h-12 w-12 text-primary" />,
      title: 'Technical Excellence',
      description: 'We pursue excellence in every line of code, every design element, and every business solution we deliver.'
    },
    {
      icon: <Clock className="h-12 w-12 text-primary" />,
      title: 'Efficiency',
      description: 'We value your time and resources. Our solutions are designed to optimize processes and deliver maximum value.'
    },
    {
      icon: <Award className="h-12 w-12 text-primary" />,
      title: 'Quality',
      description: 'Quality is non-negotiable. We implement rigorous testing and quality assurance processes in everything we do.'
    }
  ];

  // Milestones
  const milestones = [
    {
      year: '2018',
      title: 'Company Founded',
      description: 'Wehoware Technologies was established with a vision to transform businesses through technology.'
    },
    {
      year: '2019',
      title: 'First Enterprise Client',
      description: 'Secured our first major enterprise client and delivered a comprehensive digital transformation solution.'
    },
    {
      year: '2020',
      title: 'Team Expansion',
      description: 'Doubled our team size and expanded service offerings to include mobile development and cloud solutions.'
    },
    {
      year: '2021',
      title: 'International Expansion',
      description: 'Opened our first international office and began serving clients across North America and Europe.'
    },
    {
      year: '2022',
      title: 'Award Recognition',
      description: 'Recognized as a leader in technology innovation with multiple industry awards.'
    },
    {
      year: '2023',
      title: 'Platform Launch',
      description: 'Launched our proprietary SaaS platform, enabling clients to manage their digital assets more effectively.'
    }
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-background to-transparent" />
      </div>
      
      {/* Hero Section */}
      <section className="relative z-10 py-24 md:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-2"
            >
              <Badge variant="outline" className="px-4 py-1 border-primary/20 bg-primary/5 text-primary rounded-full">About Us</Badge>
            </motion.div>
            
            <motion.h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              We Are <span className="text-primary">Wehoware</span>
            </motion.h1>
            
            <motion.p 
              className="max-w-[700px] text-lg text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Transforming businesses through innovative technology solutions and exceptional service.
              We blend creativity with technical expertise to deliver solutions that drive growth.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 mt-6"
            >
              <Button size="lg" className="group">
                Our Services
                <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline">
                Contact Us
              </Button>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Mission Section */}
      <section className="relative z-10 py-16 md:py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              variants={fadeInLeft}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="space-y-6"
            >
              <Badge variant="secondary" className="mb-2">Our Mission</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Empowering Through Technology</h2>
              <p className="text-lg text-muted-foreground">
                At Wehoware Technologies, our mission is to empower businesses to achieve their full potential through innovative technology solutions. We believe that the right technology, thoughtfully applied, can transform organizations and create new possibilities.
              </p>
              <ul className="space-y-2">
                {['Client-focused approach', 'Innovative solutions', 'Technical excellence', 'Long-term partnerships'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            
            <motion.div
              variants={fadeInRight}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-xl blur-xl opacity-50"></div>
              <div className="relative bg-card border rounded-xl overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8dGVhbSUyMG1lZXRpbmd8ZW58MHx8MHx8&auto=format&fit=crop&w=800&q=60" 
                  alt="Team meeting"
                  className="w-full h-80 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">Working Together</h3>
                  <p className="text-muted-foreground">
                    Our collaborative approach ensures we understand your business needs and deliver solutions that drive real results.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Our Values */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12 md:mb-16">
            <Badge variant="outline" className="mb-2">Our Values</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">What Drives Us Forward</h2>
            <p className="max-w-[700px] mx-auto text-lg text-muted-foreground">
              Our core values shape everything we do, from how we develop solutions to how we interact with clients.
            </p>
          </div>
          
          <motion.div 
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {values.map((value, index) => (
              <motion.div 
                key={index}
                variants={fadeIn}
                className="bg-card border rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:border-primary/40"
                whileHover={{ y: -5 }}
              >
                <div className="p-2 bg-primary/10 rounded-lg w-fit mb-4">
                  {value.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      
      {/* Our Team */}
      <section className="relative z-10 py-16 md:py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12 md:mb-16">
            <Badge variant="outline" className="mb-2">Our Team</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Meet The Experts</h2>
            <p className="max-w-[700px] mx-auto text-lg text-muted-foreground">
              Our diverse team brings together decades of experience in technology, design, and business strategy.
            </p>
          </div>
          
          <motion.div 
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {team.map((member, index) => (
              <motion.div 
                key={index}
                variants={fadeIn}
                className="bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300"
                whileHover={{ y: -5 }}
              >
                <div className="relative h-64">
                  <img 
                    src={member.image} 
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-4 text-white">
                    <h3 className="text-xl font-semibold">{member.name}</h3>
                    <p className="text-sm opacity-90">{member.position}</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-muted-foreground">{member.bio}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      
      {/* Timeline */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12 md:mb-16">
            <Badge variant="outline" className="mb-2">Our Journey</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Company Milestones</h2>
            <p className="max-w-[700px] mx-auto text-lg text-muted-foreground">
              From our founding to where we are today, each step has strengthened our commitment to excellence.
            </p>
          </div>
          
          <div className="relative max-w-3xl mx-auto">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-border"></div>
            
            {/* Timeline items */}
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <motion.div 
                  key={index}
                  className={`relative ${index % 2 === 0 ? 'text-right pr-8 md:ml-auto md:mr-[50%]' : 'pl-8 md:mr-auto md:ml-[50%]'}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  {/* Timeline dot */}
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-primary"></div>
                  
                  <Card className={index % 2 === 0 ? 'mr-4' : 'ml-4'}>
                    <CardContent className="p-6">
                      <Badge className="mb-2" variant="secondary">{milestone.year}</Badge>
                      <h3 className="text-xl font-semibold mb-2">{milestone.title}</h3>
                      <p className="text-muted-foreground">{milestone.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="container px-4 md:px-6">
          <motion.div 
            className="relative rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20"></div>
            <div className="relative p-8 md:p-12 lg:p-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Ready to Transform Your Business?</h2>
              <p className="max-w-[700px] mx-auto text-lg text-muted-foreground mb-8">
                Partner with Wehoware Technologies and unlock the full potential of your business through innovative technology solutions.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button size="lg" className="group">
                  Get Started
                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Decorative elements */}
      <div className="absolute top-1/4 left-10 h-64 w-64 rounded-full bg-primary/5 blur-3xl"></div>
      <div className="absolute bottom-1/3 right-10 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl"></div>
    </div>
  );
}
