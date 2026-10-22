interface AppIconProps {
  className?: string;
}

/** The same rounded pet tile is used by the window chrome and the Windows package icons. */
export function AppIcon({ className = '' }: AppIconProps) {
  return <img className={`app-icon ${className}`.trim()} src="/xiaofanqie-icon.png" alt="" aria-hidden="true" />;
}
