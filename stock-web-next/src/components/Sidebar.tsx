"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/", label: "已清仓股票" },
  { href: "/original-delivery", label: "原始交割单" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-lg font-semibold text-gray-800">股票管理系统</h1>
      </div>
      <nav className="flex-1 py-4">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-2 text-sm ${
              pathname === item.href
                ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
