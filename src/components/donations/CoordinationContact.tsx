export function CoordinationContact({ title, name, phone, email }: { title: string; name: string; phone: string | null; email: string }) {
  const dialable = phone?.replace(/[^+0-9]/g, '')
  return <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
    <h3 className="text-sm font-semibold text-ink">{title}</h3>
    <p className="mt-2 font-medium">{name}</p>
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-muted">Mobile</dt><dd className="mt-1 break-all">{phone && dialable ? <a className="font-medium text-forest underline" href={`tel:${dialable}`}>{phone}</a> : 'Not provided'}</dd></div>
      <div><dt className="text-muted">Email</dt><dd className="mt-1 break-all"><a className="font-medium text-forest underline" href={`mailto:${email}`}>{email}</a></dd></div>
    </dl>
    <p className="mt-3 text-xs text-muted">Shared with participants in this accepted donation for collection coordination.</p>
  </div>
}
