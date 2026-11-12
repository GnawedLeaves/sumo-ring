export function PageStub({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="page">
      <h1 className="text-center font-display text-heading-lg text-indigo-frame">{title}</h1>
      <div className="mt-10 rounded-card border border-black bg-white p-6 text-body-sm">
        {children ?? "Coming soon."}
      </div>
    </section>
  );
}
