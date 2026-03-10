"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function DateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentDays = searchParams.get("days") || "all";

  const options = [
    { label: "7 Hari", value: "7" },
    { label: "30 Hari", value: "30" },
    { label: "Tahun Ini", value: "365" },
    { label: "Semua", value: "all" },
  ];

  const handleSelect = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val === "all") {
      params.delete("days");
    } else {
      params.set("days", val);
    }
    
    // reset pagination if exists
    params.delete("page");

    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex bg-black p-0.5 rounded-md border border-white/15 w-fit">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleSelect(opt.value)}
          className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
            currentDays === opt.value
              ? "bg-violet-500/20 text-violet-300 shadow-sm"
              : "text-[#55556a] hover:text-[#e2e2e8] hover:bg-white/5"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
