
import { supabase } from "./supabaseClient";

export async function testDatabaseConnection() {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, price, unit")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("LabaGO database connection failed:", error);
    return;
  }

  console.log("LabaGO database connected successfully!");
  console.table(data);
}
