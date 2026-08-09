"use client";

import React, { useEffect, useState } from "react";

interface FinexaCard3DProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  disabled?: boolean;
}

export function FinexaCard3D({
  children,
  className = "",
  glowColor = "rgba(212, 168, 67, 0.15)",
  disabled = false,
  ...props
}: FinexaCard3DProps) {
  const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)");
  const [boxShadow, setBoxShadow] = useState("");

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || typeof window === "undefined") return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;

    setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(6px) scale(1.01)`);
    setBoxShadow(`0 12px 30px -8px ${glowColor}, 0 4px 16px rgba(0, 0, 0, 0.2)`);
  };

  const handleMouseLeave = () => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)");
    setBoxShadow("");
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        boxShadow,
        transition: "transform 0.2s ease-out, box-shadow 0.25s ease-out",
        transformStyle: "preserve-3d",
        willChange: "transform, box-shadow",
      }}
      className={`fx-card-3d-interactive ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function FinexaStaggerContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`fx-stagger-container ${className}`}>{children}</div>;
}

export function FinexaStaggerItem({
  children,
  index = 0,
  className = "",
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <div
      style={{
        animation: `fxStaggerUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s forwards`,
        opacity: 0,
        transform: "translateY(12px)",
      }}
      className={className}
    >
      {children}
    </div>
  );
}

export function FinexaNumberCount({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 800; // ms

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out quad
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(Math.floor(easedProgress * value));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
