import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import HearingModule from "./HearingModule";
import { createEmptyRecord, updateThreshold, audiogramToHearingRecord } from "./hearing.utils";
import * as hearingUtils from "./hearing.utils";
import * as archiveModule from "../archive";
import * as draftModule from "../draft";
import type { AudiogramRecord, CustomerProfile, CustomerAggregate } from "../archive/archive.types";
import { createEmptyAudiogram, createEmptyCustomer, FREQUENCIES } from "../archive/archive.types";
import type { UseHearingDraftResult } from "../draft";
import type { HearingRecord } from "./hearing.types";

vi.mock("../archive", async () => {
  const actual = await vi.importActual("../archive");
  return {
    ...actual,
    useArchive: vi.fn()
  };
});

vi.mock("../draft", async () => {
  const actual = await vi.importActual("../draft");
  return {
    ...actual,
    useHearingDraft: vi.fn()
  };
});

function buildMockCustomer(): CustomerProfile {
  const c = createEmptyCustomer();
  c.id = "cust-test-001";
  c.name = "测试客户";
  c.customerNo = "C1001";
  return c;
}

function buildMockAudiogram(customerId: string, id = "aud-test-001"): AudiogramRecord {
  const base = createEmptyAudiogram(customerId);
  return {
    ...base,
    id,
    testDate: "2025-06-15",
    tester: "张医师",
    left: {
      air: FREQUENCIES.map((f, i) => ({
        frequency: f,
        value: [15, 20, 25, 35, 55, 70][i],
        valid: true
      })),
      bone: FREQUENCIES.map((f, i) => ({
        frequency: f,
        value: [10, 15, 20, 30, 50, 65][i],
        valid: true
      }))
    },
    right: {
      air: FREQUENCIES.map((f, i) => ({
        frequency: f,
        value: [12, 18, 22, 32, 52, 68][i],
        valid: true
      })),
      bone: FREQUENCIES.map((f, i) => ({
        frequency: f,
        value: [8, 14, 18, 28, 48, 62][i],
        valid: true
      }))
    }
  };
}

function buildMockAggregate(
  customer: CustomerProfile,
  audiograms: AudiogramRecord[] = []
): CustomerAggregate {
  return {
    profile: customer,
    audiograms,
    fittings: [],
    followUps: [],
    comparisons: [],
    versionCount: 1
  };
}

interface DraftState {
  record: HearingRecord;
  status: UseHearingDraftResult<HearingRecord>["status"];
  lastSavedAt: number | null;
  isSupported: boolean;
  storageType: UseHearingDraftResult<HearingRecord>["storageType"];
  hasDraft: boolean;
}

function createMockUseHearingDraft(initialState?: Partial<DraftState>) {
  const currentRecord: HearingRecord = initialState?.record ?? createEmptyRecord();
  const currentStatus: UseHearingDraftResult<HearingRecord>["status"] =
    initialState?.status ?? "idle";
  const currentLastSavedAt = initialState?.lastSavedAt ?? null;
  const currentHasDraft = initialState?.hasDraft ?? false;

  return {
    mock: vi
      .fn()
      .mockImplementation((_options: Parameters<typeof draftModule.useHearingDraft>[0]) => {
        return {
          record: currentRecord,
          status: currentStatus,
          lastSavedAt: currentLastSavedAt,
          isSupported: initialState?.isSupported ?? true,
          storageType: initialState?.storageType ?? "localstorage",
          hasDraft: currentHasDraft,
          saveNow: vi.fn().mockResolvedValue(undefined),
          updateRecord: vi.fn(),
          clearDraft: vi.fn().mockResolvedValue(undefined),
          loadDraft: vi.fn().mockResolvedValue(undefined)
        } satisfies UseHearingDraftResult<HearingRecord>;
      })
  };
}

