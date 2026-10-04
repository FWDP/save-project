import { CategoryForm, DeleteCategoryForm } from "@/components/personal-finance-forms";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api";
import type { ApiCategory } from "@/lib/types";

export default async function CategoriesPage() {

  const categories = await api<ApiCategory[]>("/categories");
  const custom = categories.filter((category) => !category.builtIn);
  const builtIn = categories.filter((category) => category.builtIn);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>Your categories.</h1>
          <p>Personal categories are shared with SAVE Mobile.</p>
        </div>
      </div>
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <h2>Add a category</h2>
            <p>Choose a label for your income or expenses.</p>
          </div>
        </div>
        <CategoryForm />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Custom categories</h2>
            <p>{custom.length} categories you can edit or remove.</p>
          </div>
        </div>
        {custom.length ? (
          <div className="overview-grid">
            {custom.map((category) => (
              <article className="panel" key={category.id}>
                <div className="panel-heading">
                  <div className="transaction-name">
                    <span
                      className="transaction-icon"
                      style={{ color: category.color }}
                    >
                      <Icon name="transactions" />
                    </span>
                    <div>
                      <h3>{category.name}</h3>
                      <span className="capitalize">{category.type}</span>
                    </div>
                  </div>
                </div>
                <details className="delete-record">
                  <summary>Edit category</summary>
                  <CategoryForm category={category} />
                </details>
                <DeleteCategoryForm category={category} />
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No custom categories yet.</p>
        )}
      </section>
      <details className="panel">
        <summary>Built-in categories ({builtIn.length})</summary>
        <p className="muted">
          Built-in categories are available on both Web and Mobile and cannot
          be edited or deleted.
        </p>
        <div className="category-list">
          {builtIn.map((category) => (
            <span className="category-chip" key={category.id}>
              {category.name}
            </span>
          ))}
        </div>
      </details>
    </>
  );
}
