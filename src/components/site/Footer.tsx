export function Footer() {
  return (
    <footer className="border-t border-border/40 mt-24">
      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} ARX Hub. All rights reserved.</p>
        <p className="font-mono text-xs">Built for competitors. Powered by ARX.</p>
      </div>
    </footer>
  );
}