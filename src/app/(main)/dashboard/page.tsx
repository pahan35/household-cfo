import { redirect } from "next/navigation";

import { getHomeUrl } from "@/config/app-mode";

export default function Page() {
  redirect(getHomeUrl());
}
