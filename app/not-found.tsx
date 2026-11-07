import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-10">
      <div className="card max-w-md p-6 text-center">
        <div className="text-[40px] font-bold text-primary">404</div>
        <h2 className="text-[16px] font-bold">Not found</h2>
        <p className="mt-1 text-[13px] text-muted">That load or page doesn&apos;t exist (it may have been removed by a market reset).</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/loads/search" className="btn btn-primary">
            Load board
          </Link>
          <Link href="/dashboard" className="btn btn-outline">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
