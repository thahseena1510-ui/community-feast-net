import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HandHeart, MapPin, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoodShare — Share surplus food with NGOs" },
      { name: "description", content: "Post your extra food. NGOs nearby get notified instantly. Together, we cut food waste and feed more people." },
      { property: "og:title", content: "FoodShare — Share surplus food with NGOs" },
      { property: "og:description", content: "Post your extra food. NGOs nearby get notified instantly. Together, we cut food waste and feed more people." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Reduce food waste, feed your community
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
                  Get started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth" search={{} as never}>I'm an NGO</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: HandHeart, title: "Post a donation", body: "Tell us what food you have, how much, and where to pick it up." },
            { icon: MapPin, title: "Match instantly", body: "Verified NGOs nearby are notified the moment your donation goes live." },
            { icon: Truck, title: "Track pickup", body: "Follow the donation from accepted to delivered — with realtime updates." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
