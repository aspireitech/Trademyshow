import GroupsPanel from "@/components/GroupsPanel";
import StockSearch from "@/components/StockSearch";

export default function DashboardPage() {
  return (
    <>
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ marginBottom: 4 }}>Analyze any stock</h2>
        <p className="dim" style={{ fontSize: 14, marginBottom: 12 }}>
          Look up a single stock for its price, trend across every timeframe, and latest news.
        </p>
        <StockSearch />
      </section>
      <GroupsPanel />
    </>
  );
}
