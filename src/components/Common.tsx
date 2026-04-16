import React, { useRef } from 'react';

export function HorizontalScrollArea({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode, 
  className?: string 
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`relative group ${className}`}>
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-4 pt-2 px-1 scroll-smooth"
      >
        {children}
      </div>
    </div>
  );
}
