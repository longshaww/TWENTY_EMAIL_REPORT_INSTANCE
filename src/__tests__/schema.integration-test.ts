import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { describe, expect, it } from 'vitest';

describe('App installation', () => {
  it('should find the installed app in the applications list', async () => {
    const client = new MetadataApiClient();

    const result = await client.query({
      findManyApplications: {
        id: true,
        name: true,
        universalIdentifier: true,
      },
    });

    const app = result.findManyApplications.find(
      (a: { universalIdentifier: string }) =>
        a.universalIdentifier === APPLICATION_UNIVERSAL_IDENTIFIER,
    );

    expect(app).toBeDefined();
  });
});

describe('CoreApiClient', () => {
  it('should support CRUD on the app-owned Report object', async () => {
    // The app's default function role can write its own objects (Report /
    // ReportSubscription / ReportRun) but not standard objects like Note, so we
    // exercise CRUD against a NorthPeak Report here.
    const client = new CoreApiClient();

    const created = await client.mutation({
      createNorthpeakReport: {
        __args: { data: { name: 'Integration test report', prompt: 'test' } },
        id: true,
      },
    });
    expect(created.createNorthpeakReport?.id).toBeDefined();

    await client.mutation({
      deleteNorthpeakReport: {
        __args: { id: created.createNorthpeakReport!.id },
        id: true,
      },
    });
  });

  it('should REJECT writing a standard object (function role has no write access)', async () => {
    // Negative security boundary: default-role.ts sets canUpdate/canSoftDelete/
    // canDestroyAllObjectRecords=false and only grants write on the three NorthPeak
    // objects — so the app role must NOT be able to write standard CRM objects like
    // Note. If a future change re-grants global write, this fails and flags it.
    const client = new CoreApiClient();

    await expect(
      client.mutation({
        createNote: {
          __args: { data: { title: 'northpeak role should not be able to create this' } },
          id: true,
        },
      } as any),
    ).rejects.toThrow();
  });
});
