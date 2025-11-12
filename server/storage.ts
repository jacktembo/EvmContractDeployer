import { 
  type Deployment,
  type InsertDeployment, 
  type ContractTemplate,
  type InsertContractTemplate,
  type Workspace,
  type InsertWorkspace,
  type WorkspaceFile,
  type InsertWorkspaceFile,
  type ContractVersion,
  type InsertContractVersion,
  type GasHistory,
  type InsertGasHistory,
  deployments,
  contractTemplates,
  workspaces,
  workspaceFiles,
  contractVersions,
  gasHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, max, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Deployments
  createDeployment(deployment: InsertDeployment): Promise<Deployment>;
  getDeployment(id: number): Promise<Deployment | undefined>;
  getDeploymentsByWallet(walletAddress: string): Promise<Deployment[]>;
  updateDeploymentNotes(id: number, notes: string): Promise<void>;
  updateDeploymentVerification(id: number, verified: boolean): Promise<void>;
  updateDeploymentVerificationStatus(id: number, status: string, guid?: string): Promise<void>;
  updateDeploymentFlattenedSource(id: number, flattenedSource: string): Promise<void>;
  deleteDeployment(id: number): Promise<void>;
  
  // Contract Templates
  createTemplate(template: InsertContractTemplate): Promise<ContractTemplate>;
  getAllTemplates(): Promise<ContractTemplate[]>;
  getTemplatesByCategory(category: string): Promise<ContractTemplate[]>;
  getTemplate(id: number): Promise<ContractTemplate | undefined>;
  
  // Workspaces
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  getWorkspacesByMember(walletAddress: string): Promise<Workspace[]>;
  updateWorkspaceMembers(id: number, members: any): Promise<void>;
  renameWorkspace(id: number, name: string): Promise<void>;
  addDeploymentToWorkspace(workspaceId: number, deploymentId: number): Promise<void>;
  deleteWorkspace(id: number): Promise<void>;
  
  // Workspace Files
  createFile(file: InsertWorkspaceFile): Promise<WorkspaceFile>;
  getFile(id: number): Promise<WorkspaceFile | undefined>;
  getFileByPath(workspaceId: number, path: string): Promise<WorkspaceFile | undefined>;
  getWorkspaceFiles(workspaceId: number): Promise<WorkspaceFile[]>;
  updateFileContent(id: number, content: string): Promise<void>;
  updateFilePath(id: number, path: string): Promise<void>;
  deleteFile(id: number): Promise<void>;
  deleteFilesByPath(workspaceId: number, pathPrefix: string): Promise<void>;
  
  // Contract Versions
  createContractVersion(version: Omit<InsertContractVersion, 'version'>): Promise<ContractVersion>;
  getContractVersions(deploymentId: number): Promise<ContractVersion[]>;
  getContractVersion(id: number): Promise<ContractVersion | undefined>;
  
  // Gas History
  saveGasHistory(gasData: InsertGasHistory): Promise<GasHistory>;
  getLatestGasPrice(chainId: number): Promise<GasHistory | undefined>;
  getGasHistory(chainId: number, startTime?: Date, endTime?: Date): Promise<GasHistory[]>;
}

export class DatabaseStorage implements IStorage {
  // Deployments
  async createDeployment(deployment: InsertDeployment): Promise<Deployment> {
    const [result] = await db.insert(deployments).values(deployment).returning();
    return result;
  }

  async getDeployment(id: number): Promise<Deployment | undefined> {
    const [result] = await db.select().from(deployments).where(eq(deployments.id, id));
    return result;
  }

  async getDeploymentsByWallet(walletAddress: string): Promise<Deployment[]> {
    return db
      .select()
      .from(deployments)
      .where(eq(deployments.walletAddress, walletAddress))
      .orderBy(desc(deployments.deployedAt));
  }

  async updateDeploymentNotes(id: number, notes: string): Promise<void> {
    await db.update(deployments).set({ notes }).where(eq(deployments.id, id));
  }

  async updateDeploymentVerification(id: number, verified: boolean): Promise<void> {
    await db.update(deployments).set({ verified }).where(eq(deployments.id, id));
  }

  async updateDeploymentVerificationStatus(id: number, status: string, guid?: string): Promise<void> {
    const updates: any = { verificationStatus: status };
    if (guid !== undefined) {
      updates.verificationGuid = guid;
    }
    if (status === 'verified') {
      updates.verified = true;
    }
    await db.update(deployments).set(updates).where(eq(deployments.id, id));
  }

  async updateDeploymentFlattenedSource(id: number, flattenedSource: string): Promise<void> {
    await db.update(deployments).set({ flattenedSource }).where(eq(deployments.id, id));
  }

  async deleteDeployment(id: number): Promise<void> {
    await db.delete(deployments).where(eq(deployments.id, id));
  }

  // Contract Templates
  async createTemplate(template: InsertContractTemplate): Promise<ContractTemplate> {
    const [result] = await db.insert(contractTemplates).values(template).returning();
    return result;
  }

  async getAllTemplates(): Promise<ContractTemplate[]> {
    return db.select().from(contractTemplates).orderBy(desc(contractTemplates.featured), contractTemplates.name);
  }

  async getTemplatesByCategory(category: string): Promise<ContractTemplate[]> {
    return db.select().from(contractTemplates).where(eq(contractTemplates.category, category));
  }

