export default function Code({ children }: { children: string }) {
  return (
    <pre className="slim mono mt-3 overflow-x-auto border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[11px] leading-relaxed text-[var(--muted)]">
      <code>{children}</code>
    </pre>
  );
}
