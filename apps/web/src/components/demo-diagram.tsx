import type { JSX } from "react";

export function DemoDiagram(): JSX.Element {
  return (
    <svg
      className="demo-diagram"
      viewBox="0 0 800 520"
      role="img"
      aria-label="Bundled diagram of a sign bracket with a force applied at point B"
    >
      <defs>
        <linearGradient id="demo-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17202b" />
          <stop offset="1" stopColor="#0c1118" />
        </linearGradient>
        <marker
          id="demo-arrow"
          markerWidth="12"
          markerHeight="12"
          refX="8"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#65d9ae" />
        </marker>
      </defs>
      <rect width="800" height="520" rx="24" fill="url(#demo-panel)" />
      <g opacity=".28" stroke="#596575" strokeWidth="1">
        <path d="M80 104H720M80 208H720M80 312H720M80 416H720" />
        <path d="M160 64V456M320 64V456M480 64V456M640 64V456" />
      </g>
      <path
        d="M68 270H112L570 170"
        fill="none"
        stroke="#e8edf5"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68 218V322M41 218H95M41 322H95"
        fill="none"
        stroke="#718094"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="112" cy="270" r="20" fill="#0d131b" stroke="#83a6ff" strokeWidth="6" />
      <circle cx="570" cy="170" r="14" fill="#0d131b" stroke="#e8edf5" strokeWidth="5" />
      <path
        d="M570 170L692 300"
        fill="none"
        stroke="#65d9ae"
        strokeWidth="8"
        strokeLinecap="round"
        markerEnd="url(#demo-arrow)"
      />
      <path
        d="M169 258A70 70 0 0 0 163 240"
        fill="none"
        stroke="#83a6ff"
        strokeWidth="3"
      />
      <text x="88" y="316" fill="#b9c5d6" fontSize="24" fontFamily="var(--font-geist-mono)">
        A
      </text>
      <text x="584" y="155" fill="#b9c5d6" fontSize="24" fontFamily="var(--font-geist-mono)">
        B
      </text>
      <text x="640" y="218" fill="#75e2ba" fontSize="24" fontFamily="var(--font-geist-mono)">
        F = 180 N
      </text>
      <text x="300" y="210" fill="#8faeff" fontSize="22" fontFamily="var(--font-geist-mono)">
        r = 2.4 m
      </text>
      <text x="96" y="92" fill="#8995a6" fontSize="18" fontFamily="var(--font-geist-mono)">
        BUNDLED FIXTURE · MOMENT ABOUT A
      </text>
    </svg>
  );
}
