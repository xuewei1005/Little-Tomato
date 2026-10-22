interface PetBubbleProps {
  children: string;
  compact?: boolean;
}

export function PetBubble({ children, compact = false }: PetBubbleProps) {
  return <div className={compact ? 'pet-window-bubble' : 'pet-card-message'}>{children}</div>;
}
