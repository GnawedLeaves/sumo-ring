import { TabNav } from "@/components/tab-nav";

export function BashoTabs({ active }: { active: "current" | "history" }) {
  return (
    <TabNav
      active={active}
      tabs={[
        { key: "current", href: "/basho", label: "Current basho" },
        { key: "history", href: "/basho/history", label: "History" },
      ]}
    />
  );
}
