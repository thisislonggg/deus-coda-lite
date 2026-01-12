import { notFound } from "next/navigation";
import PageEditor from "@/components/PageEditor";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getMyRoleServer } from "@/lib/role.server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PageBySlug({ params }: PageProps) {
  const { slug } = await params;

  const supabase = await createSupabaseServer();
  const role = await getMyRoleServer();

  const { data: page, error } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!page) return notFound();

  return <PageEditor initialPage={page}/>;
}
