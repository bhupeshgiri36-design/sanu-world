import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Globe, MapPin, Heart, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import NativeAd from './ads/NativeAd';
import SponsoredLink from './ads/SponsoredLink';

export default function Landing() {
  const navigate = useNavigate();

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" }
  };

  const staggerChildren = {
    animate: {
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-zinc-100 font-sans selection:bg-pink-500/30 overflow-x-hidden">
      {/* Background Soft Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <motion.div 
          animate={{ y: [0, -30, 0], scale: [1, 1.05, 1], x: [0, 20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] right-[-5%] w-[40%] h-[50%] rounded-full bg-[#ff7ba9]/10 blur-[150px]" 
        />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0D0D0F]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex flex-col items-center cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <span className="text-3xl font-serif tracking-wide text-white leading-none mb-1">SANU</span>
            <span className="text-[10px] font-sans tracking-[0.3em] text-zinc-400 uppercase leading-none">World</span>
          </div>

                   <div className="flex items-center gap-6">
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/join')} 
              className="text-sm font-semibold bg-gradient-to-r from-[#f472b6] to-[#ec4899] text-white px-6 py-2.5 rounded-full hover:shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all flex items-center gap-2"
            >
              <Heart size={16} className="fill-white" /> Let's Connect
            </motion.button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-24">
        
        {/* Hero Section */}
        <motion.section 
          className="max-w-7xl mx-auto px-6 pt-16 pb-12 md:py-24 flex flex-col md:flex-row items-center gap-12"
          initial="initial"
          animate="animate"
          variants={staggerChildren}
        >
          {/* Left Content */}
          <div className="flex-1 text-center md:text-left z-10">
            <motion.div variants={fadeIn} className="text-[#ff8bb3] text-sm md:text-base tracking-[0.2em] font-medium uppercase mb-4">
              Welcome To
            </motion.div>
            
            <motion.h1 variants={fadeIn} className="text-6xl md:text-8xl font-serif text-white tracking-tight mb-6 leading-tight">
              Sanu World
            </motion.h1>

            {/* Decorative Divider */}
            <motion.div variants={fadeIn} className="flex items-center justify-center md:justify-start gap-3 mb-8 opacity-80">
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#ff8bb3]"></div>
              <Heart size={14} className="text-[#ff8bb3] fill-[#ff8bb3]" />
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#ff8bb3]"></div>
            </motion.div>
            
            <motion.p variants={fadeIn} className="text-lg md:text-xl text-zinc-300 font-light max-w-lg mb-10 leading-relaxed mx-auto md:mx-0">
              A journey of dreams, style & confidence.<br/>
              Be your own kind of beautiful.
            </motion.p>
            
            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center gap-5 justify-center md:justify-start">
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/join')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#f472b6] to-[#ec4899] text-white font-semibold px-8 py-3.5 rounded-full shadow-[0_10px_30px_rgba(236,72,153,0.3)] hover:shadow-[0_15px_40px_rgba(236,72,153,0.4)] transition-all"
              >
                Chat with Sanu <Heart size={16} className="fill-white" />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  document.getElementById('profile').scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-transparent border border-zinc-700 hover:border-[#ff8bb3] text-white font-semibold px-8 py-3.5 rounded-full transition-all"
              >
                About Me
              </motion.button>
            </motion.div>
          </div>

          {/* Right Image */}
          <motion.div variants={fadeIn} className="flex-1 relative mt-10 md:mt-0 w-full max-w-md mx-auto">
            {/* Floating Hearts */}
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-6 -left-6 z-20">
              <Heart size={20} className="text-[#ff8bb3]" />
            </motion.div>
            <motion.div animate={{ y: [0, 15, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute top-1/3 -right-8 z-20">
              <Heart size={14} className="text-[#f472b6] fill-[#f472b6] opacity-60" />
            </motion.div>
            <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-10 -left-10 z-20">
              <Heart size={18} className="text-[#ec4899] opacity-80" />
            </motion.div>

            {/* Profile Image Box */}
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 group">
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F]/80 via-transparent to-transparent z-10"></div>
              <img src="/sanu-profile.jpg" alt="Sanu" className="w-full h-auto object-cover aspect-[4/5] transform group-hover:scale-105 transition-transform duration-700"  />
              
              <div className="absolute bottom-6 right-6 z-20 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex flex-col items-center">
                 <div className="w-8 h-8 rounded-full bg-[#f472b6] flex items-center justify-center -mt-8 mb-2 shadow-lg">
                   <Heart size={14} className="text-white fill-white" />
                 </div>
                 <p className="text-white text-sm font-medium">Be You.<br/>Do You.</p>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* Homepage ad — real NativeAd component now, was a static
            placeholder div before. NativeAd already hides itself for
            admin via useIsAdmin(), no extra check needed here. */}
        <div className="max-w-3xl mx-auto w-full px-6 py-10">
          <NativeAd />
        </div>

        {/* Profile Section */}
        <section id="profile" className="max-w-5xl mx-auto px-6 py-20">
          <div className="bg-[#151518] border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl flex flex-col md:flex-row gap-10 items-center">
            
            {/* Image */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="shrink-0 relative w-48 h-56 md:w-64 md:h-80 rounded-[2rem] overflow-hidden shadow-xl"
            >
              <img src="/sanu-profile.jpg" alt="Sanu Profile" className="w-full h-full object-cover"  />
            </motion.div>

            {/* Text */}
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-serif text-[#ff8bb3] italic text-xl mb-2">About Me</h3>
              <h2 className="text-4xl font-serif text-white mb-6 flex items-center justify-center md:justify-start gap-3">
                Hey, I'm Sanu <Heart size={24} className="text-[#f472b6] fill-[#f472b6]" />
              </h2>
              <p className="text-zinc-300 leading-relaxed mb-8 font-light text-lg max-w-lg">
                This is my little world where I share pieces of my life, style, thoughts, and everything that makes me, me. Thank you for being a part of my journey. Let's hang out in my private chat spaces!
              </p>
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/join')} 
                className="bg-gradient-to-r from-[#f472b6] to-[#ec4899] text-white font-medium py-3 px-8 rounded-full shadow-[0_5px_20px_rgba(236,72,153,0.3)] hover:shadow-[0_10px_30px_rgba(236,72,153,0.4)] transition-all"
              >
                Chat with Sanu &rarr;
              </motion.button>
            </div>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0A0A0C] relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start">
            <span className="text-xl font-serif tracking-wide text-white leading-none">SANU</span>
            <span className="text-[8px] font-sans tracking-[0.2em] text-zinc-500 uppercase leading-none">World</span>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="text-zinc-600 text-sm font-light">
              © {new Date().getFullYear()} SANU WORLD. All rights reserved.
            </div>
            <SponsoredLink />
          </div>
        </div>
      </footer>
    </div>
  );
}
