// Page Header
// ===========
// Consistent header for all pages. Takes a title and optional
// description. No "use client" needed — this is a pure Server
// Component (just renders HTML, no interactivity).

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode; // slot for action buttons
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}
