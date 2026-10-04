import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../utils';

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-[13px] font-medium text-ink', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex min-h-11 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 sm:text-sm',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[88px] w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 sm:text-sm',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      'h-5 w-5 rounded border-line text-primary focus-visible:ring-2 focus-visible:ring-primary/40',
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';

/** In-app menu; existing form callers consume target.value through this adapter. */
export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  id,
  name,
  disabled,
  required,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>): React.ReactElement {
  const empty = '__glucoflow_empty__';
  const options: {
    value: string;
    label: React.ReactNode;
    disabled: boolean;
  }[] = [];
  const collect = (nodes: React.ReactNode): void =>
    React.Children.forEach(nodes, (node) => {
      if (
        !React.isValidElement<{
          value?: string | number;
          children?: React.ReactNode;
          disabled?: boolean;
        }>(node)
      )
        return;
      if (node.type === 'option')
        options.push({
          value: String(node.props.value ?? (typeof node.props.children === 'string' || typeof node.props.children === 'number' ? node.props.children : '')),
          label: node.props.children,
          disabled: !!node.props.disabled,
        });
      else if (node.props.children) collect(node.props.children);
    });
  collect(children);
  const [uncontrolled, setUncontrolled] = React.useState(
    String(defaultValue ?? options[0]?.value ?? ''),
  );
  const selected = String(value ?? uncontrolled);
  return (
    <SelectPrimitive.Root
      name={name}
      value={selected || empty}
      disabled={disabled}
      required={required}
      onValueChange={(next) => {
        const nextValue = next === empty ? '' : next;
        setUncontrolled(nextValue);
        onChange?.({
          target: { value: nextValue, name, id },
          currentTarget: { value: nextValue, name, id },
        } as React.ChangeEvent<HTMLSelectElement>);
      }}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-invalid={props['aria-invalid']}
        className={cn(
          'inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-line bg-surface px-3 py-2 text-left text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 sm:text-sm',
          className,
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <ChevronDown
            size={16}
            className="shrink-0 text-ink-soft"
            aria-hidden
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[110] max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-xl"
        >
          <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center">
            <ChevronUp size={16} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value || empty}
                value={option.value || empty}
                disabled={option.disabled}
                className="relative flex min-h-11 cursor-default items-center rounded-lg py-2 pl-3 pr-9 text-sm text-ink outline-none data-[highlighted]:bg-primary/10 data-[disabled]:opacity-40"
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 text-primary">
                  <Check size={16} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center">
            <ChevronDown size={16} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
