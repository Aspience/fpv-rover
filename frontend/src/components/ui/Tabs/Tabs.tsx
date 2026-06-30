import { clsx } from 'clsx'
import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
  baseId: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

const useTabsContext = (): TabsContextValue => {
  const ctx = useContext(TabsContext)
  if (ctx === null) {
    throw new Error('Tabs components must be used within <Tabs>')
  }
  return ctx
}

interface TabsProps {
  children: ReactNode
  /** Controlled active tab value. */
  value?: string
  /** Initial active tab value for uncontrolled usage. */
  defaultValue?: string
  onChange?: (value: string) => void
  className?: string
}

export const Tabs = ({
  children,
  value,
  defaultValue = '',
  onChange,
  className = '',
}: TabsProps) => {
  const baseId = useId()
  const [internalValue, setInternalValue] = useState(defaultValue)
  const isControlled = value !== undefined
  const activeValue = isControlled ? value : internalValue

  const ctx = useMemo<TabsContextValue>(
    () => ({
      value: activeValue,
      setValue: (next) => {
        if (!isControlled) setInternalValue(next)
        onChange?.(next)
      },
      baseId,
    }),
    [activeValue, baseId, isControlled, onChange],
  )

  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabListProps {
  children: ReactNode
  className?: string
  'aria-label'?: string
}

export const TabList = ({ children, className = '', ...props }: TabListProps) => (
  <div
    role="tablist"
    className={clsx(
      'mb-3 flex gap-1 border-b border-osd-primary/20',
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

interface TabProps {
  value: string
  children: ReactNode
  className?: string
}

export const Tab = ({ value, children, className = '' }: TabProps) => {
  const { value: active, setValue, baseId } = useTabsContext()
  const selected = active === value

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => setValue(value)}
      className={clsx(
        'cursor-pointer border-b-2 px-3 py-1.5 text-osd-sm font-medium transition-colors duration-150 -mb-px',
        selected
          ? 'border-osd-primary text-osd-primary'
          : 'border-transparent text-osd-muted hover:text-osd-primary',
        className,
      )}
    >
      {children}
    </button>
  )
}

interface TabPanelProps {
  value: string
  children: ReactNode
  className?: string
}

export const TabPanel = ({ value, children, className = '' }: TabPanelProps) => {
  const { value: active, baseId } = useTabsContext()
  if (active !== value) return null

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      className={className}
    >
      {children}
    </div>
  )
}