  async getTemplate(id: number): Promise<ContractTemplate | undefined> {
    const [result] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, id));
    return result;
  }

  // Workspaces
  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const [result] = await db.insert(workspaces).values(workspace).returning();
    return result;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [result] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return result;
  }

  async getWorkspacesByMember(walletAddress: string): Promise<Workspace[]> {
    return db
      .select()
      .from(workspaces)
      .where(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements(${workspaces.members}) AS member 
          WHERE member->>'address' = ${walletAddress}
        )`
      );
  }

  async updateWorkspaceMembers(id: number, members: any): Promise<void> {
    await db.update(workspaces).set({ members }).where(eq(workspaces.id, id));
  }

  async renameWorkspace(id: number, name: string): Promise<void> {
    await db.update(workspaces).set({ name }).where(eq(workspaces.id, id));
  }

  async addDeploymentToWorkspace(workspaceId: number, deploymentId: number): Promise<void> {
    await db
      .update(workspaces)
      .set({
        deployments: sql`
          CASE 
            WHEN ${workspaces.deployments} @> ${JSON.stringify([deploymentId])}::jsonb
            THEN ${workspaces.deployments}
            ELSE ${workspaces.deployments} || ${JSON.stringify([deploymentId])}::jsonb
          END
        `
      })
      .where(eq(workspaces.id, workspaceId));
  }

  async deleteWorkspace(id: number): Promise<void> {
    await db.delete(workspaces).where(eq(workspaces.id, id));
  }

  // Workspace Files
  async createFile(file: InsertWorkspaceFile): Promise<WorkspaceFile> {
    const [result] = await db.insert(workspaceFiles).values({
      ...file,
      updatedAt: new Date(),
    }).returning();
    return result;
  }

  async getFile(id: number): Promise<WorkspaceFile | undefined> {
    const [result] = await db.select().from(workspaceFiles).where(eq(workspaceFiles.id, id));
    return result;
  }

  async getFileByPath(workspaceId: number, path: string): Promise<WorkspaceFile | undefined> {
    const [result] = await db.select().from(workspaceFiles)
      .where(and(eq(workspaceFiles.workspaceId, workspaceId), eq(workspaceFiles.path, path)));
    return result;
  }

  async getWorkspaceFiles(workspaceId: number): Promise<WorkspaceFile[]> {
    return db.select().from(workspaceFiles)
      .where(eq(workspaceFiles.workspaceId, workspaceId))
      .orderBy(workspaceFiles.path);
  }

  async updateFileContent(id: number, content: string): Promise<void> {
    await db.update(workspaceFiles).set({ content, updatedAt: new Date() }).where(eq(workspaceFiles.id, id));
  }

  async updateFilePath(id: number, path: string): Promise<void> {
    await db.update(workspaceFiles).set({ path, updatedAt: new Date() }).where(eq(workspaceFiles.id, id));
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(workspaceFiles).where(eq(workspaceFiles.id, id));
  }

  async deleteFilesByPath(workspaceId: number, pathPrefix: string): Promise<void> {
    await db.delete(workspaceFiles).where(
      and(
        eq(workspaceFiles.workspaceId, workspaceId),
        sql`${workspaceFiles.path} LIKE ${pathPrefix + '%'}`
      )
    );
  }

  // Contract Versions
  async createContractVersion(data: Omit<InsertContractVersion, 'version'>): Promise<ContractVersion> {
    // Use raw SQL to atomically calculate next version number
    const result = await db.execute<ContractVersion>(sql`
      INSERT INTO contract_versions (deployment_id, version, source_code, notes, solc_version, compiler_settings, created_by)
      VALUES (
        ${data.deploymentId},
        COALESCE((SELECT MAX(version) FROM contract_versions WHERE deployment_id = ${data.deploymentId}), 0) + 1,
        ${data.sourceCode},
        ${data.notes},
        ${data.solcVersion},
        ${data.compilerSettings},
        ${data.createdBy}
      )
      RETURNING *
    `);
    return result.rows[0] as ContractVersion;
  }

  async getContractVersions(deploymentId: number): Promise<ContractVersion[]> {
    return db
      .select()
      .from(contractVersions)
      .where(eq(contractVersions.deploymentId, deploymentId))
      .orderBy(desc(contractVersions.version));
  }

  async getContractVersion(id: number): Promise<ContractVersion | undefined> {
    const [result] = await db.select().from(contractVersions).where(eq(contractVersions.id, id));
    return result;
  }

  // Gas History
  async saveGasHistory(gasData: InsertGasHistory): Promise<GasHistory> {
    const [result] = await db.insert(gasHistory).values(gasData).returning();
    return result;
  }

  async getLatestGasPrice(chainId: number): Promise<GasHistory | undefined> {
    const [result] = await db
      .select()
      .from(gasHistory)
      .where(eq(gasHistory.chainId, chainId))
      .orderBy(desc(gasHistory.timestamp))
      .limit(1);
    return result;
  }

  async getGasHistory(chainId: number, startTime?: Date, endTime?: Date): Promise<GasHistory[]> {
    const conditions = [eq(gasHistory.chainId, chainId)];
    
    if (startTime) {
      conditions.push(gte(gasHistory.timestamp, startTime));
    }
    
    if (endTime) {
      conditions.push(lte(gasHistory.timestamp, endTime));
    }

    return db
      .select()
      .from(gasHistory)
      .where(and(...conditions))
      .orderBy(desc(gasHistory.timestamp));
  }
}

export const storage = new DatabaseStorage();
