import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ifm-blue text-white hover:bg-ifm-blue/90',
  secondary: 'bg-white text-ifm-blue border border-ifm-gray/40 hover:bg-ifm-lightblue/50',
  danger: 'bg-ifm-red text-white hover:bg-ifm-red/90',
  ghost: 'text-ifm-blue hover:bg-ifm-lightblue/60',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

/* ---------- TextInput ---------- */

export function TextInput({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm font-medium text-ifm-blue mb-1">{label}</span>
      )}
      <input
        className={`w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue focus:ring-2 focus:ring-ifm-blue/20 ${className}`}
        {...props}
      />
    </label>
  )
}

/* ---------- Textarea ---------- */

export function Textarea({
  label,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm font-medium text-ifm-blue mb-1">{label}</span>
      )}
      <textarea
        className={`w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue focus:ring-2 focus:ring-ifm-blue/20 ${className}`}
        {...props}
      />
    </label>
  )
}

/* ---------- Card ---------- */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm p-5 ${className}`}>{children}</div>
  )
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ifm-blue/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ifm-blue mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}

/* ---------- States ---------- */

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ifm-gray/30 bg-white/60 p-10 text-center text-ifm-gray">
      {children}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-ifm-red/10 text-ifm-red text-sm p-3">{message}</div>
  )
}