function createMockUseArchive() {
  let selectedCustomerId: string | null = null;
  let aggregate: CustomerAggregate | null = null;

  const createAudiogram = vi
    .fn()
    .mockImplementation(async (a: Partial<AudiogramRecord>): Promise<AudiogramRecord> => {
      const saved: AudiogramRecord = {
        ...createEmptyAudiogram(a.customerId || ""),
        ...a,
        id: a.id || `aud-${Date.now()}`,
        entityType: "audiogram"
      } as AudiogramRecord;
      return saved;
    });

  const updateAudiogram = vi
    .fn()
    .mockImplementation(async (a: AudiogramRecord): Promise<AudiogramRecord> => {
      return { ...a, updatedAt: Date.now() };
    });

  return {
    setCustomer: (customer: CustomerProfile | null, audiograms: AudiogramRecord[] = []) => {
      if (customer) {
        selectedCustomerId = customer.id;
        aggregate = buildMockAggregate(customer, audiograms);
      } else {
        selectedCustomerId = null;
        aggregate = null;
      }
    },
    getCalls: () => ({
      createAudiogram,
      updateAudiogram
    }),
    mock: vi.fn().mockImplementation(() => ({
      createAudiogram,
      updateAudiogram,
      get aggregate() {
        return aggregate;
      },
      get selectedCustomerId() {
        return selectedCustomerId;
      },
      loading: "loaded",
      error: null,
      customers: [],
      stats: null,
      versions: [],
      conflictDiffs: [],
      listCustomers: vi.fn(),
      selectCustomer: vi.fn(),
      createCustomer: vi.fn(),
      updateCustomer: vi.fn(),
      deleteCustomer: vi.fn(),
      deleteAudiogram: vi.fn(),
      createFitting: vi.fn(),
      updateFitting: vi.fn(),
      deleteFitting: vi.fn(),
      createFollowUp: vi.fn(),
      updateFollowUp: vi.fn(),
      deleteFollowUp: vi.fn(),
      createComparison: vi.fn(),
      updateComparison: vi.fn(),
      deleteComparison: vi.fn(),
      getLatestComparison: vi.fn(),
      loadVersions: vi.fn(),
      revertToVersion: vi.fn(),
      simulateConflict: vi.fn(),
      computeConflictDiff: vi.fn(),
      resolveConflict: vi.fn(),
      refreshStats: vi.fn(),
      seedData: vi.fn(),
      clearAll: vi.fn()
    }))
  };
}

function buildHearingRecordWithData(): HearingRecord {
  let r = createEmptyRecord();
  r = updateThreshold(r, "left", "air", 500, 25);
  r = updateThreshold(r, "left", "air", 1000, 30);
  r = updateThreshold(r, "left", "air", 2000, 35);
  return r;
}

