import React from 'react';
import { METHODOLOGIES } from '../constants';
import { BookOpen, CheckCircle2, FileText, Scale } from 'lucide-react';
import { motion } from 'motion/react';

export const Methodology: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-6">
      {METHODOLOGIES.map((m, i) => (
        <motion.div
          key={m.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
        >
          <div className="p-6 bg-stone-50 border-b border-stone-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-600">
              {i === 0 ? <Scale className="w-6 h-6" /> : i === 1 ? <FileText className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
            </div>
            <h3 className="text-xl font-bold text-stone-900">{m.title}</h3>
          </div>
          <div className="p-8 space-y-6">
            {m.steps.map((step, idx) => (
              <div key={idx} className="flex gap-4 group">
                <div className="shrink-0 mt-1 text-emerald-600 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-stone-700 leading-relaxed font-medium">
                  {step}
                </p>
              </div>
            ))}
          </div>
          <div className="p-6 bg-stone-50 border-t border-stone-200">
            <button className="w-full py-3 px-4 bg-stone-900 text-white rounded-xl font-semibold hover:bg-stone-800 transition-colors shadow-sm">
              S'entraîner sur ce format
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
