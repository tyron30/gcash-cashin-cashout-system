export default function PageHeader({ title, description }) {
  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
      {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
    </div>
  )
}
