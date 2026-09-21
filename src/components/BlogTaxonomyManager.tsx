import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, type DataResponse } from "../api";
import { Button, Card, EmptyState, ErrorPanel, LoadingPanel } from "../ui";
import { DeleteRecordButton } from "./DeleteButton";

type Entry = { id: string; name: string };

export function BlogTaxonomyManager() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-4">
      <Button variant="secondary" aria-expanded={open} aria-controls="blog-taxonomy" onClick={() => setOpen(!open)}>
        {open ? "Hide categories and tags" : "Manage categories and tags"}
      </Button>
      {open ? <div id="blog-taxonomy" className="mt-3 grid gap-4 md:grid-cols-2">
        <TaxonomyList kind="categories" resource="blog category" />
        <TaxonomyList kind="tags" resource="blog tag" />
      </div> : null}
    </section>
  );
}

function TaxonomyList({ kind, resource }: { kind: "categories" | "tags"; resource: string }) {
  const query = useQuery({ queryKey: [`blog-${kind}`], queryFn: () => apiRequest<DataResponse<Entry[]>>(`/admin/blog/${kind}`) });
  return <Card>
    <h2>{kind === "categories" ? "Blog categories" : "Blog tags"}</h2>
    {query.isPending ? <LoadingPanel /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> :
      query.data.data.length ? <ul className="m-0 grid list-none gap-2 p-0">
        {query.data.data.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 border-t border-admin-border-soft py-3">
          <span>{item.name}</span>
          <DeleteRecordButton resource={resource} name={item.name}
            description={`Permanently delete this ${resource} and remove its article links? The articles will be kept.`}
            endpoint={`/admin/blog/${kind}/${item.id}/permanent`} invalidateKeys={[`blog-${kind}`, "blog-posts"]} />
        </li>)}
      </ul> : <EmptyState title={`No ${kind}`} description="Create categories and tags in the article editor." />}
  </Card>;
}
