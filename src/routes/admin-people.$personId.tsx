import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { PersonDetailContent } from "@/components/admin/PersonDetail";
import { useAdminPeople } from "@/components/admin/people-model";
import { fullName, useAuth } from "@/lib/auth";

/**
 * Dedicated full-page profile view opened from the admin People drawer.
 * Gives admins the same information as the drawer, but in a regular browser
 * tab that can be bookmarked, refreshed and compared side-by-side.
 */
export const Route = createFileRoute("/admin-people/$personId")({
  component: AdminPeopleDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: `Profile — ${params.personId} — Loqal Admin` },
      {
        name: "description",
        content: "Loqal admin profile view with registration data, documents, properties, activity and engagement metrics.",
      },
      { property: "og:title", content: `Profile — ${params.personId} — Loqal Admin` },
      {
        property: "og:description",
        content: "Loqal admin profile view with registration data, documents, properties, activity and engagement metrics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminPeopleDetailPage() {
  const { user, ready } = useAuth();
  const { personId } = Route.useParams();
  const { people, ready: peopleReady } = useAdminPeopleReady();

  if (!ready) return <div className="min-h-screen bg-background" />;

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="Home" />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-foreground">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This profile view is limited to Loqal employees.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background"
          >
            Go to sign in
          </Link>
        </main>
      </div>
    );
  }

  if (!peopleReady) {
    // Registrations load from the database after mount; hold the page until
    // they arrive so the profile isn't mistaken for missing.
    return (
      <div className="min-h-screen bg-background">
        <AppHeader navSlot={<AdminNav tab={"people"} />} />
        <main className="mx-auto max-w-[1100px] px-4 py-24 text-center text-sm text-muted-foreground">
          Loading profile…
        </main>
      </div>
    );
  }

  const person = people.find((p) => p.key === personId);
  if (!person) throw notFound();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader navSlot={<AdminNav tab={"people"} />} />
      <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-7">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <PersonDetailContent person={person} mode="page" />
        </div>
      </main>
    </div>
  );
}
