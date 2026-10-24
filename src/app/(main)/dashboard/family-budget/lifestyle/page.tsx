import type { Metadata } from "next";

import { TagCategoryExplorer } from "./tag-category-explorer";

export const metadata: Metadata = {
  title: "Tag & Category Explorer | Family Budget",
  description:
    "Proportional donut composition with Category-to-Tag chevron drill-down and filtered historical trend curves.",
};

export default function TagCategoryExplorerPage() {
  return <TagCategoryExplorer />;
}