describe("HearingModule - 数据转换与保存流程", () => {
  let mockArchive: ReturnType<typeof createMockUseArchive>;
  let mockDraft: ReturnType<typeof createMockUseHearingDraft>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockArchive = createMockUseArchive();
    mockDraft = createMockUseHearingDraft();
    (archiveModule.useArchive as ReturnType<typeof vi.fn>).mockImplementation(mockArchive.mock);
    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(mockDraft.mock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should use per-customer draft key based on customerId", async () => {
    const customer = buildMockCustomer();
    mockArchive.setCustomer(customer, []);

    render(<HearingModule customerId={customer.id} showSamples={false} />);

    await waitFor(() => {
      expect(draftModule.useHearingDraft).toHaveBeenCalled();
    });

    const draftCallArgs = (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(draftCallArgs.key).toBe(`hearing_record_${customer.id}`);
  });

  it("should fall back to generic draft key when no customerId", async () => {
    mockArchive.setCustomer(null);

    render(<HearingModule showSamples={false} />);

    await waitFor(() => {
      expect(draftModule.useHearingDraft).toHaveBeenCalled();
    });

    const draftCallArgs = (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(draftCallArgs.key).toBe("hearing_record");
  });

  it("should load audiogram data correctly when audiogramId is provided", async () => {
    const customer = buildMockCustomer();
    const existingAudiogram = buildMockAudiogram(customer.id, "aud-existing-001");
    mockArchive.setCustomer(customer, [existingAudiogram]);

    const hearingRecord: HearingRecord = audiogramToHearingRecord(existingAudiogram);
    hearingRecord.meta = {
      testDate: "2025-06-18",
      tester: "李医师",
      notes: "复测更新"
    };

    mockDraft = createMockUseHearingDraft({ record: hearingRecord, hasDraft: true });
    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(mockDraft.mock);

    render(
      <HearingModule
        customerId={customer.id}
        audiogramId={existingAudiogram.id}
        showSamples={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/26\.7 dB/)).toBeInTheDocument();
    });
    expect(screen.getByText(/轻度/)).toBeInTheDocument();
  });

  it("should pass hearingRecordToAudiogram without existing audiogram when creating new record", async () => {
    const spy = vi.spyOn(hearingUtils, "hearingRecordToAudiogram");

    const customer = buildMockCustomer();
    mockArchive.setCustomer(customer, []);

    const hearingRecord = buildHearingRecordWithData();
    mockDraft = createMockUseHearingDraft({ record: hearingRecord, hasDraft: true });
    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(mockDraft.mock);

    render(<HearingModule customerId={customer.id} audiogramId={null} showSamples={false} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /保存到档案/ })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: /保存到档案/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    const callArgs = spy.mock.calls[0];
    expect(callArgs[1]).toBe(customer.id);
    expect(callArgs[2]).toBeUndefined();

    spy.mockRestore();
  });

  it("should call createAudiogram for new records", async () => {
    const customer = buildMockCustomer();
    mockArchive.setCustomer(customer, []);

    const hearingRecord = buildHearingRecordWithData();
    mockDraft = createMockUseHearingDraft({ record: hearingRecord, hasDraft: true });
    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(mockDraft.mock);

    render(<HearingModule customerId={customer.id} showSamples={false} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /保存到档案/ })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: /保存到档案/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockArchive.getCalls().createAudiogram).toHaveBeenCalled();
    });
    expect(mockArchive.getCalls().updateAudiogram).not.toHaveBeenCalled();

    const createArg = mockArchive.getCalls().createAudiogram.mock.calls[0][0] as AudiogramRecord;
    expect(createArg.customerId).toBe(customer.id);
    expect(createArg.entityType).toBe("audiogram");
  });

  it("should pass existing audiogram to hearingRecordToAudiogram when editing a matching record", async () => {
    const spy = vi.spyOn(hearingUtils, "hearingRecordToAudiogram");

    const customer = buildMockCustomer();
    const existingAudiogram = buildMockAudiogram(customer.id, "aud-update-001");
    mockArchive.setCustomer(customer, [existingAudiogram]);

    const hearingRecord: HearingRecord = audiogramToHearingRecord(existingAudiogram);
    hearingRecord.meta = { testDate: "2025-06-18", tester: "李医师" };

    mockDraft = createMockUseHearingDraft({ record: hearingRecord, hasDraft: true });
    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(mockDraft.mock);

    render(
      <HearingModule
        customerId={customer.id}
        audiogramId={existingAudiogram.id}
        showSamples={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /保存到档案|更新到档案/ })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: /保存到档案|更新到档案/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    const callWithExisting = spy.mock.calls.find(
      (args) => args[1] === customer.id && args[2] !== undefined
    );
    expect(callWithExisting).toBeDefined();
    expect((callWithExisting![2] as AudiogramRecord).id).toBe(existingAudiogram.id);
    expect((callWithExisting![2] as AudiogramRecord).customerId).toBe(customer.id);

    await waitFor(() => {
      expect(mockArchive.getCalls().updateAudiogram).toHaveBeenCalled();
    });
    expect(mockArchive.getCalls().createAudiogram).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("should fall back to createAudiogram when editingAudiogram belongs to a different customer", async () => {
    const customerA = buildMockCustomer();
    customerA.id = "cust-A";
    const customerB = buildMockCustomer();
    customerB.id = "cust-B";

    const audiogramFromB = buildMockAudiogram(customerB.id, "aud-from-B");
    audiogramFromB.customerId = customerB.id;

    mockArchive.setCustomer(customerA, []);

    const hearingRecord: HearingRecord = audiogramToHearingRecord(audiogramFromB);
    mockDraft = createMockUseHearingDraft({ record: hearingRecord, hasDraft: true });
    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(mockDraft.mock);

    render(
      <HearingModule
        customerId={customerA.id}
        audiogramId={audiogramFromB.id}
        showSamples={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /保存到档案|更新到档案/ })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: /保存到档案|更新到档案/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockArchive.getCalls().createAudiogram).toHaveBeenCalled();
    });
    expect(mockArchive.getCalls().updateAudiogram).not.toHaveBeenCalled();
  });

  it("should disable save button when no customer is selected", async () => {
    mockArchive.setCustomer(null);

    const record = buildHearingRecordWithData();
    mockDraft = createMockUseHearingDraft({ record, hasDraft: true });
    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(mockDraft.mock);

    render(<HearingModule showSamples={false} />);

    await waitFor(() => {
      const saveBtn = screen.queryByRole("button", { name: /保存到档案|更新到档案/ });
      expect(saveBtn).toBeInTheDocument();
      expect(saveBtn).toBeDisabled();
    });
  });

  it("should disable save button when record has no data", async () => {
    const customer = buildMockCustomer();
    mockArchive.setCustomer(customer, []);

    mockDraft = createMockUseHearingDraft({ record: createEmptyRecord(), hasDraft: false });
    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(mockDraft.mock);

    render(<HearingModule customerId={customer.id} showSamples={false} />);

    await waitFor(() => {
      const saveBtn = screen.queryByRole("button", { name: /保存到档案|更新到档案/ });
      expect(saveBtn).toBeInTheDocument();
      expect(saveBtn).toBeDisabled();
    });
  });
});

