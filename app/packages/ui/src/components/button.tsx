import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

/**
 * shadcn/ui-style button primitive using the documented design tokens.
 * Controls are 10 px radius with at least a 44 px mobile hit area.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 py-2',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
        quiet: 'bg-transparent text-ink-soft hover:bg-canvas hover:text-ink',
        danger: 'bg-danger text-white hover:bg-danger/90',
        success: 'bg-success text-white hover:bg-success/90',
        review: 'bg-review-bg text-review border border-review/30 hover:bg-review/10',
      },
      size: {
        default: 'min-h-11',
        sm: 'min-h-11 sm:min-h-9 px-3 py-1.5 text-[13px]',
        lg: 'min-h-12 px-5',
        icon: 'h-11 w-11 px-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return (
      <Component className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
