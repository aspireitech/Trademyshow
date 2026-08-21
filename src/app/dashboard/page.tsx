import GroupsPanel from "@/components/GroupsPanel";
import IndexStrip from "@/components/IndexStrip";
import MarketMovers from "@/components/MarketMovers";
import StockSearch from "@/components/StockSearch";

export default function DashboardPage() {
  return (
    <>
      <IndexStrip />
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ marginBottom: 4 }}>Analyze any stock</h2>
        <p className="dim" style={{ fontSize: 14, marginBottom: 12 }}>
          Look up a single stock for its price, trend across every timeframe, and latest news.
        </p>
        <StockSearch />
      </section>
      <GroupsPanel />
      <div style={{ marginTop: 30 }}>
        <MarketMovers />
      </div>
    </>
  );
}