describe("HearingModule - 切换客户后取消误保存", () => {
  let mockArchive: ReturnType<typeof createMockUseArchive>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockArchive = createMockUseArchive();
    (archiveModule.useArchive as ReturnType<typeof vi.fn>).mockImplementation(mockArchive.mock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should cancel save and show alert when customer changes during the saveNow phase", async () => {
    const customerA = buildMockCustomer();
    customerA.id = "cust-save-A";
    const customerB = buildMockCustomer();
    customerB.id = "cust-save-B";

    mockArchive.setCustomer(customerA, []);

    const record = buildHearingRecordWithData();

    let saveNowResolve: (() => void) | null = null;
    const saveNowSpy = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          saveNowResolve = resolve;
        })
    );

    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      record,
      status: "idle",
      lastSavedAt: null,
      isSupported: true,
      storageType: "localstorage",
      hasDraft: true,
      saveNow: saveNowSpy,
      updateRecord: vi.fn(),
      clearDraft: vi.fn().mockResolvedValue(undefined),
      loadDraft: vi.fn().mockResolvedValue(undefined)
    }));

    const { rerender } = render(<HearingModule customerId={customerA.id} showSamples={false} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /保存到档案/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /保存到档案/ }));

    await waitFor(() => {
      expect(saveNowSpy).toHaveBeenCalled();
    });

    mockArchive.setCustomer(customerB, []);
    rerender(<HearingModule customerId={customerB.id} showSamples={false} />);

    await act(async () => {
      saveNowResolve?.();
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("客户已切换"));
    });

    expect(mockArchive.getCalls().createAudiogram).not.toHaveBeenCalled();
    expect(mockArchive.getCalls().updateAudiogram).not.toHaveBeenCalled();
  });

  it("should not invoke onSaved callback when customer switches after save completes", async () => {
    const customerA = buildMockCustomer();
    customerA.id = "cust-cb-A";
    const customerB = buildMockCustomer();
    customerB.id = "cust-cb-B";

    mockArchive.setCustomer(customerA, []);

    const record = buildHearingRecordWithData();
    const onSaved = vi.fn();

    let saveNowResolve: (() => void) | null = null;
    const saveNowSpy = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          saveNowResolve = resolve;
        })
    );

    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      record,
      status: "idle",
      lastSavedAt: null,
      isSupported: true,
      storageType: "localstorage",
      hasDraft: true,
      saveNow: saveNowSpy,
      updateRecord: vi.fn(),
      clearDraft: vi.fn().mockResolvedValue(undefined),
      loadDraft: vi.fn().mockResolvedValue(undefined)
    }));

    const { rerender } = render(
      <HearingModule customerId={customerA.id} onSaved={onSaved} showSamples={false} />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /保存到档案/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /保存到档案/ }));
    await waitFor(() => expect(saveNowSpy).toHaveBeenCalled());

    mockArchive.setCustomer(customerB, []);
    rerender(<HearingModule customerId={customerB.id} onSaved={onSaved} showSamples={false} />);

    await act(async () => {
      saveNowResolve?.();
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });

    expect(onSaved).not.toHaveBeenCalled();
  });

  it("should show warning alert when save succeeds but customer has switched afterwards", async () => {
    const customerA = buildMockCustomer();
    customerA.id = "cust-warn-A";
    const customerB = buildMockCustomer();
    customerB.id = "cust-warn-B";

    mockArchive.setCustomer(customerA, []);

    const record = buildHearingRecordWithData();

    const saveNowSpy = vi.fn().mockResolvedValue(undefined);

    let createResolve: ((value: AudiogramRecord) => void) | null = null;
    const createSpy = vi.fn().mockImplementation(
      () =>
        new Promise<AudiogramRecord>((resolve) => {
          createResolve = resolve;
        })
    );
    mockArchive.getCalls().createAudiogram.mockImplementation(createSpy);

    (draftModule.useHearingDraft as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      record,
      status: "idle",
      lastSavedAt: null,
      isSupported: true,
      storageType: "localstorage",
      hasDraft: true,
      saveNow: saveNowSpy,
      updateRecord: vi.fn(),
      clearDraft: vi.fn().mockResolvedValue(undefined),
      loadDraft: vi.fn().mockResolvedValue(undefined)
    }));

    const { rerender } = render(<HearingModule customerId={customerA.id} showSamples={false} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /保存到档案/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /保存到档案/ }));
    await waitFor(() => expect(saveNowSpy).toHaveBeenCalled());
    await waitFor(() => expect(createSpy).toHaveBeenCalled());

    mockArchive.setCustomer(customerB, []);
    rerender(<HearingModule customerId={customerB.id} showSamples={false} />);

    const newAud = createEmptyAudiogram(customerA.id);
    newAud.id = "aud-newly-created";
    await act(async () => {
      createResolve?.(newAud);
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining("保存成功但检测到客户已切换")
      );
    });
  });
});
