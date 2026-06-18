import type { ArchiveEntity, ConflictDiff } from "../archive.types";
import type {
  FieldMergeStrategy,
  IConflictResolver,
  MergeResult
} from "./sync.types";

const SKIP_FIELDS = new Set([
  "version",
  "versionId",
  "parentVersionId",
  "editedAt",
  "editedBy",
  "updatedAt",
  "syncStatus",
  "conflict",
  "lastSyncedAt",
  "serverId",
  "createdAt"
]);

const FIELD_PRIORITY: Record<string, "local" | "remote" | "newer"> = {
  remark: "newer",
  tags: "newer",
  editedBy: "remote",
  editedAt: "newer"
};

export class ConflictResolver implements IConflictResolver {
  detectConflicts(
    localEntity: ArchiveEntity,
    remoteEntity: ArchiveEntity
  ): ConflictDiff[] {
    const diffs: ConflictDiff[] = [];
    this.compareValues(localEntity, remoteEntity, "", diffs);
    return diffs;
  }

  merge(
    localEntity: ArchiveEntity,
    remoteEntity: ArchiveEntity,
    baseEntity?: ArchiveEntity,
    strategies?: FieldMergeStrategy[]
  ): MergeResult {
    const diffs = this.detectConflicts(localEntity, remoteEntity);
    const autoMergedFields: string[] = [];
    const manualRequiredFields: ConflictDiff[] = [];
    const strategyMap = new Map(
      (strategies || []).map((s) => [s.field, s.strategy])
    );

    const merged = this.cloneEntity(localEntity);

    for (const diff of diffs) {
      const strategy =
        strategyMap.get(diff.field) ||
        FIELD_PRIORITY[diff.field] ||
        this.getDefaultStrategy(diff.field, localEntity, remoteEntity, baseEntity);

      if (strategy === "manual") {
        manualRequiredFields.push(diff);
        continue;
      }

      const chosenValue = this.resolveValue(
        strategy,
        diff,
        localEntity,
        remoteEntity,
        baseEntity
      );

      this.applyNestedValue(
        merged as unknown as Record<string, unknown>,
        diff.field,
        chosenValue
      );
      autoMergedFields.push(diff.field);
    }

    const now = Date.now();
    merged.updatedAt = now;

    return {
      merged,
      autoMergedFields,
      manualRequiredFields,
      hasConflict: manualRequiredFields.length > 0
    };
  }

  applyFieldSelection(
    localEntity: ArchiveEntity,
    remoteEntity: ArchiveEntity,
    selections: Record<string, "local" | "remote">
  ): ArchiveEntity {
    const merged = this.cloneEntity(localEntity);

    for (const [field, choice] of Object.entries(selections)) {
      const source = choice === "local" ? localEntity : remoteEntity;
      const value = this.getNestedValue(
        source as unknown as Record<string, unknown>,
        field
      );
      this.applyNestedValue(
        merged as unknown as Record<string, unknown>,
        field,
        value
      );
    }

    merged.updatedAt = Date.now();
    return merged;
  }

  private compareValues(
    local: unknown,
    remote: unknown,
    prefix: string,
    diffs: ConflictDiff[]
  ): void {
    if (SKIP_FIELDS.has(prefix)) return;

    const localJson = JSON.stringify(local);
    const remoteJson = JSON.stringify(remote);

    if (localJson === remoteJson) return;

    if (
      typeof local !== "object" ||
      local === null ||
      typeof remote !== "object" ||
      remote === null ||
      Array.isArray(local) ||
      Array.isArray(remote)
    ) {
      diffs.push({
        field: prefix || "(root)",
        localValue: local,
        remoteValue: remote
      });
      return;
    }

    const lObj = local as Record<string, unknown>;
    const rObj = remote as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(lObj), ...Object.keys(rObj)]);
    let foundNestedDiff = false;

    for (const key of allKeys) {
      if (SKIP_FIELDS.has(key)) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      const lVal = lObj[key];
      const rVal = rObj[key];

      if (JSON.stringify(lVal) !== JSON.stringify(rVal)) {
        if (
          typeof lVal === "object" &&
          lVal !== null &&
          !Array.isArray(lVal) &&
          typeof rVal === "object" &&
          rVal !== null &&
          !Array.isArray(rVal)
        ) {
          this.compareValues(lVal, rVal, path, diffs);
          foundNestedDiff = true;
        } else {
          diffs.push({
            field: path,
            localValue: lVal,
            remoteValue: rVal
          });
          foundNestedDiff = true;
        }
      }
    }

    if (!foundNestedDiff && prefix) {
      if (!diffs.some((d) => d.field.startsWith(prefix))) {
        diffs.push({
          field: prefix,
          localValue: local,
          remoteValue: remote
        });
      }
    }
  }

  private getDefaultStrategy(
    field: string,
    local: ArchiveEntity,
    remote: ArchiveEntity,
    base?: ArchiveEntity
  ): "local" | "remote" | "newer" | "manual" {
    if (field.startsWith("hearingAid") || field.startsWith("left") || field.startsWith("right")) {
      return "newer";
    }

    if (
      field === "name" ||
      field === "phone" ||
      field === "customerNo" ||
      field.startsWith("hearingLossType")
    ) {
      return "manual";
    }

    if (base) {
      const localChanged = this.fieldChanged(base, local, field);
      const remoteChanged = this.fieldChanged(base, remote, field);
      if (localChanged && !remoteChanged) return "local";
      if (!localChanged && remoteChanged) return "remote";
    }

    if (local.editedAt >= remote.editedAt) {
      return "local";
    }
    return "remote";
  }

  private fieldChanged(
    base: ArchiveEntity,
    current: ArchiveEntity,
    field: string
  ): boolean {
    const baseVal = this.getNestedValue(
      base as unknown as Record<string, unknown>,
      field
    );
    const currVal = this.getNestedValue(
      current as unknown as Record<string, unknown>,
      field
    );
    return JSON.stringify(baseVal) !== JSON.stringify(currVal);
  }

  private resolveValue(
    strategy: "local" | "remote" | "newer",
    diff: ConflictDiff,
    local: ArchiveEntity,
    remote: ArchiveEntity,
    _base?: ArchiveEntity
  ): unknown {
    switch (strategy) {
      case "local":
        return diff.localValue;
      case "remote":
        return diff.remoteValue;
      case "newer":
        return local.editedAt >= remote.editedAt ? diff.localValue : diff.remoteValue;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private applyNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const keys = path.split(".");
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (
        !current[key] ||
        typeof current[key] !== "object" ||
        Array.isArray(current[key])
      ) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }

  private cloneEntity<T extends ArchiveEntity>(entity: T): T {
    return JSON.parse(JSON.stringify(entity));
  }
}

let conflictResolverInstance: ConflictResolver | null = null;

export function getConflictResolver(): ConflictResolver {
  if (!conflictResolverInstance) {
    conflictResolverInstance = new ConflictResolver();
  }
  return conflictResolverInstance;
}
