import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, HandHeart, MapPin, Sparkles, Truck, Utensils, Building2, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoodShare — Share surplus food with NGOs" },
      { name: "description", content: "Post your extra food. NGOs nearby get notified instantly. Together, we cut food waste and feed more people." },
      { property: "og:title", content: "FoodShare — Share surplus food with NGOs" },
      { property: "og:description", content: "Post your extra food. NGOs nearby get notified instantly. Together, we cut food waste and feed more people." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_platform_stats");
      return data?.[0] ?? { total_donations: 0, delivered: 0, active_ngos: 0, in_progress: 0 };
    },
    refetchInterval: 30_000,
  });

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="absolute -top-24 -right-24 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Reduce food waste · Feed your community
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
              Surplus food, <span className="text-primary">shared in minutes</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              FoodShare connects restaurants, events and households with nearby NGOs so surplus
              meals get to people who need them — before they go to waste.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Donate food <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Register your NGO</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE STATS */}
      <section className="border-b bg-card/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
          <Stat icon={Utensils} label="Donations posted" value={stats?.total_donations ?? 0} />
          <Stat icon={HandHeart} label="Meals delivered" value={stats?.delivered ?? 0} />
          <Stat icon={Building2} label="Verified NGOs" value={stats?.active_ngos ?? 0} />
          <Stat icon={Leaf} label="Pickups in progress" value={stats?.in_progress ?? 0} />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How FoodShare works</h2>
          <p className="mt-3 text-muted-foreground">Three steps from surplus to shared meal.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { icon: HandHeart, title: "Post a donation", body: "Tell us what food you have, how much, and where to pick it up — with a photo if you can." },
            { icon: MapPin, title: "Match instantly", body: "Verified NGOs nearby are notified the moment your donation goes live." },
            { icon: Truck, title: "Track pickup", body: "Follow the donation from accepted to delivered — with realtime updates for both sides." },
          ].map((f, i) => (
            <div key={f.title} className="group relative rounded-xl border bg-card p-6 transition-shadow hover:shadow-lg">
              <div className="absolute -top-3 left-6 rounded-full border bg-background px-2 py-0.5 text-xs font-semibold text-primary">Step {i + 1}</div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">For donors</span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Turn leftovers into impact.</h2>
              <p className="mt-4 text-muted-foreground">
                Restaurants, wedding halls, canteens, households — anyone with extra food. Post in
                under a minute. A nearby NGO will confirm pickup within your set window.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex gap-2"><Check /> Address autocomplete with map</li>
                <li className="flex gap-2"><Check /> Photo + quantity for clarity</li>
                <li className="flex gap-2"><Check /> Realtime status updates</li>
              </ul>
            </div>
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">For NGOs</span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Every meal, closer than you think.</h2>
              <p className="mt-4 text-muted-foreground">
                See fresh donations near you, sorted by distance. Accept in one tap and coordinate
                pickup with the donor. Get verified once — start receiving instantly.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex gap-2"><Check /> Nearby donations sorted by distance</li>
                <li className="flex gap-2"><Check /> Instant push-style notifications</li>
                <li className="flex gap-2"><Check /> Contact details on accept</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Ready to share your surplus?</h2>
        <p className="mt-3 text-muted-foreground">Join FoodShare and help end food waste in your neighbourhood.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Get started free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | bigint }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{Number(value).toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Check() {
  return (
    <span className="mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 6.5l2.5 2.5L10 3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  );
}
