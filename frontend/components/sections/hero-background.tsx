"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

const PARTICLE_COLOR = "34, 211, 238"; // rgb of cyan-400, matches --primary
const LINK_DISTANCE = 130;
const MOUSE_DISTANCE = 180;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let mouse: { x: number; y: number } | null = null;
    let rafId = 0;

    const seedParticles = () => {
      const count = Math.min(90, Math.max(30, Math.floor((width * height) / 16000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 1,
      }));
    };

    const resize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = newWidth * dpr;
      canvas.height = newHeight * dpr;
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const changedSignificantly =
        Math.abs(newWidth - width) > 4 || Math.abs(newHeight - height) > 4;
      width = newWidth;
      height = newHeight;

      if (changedSignificantly || particles.length === 0) {
        seedParticles();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMouseLeave = () => {
      mouse = null;
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PARTICLE_COLOR}, 0.5)`;
        ctx.fill();
      }
    };

    const step = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x <= 0 || p.x >= width) p.vx *= -1;
        if (p.y <= 0 || p.y >= height) p.vy *= -1;
        p.x = Math.min(Math.max(p.x, 0), width);
        p.y = Math.min(Math.max(p.y, 0), height);
      }

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DISTANCE) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${PARTICLE_COLOR}, ${0.18 * (1 - dist / LINK_DISTANCE)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        if (mouse) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_DISTANCE) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(${PARTICLE_COLOR}, ${0.45 * (1 - dist / MOUSE_DISTANCE)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PARTICLE_COLOR}, 0.7)`;
        ctx.fill();
      }

      if (mouse) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PARTICLE_COLOR}, 0.9)`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(step);
    };

    resize();
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduceMotion) drawStatic();
    });
    resizeObserver.observe(container);

    if (reduceMotion) {
      drawStatic();
    } else {
      rafId = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [reduceMotion]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="pointer-events-auto absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_78%,var(--background)_100%)]" />
    </div>
  );
}
