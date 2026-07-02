import { redirect } from "next/navigation";

// Forge30 has no landing page: the first screen is the app dashboard.
export default function Root() {
  redirect("/today");
}
