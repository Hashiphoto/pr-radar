interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'currentColor',
  'aria-hidden': true,
  className,
});

export const RefreshIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 2.5a5.5 5.5 0 1 0 5.478 6.02.75.75 0 1 1 1.494.14A7 7 0 1 1 8 1a6.98 6.98 0 0 1 4.5 1.646V1.75a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1 0-1.5h1.36A5.48 5.48 0 0 0 8 2.5Z" />
  </svg>
);

export const GearIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0-5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
    <path d="M6.94.75a.75.75 0 0 1 .74-.63h.64a.75.75 0 0 1 .74.63l.16 1.02a5.9 5.9 0 0 1 1.2.5l.83-.62a.75.75 0 0 1 .98.07l.45.45a.75.75 0 0 1 .07.98l-.61.83c.21.38.38.78.5 1.2l1.01.16a.75.75 0 0 1 .63.74v.64a.75.75 0 0 1-.63.74l-1.01.16a5.9 5.9 0 0 1-.5 1.2l.61.83a.75.75 0 0 1-.07.98l-.45.45a.75.75 0 0 1-.98.07l-.83-.61c-.38.21-.78.38-1.2.5l-.16 1.01a.75.75 0 0 1-.74.63h-.64a.75.75 0 0 1-.74-.63l-.16-1.01a5.9 5.9 0 0 1-1.2-.5l-.83.61a.75.75 0 0 1-.98-.07l-.45-.45a.75.75 0 0 1-.07-.98l.61-.83a5.9 5.9 0 0 1-.5-1.2L.75 8.86a.75.75 0 0 1-.63-.74V7.5a.75.75 0 0 1 .63-.74l1.01-.16c.12-.42.29-.82.5-1.2l-.61-.83a.75.75 0 0 1 .07-.98l.45-.45a.75.75 0 0 1 .98-.07l.83.61c.38-.21.78-.38 1.2-.5L6.94.75Z" opacity=".38" />
  </svg>
);

export const StarIcon = ({ size = 15, className, filled = false }: IconProps & { filled?: boolean }) =>
  filled ? (
    <svg {...base(size, className)}>
      <path d="M8 .5l2.06 4.42 4.69.6-3.44 3.24.87 4.74L8 11.2l-4.18 2.3.87-4.74L1.25 5.52l4.69-.6L8 .5Z" />
    </svg>
  ) : (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M8 1.4l1.87 4 4.13.52-3.03 2.86.77 4.16L8 10.86l-3.74 2.08.77-4.16L2 5.92l4.13-.52L8 1.4Z" />
    </svg>
  );

export const CloseIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
  </svg>
);

export const MuteIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 1.5A6.5 6.5 0 1 0 8 14.5 6.5 6.5 0 0 0 8 1.5ZM3 8a5 5 0 0 1 7.9-4.08L3.92 10.9A4.98 4.98 0 0 1 3 8Zm2.1 4.08 6.98-6.98A5 5 0 0 1 5.1 12.08Z" />
  </svg>
);

export const UndoIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2.75 3a.75.75 0 0 1 .75.75v1.6A6.5 6.5 0 1 1 1.5 9.9a.75.75 0 1 1 1.48-.25A5 5 0 1 0 4.6 5.5H6.5a.75.75 0 0 1 0 1.5h-3.75A.75.75 0 0 1 2 6.25v-2.5A.75.75 0 0 1 2.75 3Z" />
  </svg>
);

export const ChevronIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
  </svg>
);

export const SunIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-4a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0Zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13ZM0 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8Zm13 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 13 8ZM2.34 2.34a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06L2.34 3.4a.75.75 0 0 1 0-1.06Zm9.2 9.2a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm2.12-9.2a.75.75 0 0 1 0 1.06L12.6 4.46a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Zm-9.2 9.2a.75.75 0 0 1 0 1.06L3.4 13.66a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Z" />
  </svg>
);

export const MoonIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M9.6.3a.75.75 0 0 1 .3.98A5.5 5.5 0 0 0 15.4 9.5a.75.75 0 0 1 .9 1.05A7 7 0 1 1 8.6.1a.75.75 0 0 1 1 .2Z" />
  </svg>
);
