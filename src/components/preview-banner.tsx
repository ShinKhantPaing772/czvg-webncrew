"use client";

export function PreviewBanner() {
  if (process.env.NEXT_PUBLIC_CREW_PREVIEW !== "1") return null;

  return (
    <div className="sticky top-0 z-[100] bg-amber-500 px-3 py-1.5 text-center text-[12px] font-medium text-amber-950">
      预览模式 · 假数据 · 不连接数据库 · 写入不会保存
    </div>
  );
}
