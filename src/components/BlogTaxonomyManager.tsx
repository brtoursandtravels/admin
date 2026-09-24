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
        {open ? "Hide categories" : "Manage categories"}
      </Button>
      {open ? <div id="blog-taxonomy" className="mt-3">
        <CategoryList />
      </div> : null}
    </section>
  );
}

function CategoryList() {
  const query = useQuery({ queryKey: ["blog-categories"], queryFn: () => apiRequest<DataResponse<Entry[]>>("/admin/blog/categories") });
  return <Card>
    <h2>Blog categories</h2>
    {query.isPending ? <LoadingPanel /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> :
      query.data.data.length ? <ul className="m-0 grid list-none gap-2 p-0">
        {query.data.data.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 border-t border-admin-border-soft py-3">
          <span>{item.name}</span>
          <DeleteRecordButton resource="blog category" name={item.name}
            description="Permanently delete this blog category and remove its article links? The articles will be kept."
            endpoint={`/admin/blog/categories/${item.id}/permanent`} invalidateKeys={["blog-categories", "blog-posts"]} />
        </li>)}
      </ul> : <EmptyState title="No categories" description="Create categories in the article editor." />}
  </Card>;
}
