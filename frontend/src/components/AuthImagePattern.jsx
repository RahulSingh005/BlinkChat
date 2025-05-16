import React from "react";
import { MessageSquare } from "lucide-react";

const AuthImagePattern = ({ title, subtitle, children }) => {
  return (
    <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-primary/5 via-base-200 to-base-100 p-12 relative overflow-hidden">
      <div className="absolute -top-16 -left-16 w-48 h-48 bg-primary/10 rounded-full blur-2xl opacity-40 pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-accent/10 rounded-full blur-2xl opacity-30 pointer-events-none" />

      <div className="max-w-md w-full text-center z-10">
        <div className="grid grid-cols-4 gap-3 mb-10">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`
                aspect-square rounded-2xl flex items-center justify-center
                ${i % 3 === 0 ? "bg-primary/20 animate-pulse" : "bg-base-300/30"}
                ${i === 2 ? "col-span-2 row-span-1" : ""}
              `}
            >
              {i === 0 && (
                <MessageSquare className="w-7 h-7 text-primary/80" />
              )}
            </div>
          ))}
        </div>
        <h2 className="text-3xl font-extrabold mb-3 text-base-content">{title}</h2>
        <p className="text-base-content/70 mb-6">{subtitle}</p>
        {children}
      </div>
    </div>
  );
};

export default AuthImagePattern;
