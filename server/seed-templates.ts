import { db } from "./db";
import { contractTemplates } from "@shared/schema";
import { CONTRACT_TEMPLATES } from "./templates/templates";
import { sql, and, eq } from "drizzle-orm";

export async function seedTemplates() {
  console.log("Seeding contract templates...");
  
  try {
    let newCount = 0;
    let existingCount = 0;
    
    for (const template of CONTRACT_TEMPLATES) {
      // Check if template already exists (name + solcVersion as unique key)
      const existing = await db
        .select()
        .from(contractTemplates)
        .where(
          and(
            eq(contractTemplates.name, template.name),
            eq(contractTemplates.solcVersion, template.solcVersion)
          )
        )
        .limit(1);
      
      if (existing.length === 0) {
        // Insert new template
        await db.insert(contractTemplates).values(template);
        newCount++;
      } else {
        existingCount++;
      }
    }
    
    const totalCount = await db.select({ count: sql<number>`count(*)` }).from(contractTemplates);
    console.log(`✓ Templates seeded successfully. Added: ${newCount}, Existing: ${existingCount}, Total: ${totalCount[0].count}`);
  } catch (error) {
    console.error("Error seeding templates:", error);
    // Don't throw - allow server to start even if seeding fails
  }
}
